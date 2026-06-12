#!/usr/bin/env python3
"""Stop hook: print cost in owner's preferred format.
Format: #N (first 5 words...) input: X | total: Y | cache: Z | output: W | turn: $U | session: $V"""
import json, sys
from pathlib import Path

PRICING = {
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

def find_transcript():
    projects_dir = Path.home() / ".claude" / "projects"
    if not projects_dir.exists(): return None
    jsonl_files = list(projects_dir.rglob("*.jsonl"))
    if not jsonl_files: return None
    return max(jsonl_files, key=lambda f: f.stat().st_mtime)

path = find_transcript()
if not path: sys.exit(0)

calls = []
prompts = []  # (prompt_num, content, first_call_idx)
turn_start = 0
prompt_count = 0

try:
    with open(path) as f:
        for line in f:
            try: d = json.loads(line)
            except: continue
            if d.get("type") == "user" and not d.get("isMeta"):
                c = (d.get("message") or {}).get("content")
                if isinstance(c, str):
                    prompt_count += 1
                    turn_start = len(calls)
                    prompts.append((prompt_count, c, turn_start))
            m = d.get("message") or {}
            if d.get("type") == "assistant" and m.get("usage"):
                calls.append((m.get("model", ""), m["usage"]))
except Exception:
    sys.exit(0)

if not calls or not prompts: sys.exit(0)

# Find which prompt this turn started from
last_prompt_num = prompts[-1][0]
prompt_text = prompts[-1][1]
prompt_idx = prompts[-1][2]

# Truncate prompt to first ~30 chars / 5 words
words = prompt_text.split()[:5]
prompt_preview = " ".join(words)
if len(prompt_preview) > 30:
    prompt_preview = prompt_preview[:27] + "..."

def tally(items):
    t = {"in": 0, "cr": 0, "cw": 0, "out": 0, "usd": 0.0}
    for model, u in items:
        t["in"]  += u.get("input_tokens", 0)
        t["cr"]  += u.get("cache_read_input_tokens", 0)
        t["cw"]  += u.get("cache_creation_input_tokens", 0)
        t["out"] += u.get("output_tokens", 0)
        t["usd"] += cost(u, model)
    return t

turn = tally(calls[prompt_idx:])
sess = tally(calls)
turn_cache = turn["cr"] + turn["cw"]
turn_total = turn["usd"]

print(f"  #{last_prompt_num} ({prompt_preview}) input: {turn['in']:,} | total: {sess['in']:,} | cache: {turn_cache:,} | out: {turn['out']:,} | turn: ${turn_total:.4f} | session: ${sess['usd']:.4f}")
