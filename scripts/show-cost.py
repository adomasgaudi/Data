#!/usr/bin/env python3
"""Stop hook: token cost report."""
import json, sys
from pathlib import Path

PRICING = {
    "claude-fable-5":    (10.0, 50.0),
    "claude-opus-4":     (5.0, 25.0),
    "claude-sonnet-4":   (3.0, 15.0),
    "claude-haiku-4":    (1.0, 5.0),
}

# The plan is a flat-fee subscription, so the per-token dollar figure is THEORETICAL
# (what these tokens would cost at API pricing). We also show it in € and as a % of
# the weekly share of the subscription — the meaningful "fraction of my weekly plan
# used" number for a flat-fee plan. Adjust these three constants if anything changes.
USD_TO_EUR = 0.92                  # rough USD -> EUR; nudge if the rate drifts
MONTHLY_SUBSCRIPTION_EUR = 180.0   # the plan's monthly price (4x plan)
WEEKLY_SUBSCRIPTION_EUR = MONTHLY_SUBSCRIPTION_EUR * 12 / 52  # ~= EUR 41.54 / week

# REAL-USAGE calibration (the dollar figures above are API LIST price — a retail
# ceiling, ~100x what a flat, never-maxed subscription actually spends). OUTPUT tokens
# are the honest meter — cache-reads inflate the raw count ~100x but barely touch
# limits. Full explanation + how to (re)measure: docs/cost-model.md.
#
# OUTPUT tokens that ≈ one full 5h window, PER MODEL — the cheaper the model, the more
# generous the window, so each model needs its own anchor. Opus is MEASURED (2026-06-13:
# ~52k output moved the Max-20x 5h Opus limit ~1%, weekly ~0%); the rest are ESTIMATES
# until a session on that model re-measures and updates its row (see docs/cost-model.md).
OUTPUT_TOKENS_PER_5H_WINDOW_BY_MODEL = {
    "claude-opus":   5_200_000,    # MEASURED 2026-06-13 (~52k output ≈ 1% of a 5h window)
    "claude-sonnet": 26_000_000,   # ESTIMATE ≈ 5x Opus (Sonnet ~5x cheaper output)
    "claude-haiku":  50_000_000,   # ESTIMATE ≈ 10x Opus (Haiku is far more generous)
    "claude-fable":  3_000_000,    # ESTIMATE — pricier than Opus, so a smaller window
}
def output_per_5h(model):
    for k, v in OUTPUT_TOKENS_PER_5H_WINDOW_BY_MODEL.items():
        if model.startswith(k): return v
    return 5_200_000  # safe default = Opus
WEEKLY_WINDOWS = 168 / 5                   # ~33.6 rolling 5h windows in a week

def real_eur(output_tokens, model):
    """Honest cost: what share of the flat weekly fee this output represents, via the
    per-model 5h-window anchor (NOT API list price). e.g. for Opus ~52k output -> ~1%
    of a 5h window -> ~0.03% of the week -> ~€0.01."""
    frac_week = (output_tokens / output_per_5h(model)) / WEEKLY_WINDOWS
    return frac_week * WEEKLY_SUBSCRIPTION_EUR

def pct_5h(output_tokens, model):
    return output_tokens / output_per_5h(model) * 100

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
if len(prompt_preview) > 40:
    prompt_preview = prompt_preview[:37] + "..."

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

model = calls[-1][0] if calls else "unknown"
pin, pout = price(model)

# Last 10 turns sparkline
sparkline_chars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]
last_10_costs = []
for i in range(max(0, len(prompts) - 10), len(prompts)):
    p_idx = prompts[i][2]
    next_idx = prompts[i + 1][2] if i + 1 < len(prompts) else len(calls)
    t = tally(calls[p_idx:next_idx])
    last_10_costs.append(t["usd"])

if last_10_costs:
    max_cost = max(last_10_costs) or 0.01
    sparkline = "".join(
        sparkline_chars[int(min(7, c / max_cost * 8))] if c > 0 else "▁"
        for c in last_10_costs
    )
else:
    sparkline = ""

# Cache costs
cache_read_cost = (turn["cr"] / 1e6) * pin * 0.1
cache_write_cost = (turn["cw"] / 1e6) * pin * 1.25

# Format with appropriate sig figs (2-4 max)
def fmt_cost(x):
    if x < 0.001: return f"${x:.4f}"
    elif x < 0.1: return f"${x:.4f}"
    else: return f"${x:.2f}"

def fmt_eur(x):
    return f"€{x:.4f}" if x < 0.1 else f"€{x:.2f}"

# API LIST value (retail ceiling) ...
turn_eur = turn["usd"] * USD_TO_EUR
sess_eur = sess["usd"] * USD_TO_EUR
# ... vs the REAL figures from the measured limit anchor (what actually moves).
turn_real = real_eur(turn["out"], model)
sess_real = real_eur(sess["out"], model)
turn_5h = pct_5h(turn["out"], model)
sess_5h = pct_5h(sess["out"], model)
_ms = model.lower()
model_short = ("Opus" if "opus" in _ms else "Haiku" if "haiku" in _ms else
               "Sonnet" if "sonnet" in _ms else "Fable" if "fable" in _ms else model)
anchor_note = "measured" if "opus" in _ms else "ESTIMATE — re-measure on this model"

print(f"""
prompt #{last_prompt_num}: {prompt_preview}

input tokens:      {turn['in']:>8,}  (fresh input)
cumulative input:  {sess['in']:>8,}  (all prompts)

cache tokens:      {turn['cr'] + turn['cw']:>8,}  (total, ~99% cache-reads — barely touch limits)
output tokens:     {turn['out']:>8,}  (the honest meter)

model:             {model}

REAL cost (vs the limits you actually pay for · anchor: {anchor_note}):
  this turn:       {fmt_eur(turn_real)}   (~{turn_5h:.1f}% of a 5h {model_short} window · ~{turn_5h/WEEKLY_WINDOWS:.2f}% of weekly)
  session so far:  {fmt_eur(sess_real)}   ({sess['out']:,} output tok over all prompts in this transcript)
  trend (10):      {sparkline}

API list value (retail CEILING — NOT what a flat plan costs; ~100x real):
  this turn:       {fmt_cost(turn['usd'])} / {fmt_eur(turn_eur)}
  session:         ${sess['usd']:.2f} / {fmt_eur(sess_eur)}
  ({model_short} list ${pin:.0f}/{pout:.0f} per Mtok; plan = €{MONTHLY_SUBSCRIPTION_EUR:.0f}/mo flat · see docs/cost-model.md)
""")
