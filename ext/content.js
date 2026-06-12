/**
 * Claude HTML Renderer Extension
 *
 * Look for code blocks with `<!-- RENDER -->` marker and render them as live HTML.
 * Usage: I output a code block starting with <!-- RENDER -->
 * The extension finds it, extracts the HTML, and renders it inline.
 */

function scanAndRenderHTML() {
  // Find all code blocks in the chat
  const codeBlocks = document.querySelectorAll('pre code, pre');

  codeBlocks.forEach(block => {
    // Skip if already processed
    if (block.dataset.renderProcessed) return;

    let code = block.textContent || block.innerText;

    // Look for RENDER marker
    if (!code.includes('<!-- RENDER -->')) return;

    block.dataset.renderProcessed = 'true';

    // Extract HTML (remove the marker)
    const html = code.replace('<!-- RENDER -->', '').trim();

    // Validate it's HTML-like
    if (!html.startsWith('<')) return;

    // Create container for rendered output
    const container = document.createElement('div');
    container.className = 'claude-html-render';

    // Create toggle button
    const toggle = document.createElement('button');
    toggle.className = 'claude-render-toggle';
    toggle.textContent = '▼ Preview';
    toggle.setAttribute('aria-label', 'Toggle HTML preview');

    const preview = document.createElement('div');
    preview.className = 'claude-render-preview';

    // Sandbox: create isolated iframe or use shadow DOM
    // For safety, use iframe with srcdoc
    const iframe = document.createElement('iframe');
    iframe.className = 'claude-render-iframe';
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.srcdoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; }
          canvas { max-width: 100%; }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;

    preview.appendChild(iframe);

    // Toggle visibility
    toggle.addEventListener('click', () => {
      const isOpen = preview.classList.toggle('open');
      toggle.textContent = isOpen ? '▲ Preview' : '▼ Preview';
    });

    container.appendChild(toggle);
    container.appendChild(preview);

    // Insert before code block
    block.parentElement.insertBefore(container, block);
  });
}

// Scan on load
scanAndRenderHTML();

// Scan when new messages appear (using MutationObserver)
const observer = new MutationObserver(mutations => {
  // Debounce to avoid scanning too often
  clearTimeout(observer.scanTimeout);
  observer.scanTimeout = setTimeout(() => {
    scanAndRenderHTML();
  }, 500);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log('✓ Claude HTML Renderer loaded');
