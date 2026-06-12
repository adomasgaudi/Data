#!/usr/bin/env python3
"""
Claude chat with per-prompt token cost display.
Usage: ANTHROPIC_API_KEY=sk-... python3 chat.py
"""
import os
import anthropic

# Pricing per million tokens (update if models change)
PRICING = {
    "claude-opus-4-8":   {"input": 5.00,  "output": 25.00},
    "claude-sonnet-4-6": {"input": 3.00,  "output": 15.00},
    "claude-haiku-4-5":  {"input": 1.00,  "output":  5.00},
    "claude-fable-5":    {"input": 10.00, "output": 50.00},
}

MODEL = "claude-sonnet-4-6"
PRICE = PRICING[MODEL]

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

history = []
session_input  = 0
session_output = 0
session_cache_read   = 0
session_cache_write  = 0

def cost(tokens: int, rate_per_million: float) -> float:
    return tokens / 1_000_000 * rate_per_million

def print_usage(usage):
    global session_input, session_output, session_cache_read, session_cache_write

    inp   = usage.input_tokens
    out   = usage.output_tokens
    cr    = getattr(usage, "cache_read_input_tokens",    0) or 0
    cw    = getattr(usage, "cache_creation_input_tokens", 0) or 0

    session_input        += inp
    session_output       += out
    session_cache_read   += cr
    session_cache_write  += cw

    # Cache reads are billed at ~10% of input rate; writes at 125%
    inp_cost = cost(inp, PRICE["input"])
    out_cost = cost(out, PRICE["output"])
    cr_cost  = cost(cr,  PRICE["input"] * 0.10)
    cw_cost  = cost(cw,  PRICE["input"] * 1.25)
    turn_total = inp_cost + out_cost + cr_cost + cw_cost

    sess_total = (
        cost(session_input,       PRICE["input"])
      + cost(session_output,      PRICE["output"])
      + cost(session_cache_read,  PRICE["input"] * 0.10)
      + cost(session_cache_write, PRICE["input"] * 1.25)
    )

    print(f"\n  ┌─ tokens ──────────────────────────────────────────")
    print(f"  │  input:        {inp:>7,}   ${inp_cost:.6f}")
    if cr: print(f"  │  cache read:   {cr:>7,}   ${cr_cost:.6f}  (0.1× input rate)")
    if cw: print(f"  │  cache write:  {cw:>7,}   ${cw_cost:.6f}  (1.25× input rate)")
    print(f"  │  output:       {out:>7,}   ${out_cost:.6f}")
    print(f"  │  ── this turn: {'':>7}   ${turn_total:.6f}")
    print(f"  └─ session total: ${sess_total:.6f}")
    print()

print(f"Claude chat — {MODEL}  (Ctrl+C or type 'exit' to quit)\n")

while True:
    try:
        user_input = input("You: ").strip()
    except (KeyboardInterrupt, EOFError):
        print("\nBye.")
        break

    if user_input.lower() in ("exit", "quit", "bye"):
        print("Bye.")
        break
    if not user_input:
        continue

    history.append({"role": "user", "content": user_input})

    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=history,
    )

    reply = response.content[0].text
    history.append({"role": "assistant", "content": reply})

    print(f"\nClaude: {reply}")
    print_usage(response.usage)
