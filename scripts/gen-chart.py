#!/usr/bin/env python3
"""Generate interactive cost chart HTML from transcript."""
import json
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

try:
    projects_dir = Path.home() / ".claude" / "projects"
    jsonl_files = list(projects_dir.rglob("*.jsonl"))
    if not jsonl_files: exit(0)
    path = max(jsonl_files, key=lambda f: f.stat().st_mtime)

    calls = []
    prompts = []
    prompt_count = 0

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

    turn_data = []
    cumulative = 0.0
    for i in range(len(prompts)):
        p_num, p_text, p_idx = prompts[i]
        next_idx = prompts[i + 1][2] if i + 1 < len(prompts) else len(calls)
        
        turn_cost = 0.0
        turn_tokens = {"in": 0, "cr": 0, "cw": 0, "out": 0}
        for model, u in calls[p_idx:next_idx]:
            turn_cost += cost(u, model)
            turn_tokens["in"]  += u.get("input_tokens", 0)
            turn_tokens["cr"]  += u.get("cache_read_input_tokens", 0)
            turn_tokens["cw"]  += u.get("cache_creation_input_tokens", 0)
            turn_tokens["out"] += u.get("output_tokens", 0)
        
        cumulative += turn_cost
        words = p_text.split()[:3]
        preview = " ".join(words)
        if len(preview) > 20:
            preview = preview[:17] + "..."
        
        turn_data.append({
            "num": p_num,
            "text": preview,
            "turn_cost": turn_cost,
            "cumulative": cumulative,
            "tokens": turn_tokens,
            "model": calls[p_idx][0] if p_idx < len(calls) else "unknown"
        })

    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Claude Session Cost Analysis</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
        h1 {{ color: #333; }}
        .stats {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }}
        .stat {{ background: #f9f9f9; padding: 15px; border-radius: 6px; border-left: 4px solid #284e86; }}
        .stat-label {{ font-size: 0.9em; color: #666; }}
        .stat-value {{ font-size: 1.8em; font-weight: bold; color: #284e86; margin-top: 5px; }}
        .chart-container {{ position: relative; height: 300px; margin: 30px 0; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 30px; }}
        th {{ background: #f0f0f0; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }}
        td {{ padding: 10px; border-bottom: 1px solid #eee; }}
        tr:hover {{ background: #f9f9f9; }}
        .model {{ font-size: 0.85em; color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>💰 Claude Session Cost Analysis</h1>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-label">Total Session Cost</div>
                <div class="stat-value">${turn_data[-1]['cumulative']:.4f}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Total Prompts</div>
                <div class="stat-value">{len(turn_data)}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Avg Cost/Turn</div>
                <div class="stat-value">${turn_data[-1]['cumulative'] / len(turn_data) if turn_data else 0:.4f}</div>
            </div>
            <div class="stat">
                <div class="stat-label">Most Expensive</div>
                <div class="stat-value">${max(d['turn_cost'] for d in turn_data):.4f}</div>
            </div>
        </div>
        
        <div class="chart-container">
            <canvas id="costChart"></canvas>
        </div>
        
        <div class="chart-container">
            <canvas id="tokenChart"></canvas>
        </div>
        
        <h2>Details</h2>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Prompt</th>
                    <th>Model</th>
                    <th>Input</th>
                    <th>Cache</th>
                    <th>Output</th>
                    <th>Turn Cost</th>
                    <th>Cumulative</th>
                </tr>
            </thead>
            <tbody>
"""

    for d in turn_data:
        html += f"""                <tr>
                    <td>#{d['num']}</td>
                    <td>{d['text']}</td>
                    <td class="model">{d['model']}</td>
                    <td>{d['tokens']['in']:,}</td>
                    <td>{d['tokens']['cr'] + d['tokens']['cw']:,}</td>
                    <td>{d['tokens']['out']:,}</td>
                    <td>${d['turn_cost']:.4f}</td>
                    <td>${d['cumulative']:.4f}</td>
                </tr>
"""

    html += """            </tbody>
        </table>
    </div>
    
    <script>
        const turnCosts = [""" + ", ".join(f"{d['turn_cost']:.6f}" for d in turn_data) + """];
        const cumulative = [""" + ", ".join(f"{d['cumulative']:.6f}" for d in turn_data) + """];
        const labels = [""" + ", ".join(f'"{d["num"]}"' for d in turn_data) + """];
        const models = [""" + ", ".join(f'"{d["model"]}"' for d in turn_data) + """];
        const colors = models.map(m => {
            if (m.includes('fable')) return '#d946ef';
            if (m.includes('opus')) return '#0ea5e9';
            if (m.includes('sonnet')) return '#f59e0b';
            if (m.includes('haiku')) return '#10b981';
            return '#6b7280';
        });
        
        new Chart(document.getElementById('costChart'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Turn Cost',
                        data: turnCosts,
                        backgroundColor: colors,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Cumulative Cost',
                        data: cumulative,
                        type: 'line',
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        yAxisID: 'y1',
                        tension: 0.3
                    }
                ]
            },
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                interaction: {{ mode: 'index', intersect: false }},
                plugins: {{
                    legend: {{ display: true }},
                    title: {{ display: true, text: 'Cost Per Turn + Cumulative' }}
                }},
                scales: {{
                    y: {{ type: 'linear', position: 'left', title: {{ display: true, text: 'Turn Cost ($)' }} }},
                    y1: {{ type: 'linear', position: 'right', title: {{ display: true, text: 'Cumulative ($)' }}, grid: {{ drawOnChartArea: false }} }}
                }}
            }}
        });
        
        new Chart(document.getElementById('tokenChart'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Fresh Input',
                        data: [""" + ", ".join(f"{d['tokens']['in']}" for d in turn_data) + """],
                        backgroundColor: '#3b82f6'
                    },
                    {
                        label: 'Cache Read',
                        data: [""" + ", ".join(f"{d['tokens']['cr']}" for d in turn_data) + """],
                        backgroundColor: '#10b981'
                    },
                    {
                        label: 'Cache Write',
                        data: [""" + ", ".join(f"{d['tokens']['cw']}" for d in turn_data) + """],
                        backgroundColor: '#f59e0b'
                    },
                    {
                        label: 'Output',
                        data: [""" + ", ".join(f"{d['tokens']['out']}" for d in turn_data) + """],
                        backgroundColor: '#8b5cf6'
                    }
                ]
            },
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{
                    legend: {{ display: true }},
                    title: {{ display: true, text: 'Token Usage Breakdown' }}
                }},
                scales: {{ x: {{ stacked: true }}, y: {{ stacked: true, title: {{ display: true, text: 'Tokens' }} }} }}
            }}
        });
    </script>
</body>
</html>"""

    out = Path("/home/user/Data/cost-report.html")
    out.write_text(html)

except Exception:
    pass
