#!/usr/bin/env python3
"""Stop hook with graph: cost report + ASCII visualizations."""
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
prompts = []
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
                    prompts.append((prompt_count, c, len(calls)))
            m = d.get("message") or {}
            if d.get("type") == "assistant" and m.get("usage"):
                calls.append((m.get("model", ""), m["usage"]))
except Exception:
    sys.exit(0)

if not calls or not prompts: sys.exit(0)

last_prompt_num = prompts[-1][0]
prompt_text = prompts[-1][1]
prompt_idx = prompts[-1][2]

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

# Build per-turn cost history for sparkline (last 15 turns)
turn_costs = []
for i in range(len(prompts) - min(15, len(prompts)), len(prompts)):
    p_num, p_text, p_idx = prompts[i]
    if i + 1 < len(prompts):
        next_idx = prompts[i + 1][2]
    else:
        next_idx = len(calls)
    t = tally(calls[p_idx:next_idx])
    turn_costs.append(t["usd"])

# Sparkline: scale costs to 0-8 (heights for ▁▂▃▄▅▆▇█)
sparkline_chars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]
if turn_costs:
    max_cost = max(turn_costs) or 0.01
    sparkline = "".join(
        sparkline_chars[int(min(7, c / max_cost * 8))] if c > 0 else "▁"
        for c in turn_costs
    )
else:
    sparkline = ""

# Token breakdown bar (proportion of this turn's tokens)
total_turn_tokens = turn["in"] + turn["cr"] + turn["cw"] + turn["out"]
if total_turn_tokens > 0:
    in_w = max(1, int(turn["in"] / total_turn_tokens * 30))
    cr_w = max(1, int(turn["cr"] / total_turn_tokens * 30))
    cw_w = max(1, int(turn["cw"] / total_turn_tokens * 30))
    out_w = max(1, int(turn["out"] / total_turn_tokens * 30))
    # Normalize if over 30
    total_w = in_w + cr_w + cw_w + out_w
    if total_w > 30:
        in_w = int(in_w * 30 / total_w)
        cr_w = int(cr_w * 30 / total_w)
        cw_w = int(cw_w * 30 / total_w)
        out_w = 30 - in_w - cr_w - cw_w
    token_bar = ("█" * in_w + "▓" * cr_w + "▒" * cw_w + "░" * out_w)[:30]
else:
    token_bar = ""

# Summary line
summary = f"  #{last_prompt_num} ({prompt_preview}) input: {turn['in']:,} | total: {sess['in']:,} | cache: {turn_cache:,} | out: {turn['out']:,} | turn: ${turn['usd']:.4f} | session: ${sess['usd']:.4f}"

# Graph section
graph = ""
if token_bar:
    graph += f"\n  tokens  {token_bar} "
    graph += f"(in:{turn['in']:,} cr:{turn['cr']:,} cw:{turn['cw']:,} out:{turn['out']:,})"
if sparkline:
    graph += f"\n  cost ↗  {sparkline}"

print(summary + graph)
