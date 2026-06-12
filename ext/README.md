# Claude HTML Renderer Extension

A browser extension that renders HTML code blocks in Claude chat as live previews.

## How it works

1. I output HTML code in a code block starting with `<!-- RENDER -->`
2. The extension detects it
3. A collapsible preview appears showing the rendered HTML

## Installation

### Chrome / Edge

1. Go to `chrome://extensions` or `edge://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this `ext/` folder
5. The extension appears in your toolbar

### Firefox

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select the `manifest.json` file in this folder
4. Done (temporary, reloads when you restart Firefox)

For permanent Firefox installation:
- Package as `.xpi` and submit to Mozilla Add-ons (requires signing)
- Or: edit `manifest.json` to add `"browser_specific_settings"` with `gecko_id`

## Usage

When I output HTML like this in a code block:

````
```html
<!-- RENDER -->
<!DOCTYPE html>
<html>
<head>
  <title>Chart</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div style="height: 300px">
    <canvas id="myChart"></canvas>
  </div>
  <script>
    new Chart(document.getElementById('myChart'), {
      type: 'bar',
      data: { labels: ['A','B','C'], datasets: [{ label: 'Data', data: [10,20,30] }] }
    });
  </script>
</body>
</html>
```
````

The extension will:
1. Find the code block
2. Add a **Preview** button above it
3. Click to expand and see the rendered HTML

## Security

- HTML is rendered in an **iframe with sandbox**, so scripts can't access Claude's page
- External CDNs (Chart.js, etc.) are allowed via `<script src>`
- No access to your data, history, or API key

## Troubleshooting

- **Extension not working?** Make sure Developer mode is on, and the extension is enabled in your Extensions menu
- **Preview not showing?** Refresh the page, or click the extension icon → check if it's active
- **Scripts not running?** Make sure the `<!-- RENDER -->` marker is on the first line of the HTML block
