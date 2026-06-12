#!/usr/bin/env python3
"""
Anthropic API cost-tracking proxy.

Sits between Claude Code and api.anthropic.com, taps every /v1/messages
response (streaming or not), extracts token usage, writes it to
~/.claude/last-usage.json, and appends to ~/.claude/usage-log.jsonl.

Start:  python3 cost-proxy.py
Then set in Claude Code settings:
  ANTHROPIC_BASE_URL=http://localhost:9099
"""

import json
import os
import re
import time
from pathlib import Path
from typing import AsyncIterator

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, Response
import uvicorn

UPSTREAM = "https://api.anthropic.com"
PORT = 9099
LAST_USAGE_FILE = Path.home() / ".claude" / "last-usage.json"
USAGE_LOG_FILE  = Path.home() / ".claude" / "usage-log.jsonl"

PRICING = {
    "claude-opus-4-8":   {"input": 5.00,  "output": 25.00},
    "claude-sonnet-4-6": {"input": 3.00,  "output": 15.00},
    "claude-haiku-4-5":  {"input": 1.00,  "output":  5.00},
    "claude-fable-5":    {"input": 10.00, "output": 50.00},
}
DEFAULT_PRICE = {"input": 3.00, "output": 15.00}

app = FastAPI()


def price_for(model: str) -> dict:
    for k, v in PRICING.items():
        if model.startswith(k):
            return v
    return DEFAULT_PRICE


def calc_cost(usage: dict, model: str) -> dict:
    p = price_for(model)
    inp  = usage.get("input_tokens", 0)
    out  = usage.get("output_tokens", 0)
    cr   = usage.get("cache_read_input_tokens", 0)
    cw   = usage.get("cache_creation_input_tokens", 0)

    inp_cost = inp  / 1e6 * p["input"]
    out_cost = out  / 1e6 * p["output"]
    cr_cost  = cr   / 1e6 * p["input"] * 0.10
    cw_cost  = cw   / 1e6 * p["input"] * 1.25

    return {
        "model": model,
        "input_tokens": inp,
        "output_tokens": out,
        "cache_read_tokens": cr,
        "cache_write_tokens": cw,
        "input_cost":  round(inp_cost, 8),
        "output_cost": round(out_cost, 8),
        "cache_read_cost":  round(cr_cost, 8),
        "cache_write_cost": round(cw_cost, 8),
        "total_cost": round(inp_cost + out_cost + cr_cost + cw_cost, 8),
        "timestamp": time.time(),
    }


def save_usage(data: dict) -> None:
    LAST_USAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
    LAST_USAGE_FILE.write_text(json.dumps(data, indent=2))
    with USAGE_LOG_FILE.open("a") as f:
        f.write(json.dumps(data) + "\n")


def extract_model_from_body(body: bytes) -> str:
    try:
        return json.loads(body).get("model", "unknown")
    except Exception:
        return "unknown"


def extract_usage_from_json(body: bytes) -> dict | None:
    try:
        data = json.loads(body)
        return data.get("usage")
    except Exception:
        return None


def extract_usage_from_sse(chunks: list[bytes]) -> tuple[dict, str]:
    """Parse accumulated SSE chunks; return (usage_dict, model)."""
    usage = {}
    model = "unknown"
    text = b"".join(chunks).decode("utf-8", errors="replace")

    for line in text.splitlines():
        if not line.startswith("data:"):
            continue
        raw = line[5:].strip()
        if raw in ("[DONE]", ""):
            continue
        try:
            ev = json.loads(raw)
        except Exception:
            continue

        t = ev.get("type", "")

        if t == "message_start":
            msg = ev.get("message", {})
            if "model" in msg:
                model = msg["model"]
            u = msg.get("usage", {})
            usage.update(u)

        elif t == "message_delta":
            u = ev.get("usage", {})
            usage.update(u)

    return usage, model


@app.api_route("/{path:path}", methods=["GET","POST","PUT","DELETE","PATCH","OPTIONS"])
async def proxy(request: Request, path: str):
    body = await request.body()
    req_model = extract_model_from_body(body) if body else "unknown"
    is_streaming = b'"stream":true' in body or b'"stream": true' in body

    headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in ("host", "content-length")
    }

    url = f"{UPSTREAM}/{path}"
    if request.url.query:
        url += f"?{request.url.query}"

    client = httpx.AsyncClient(timeout=300)

    if is_streaming:
        upstream = await client.send(
            client.build_request(request.method, url, headers=headers, content=body),
            stream=True,
        )

        chunks: list[bytes] = []

        async def stream_and_tap() -> AsyncIterator[bytes]:
            async for chunk in upstream.aiter_bytes():
                chunks.append(chunk)
                yield chunk
            await client.aclose()
            # After stream ends, extract and save usage
            usage, model = extract_usage_from_sse(chunks)
            if model == "unknown":
                model = req_model
            if usage:
                save_usage(calc_cost(usage, model))

        return StreamingResponse(
            stream_and_tap(),
            status_code=upstream.status_code,
            headers=dict(upstream.headers),
        )

    else:
        resp = await client.request(
            request.method, url, headers=headers, content=body
        )
        await client.aclose()
        usage = extract_usage_from_json(resp.content)
        if usage:
            try:
                model = json.loads(resp.content).get("model", req_model)
            except Exception:
                model = req_model
            save_usage(calc_cost(usage, model))

        return Response(
            content=resp.content,
            status_code=resp.status_code,
            headers=dict(resp.headers),
        )


if __name__ == "__main__":
    print(f"Cost-tracking proxy → {UPSTREAM}")
    print(f"Listening on http://localhost:{PORT}")
    print(f"Usage log: {USAGE_LOG_FILE}")
    print()
    print("Set in Claude Code settings:")
    print(f'  ANTHROPIC_BASE_URL=http://localhost:{PORT}')
    print()
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
