#!/usr/bin/env python3
"""Stop hook: print exact token cost of the last turn + whole session,
parsed straight from the Claude Code transcript JSONL."""
import json, sys

PRICING = {  # $/MTok: input, output. Cache: read 0.1x, 5m write 1.25x, 1h write 2x
    "claude-fable-5":    (10.0, 50.0),
    "claude-opus-4":     (5.0, 25.0),
    "claude-sonnet-4":   (3.0, 15.0),
    "claude-haiku-4":    (1.0, 5.0),
}
def price(model):
    for k, v in PRICING.items():
        if model.startswith(k): return v
    return (3.0, 15.0)

def cost(u, model):
    pin, pout = price(model)
    cc = u.get("cache_creation") or {}
    w5 = cc.get("ephemeral_5m_input_tokens", 0)
    w1 = cc.get("ephemeral_1h_input_tokens", 0)
    if not (w5 or w1): w5 = u.get("cache_creation_input_tokens", 0)
    return (u.get("input_tokens", 0) * pin
            + u.get("cache_read_input_tokens", 0) * pin * 0.1
            + w5 * pin * 1.25 + w1 * pin * 2.0
            + u.get("output_tokens", 0) * pout) / 1e6

try: hook = json.load(sys.stdin)
except Exception: sys.exit(0)
path = hook.get("transcript_path")
if not path: sys.exit(0)

calls = []          # (model, usage)
turn_start = 0      # index of first call after the latest user prompt
with open(path) as f:
    for line in f:
        try: d = json.loads(line)
        except: continue
        if d.get("type") == "user" and not d.get("isMeta"):
            c = (d.get("message") or {}).get("content")
            # real typed prompt = string content (tool results are lists)
            if isinstance(c, str):
                turn_start = len(calls)
        m = d.get("message") or {}
        if d.get("type") == "assistant" and m.get("usage"):
            calls.append((m.get("model", ""), m["usage"]))

if not calls: sys.exit(0)

def tally(items):
    t = {"in": 0, "cr": 0, "cw": 0, "out": 0, "usd": 0.0}
    for model, u in items:
        t["in"]  += u.get("input_tokens", 0)
        t["cr"]  += u.get("cache_read_input_tokens", 0)
        t["cw"]  += u.get("cache_creation_input_tokens", 0)
        t["out"] += u.get("output_tokens", 0)
        t["usd"] += cost(u, model)
    return t

turn, sess = tally(calls[turn_start:]), tally(calls)
print(f"""
  \U0001F4B0 THIS TURN ({len(calls) - turn_start} API calls, {calls[-1][0]})
     fresh input   {turn['in']:>10,}
     cache read    {turn['cr']:>10,}  (0.1×)
     cache write   {turn['cw']:>10,}  (1.25–2×)
     output        {turn['out']:>10,}
     turn cost      ${turn['usd']:.4f}
  \U0001F4CA SESSION ({len(calls)} calls)  ${sess['usd']:.4f}""")
