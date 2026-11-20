// Turn a Markdown file into an HTML page you can open in a browser:
// tables formatted, ```mermaid diagrams drawn. Writes <file>.html next to it
// and opens it.
//   npm run md -- docs/portal-module-map.md
//   npm run md -- CHANGELOG.md
// The page loads its Markdown / diagram libraries from a CDN, so it needs internet.
const fs = require('node:fs');
const path = require('node:path');
const { exec } = require('node:child_process');

const input = process.argv[2];
if (!input || !fs.existsSync(input)) {
  console.error('Usage: npm run md -- <file.md>');
  process.exit(1);
}

const md = fs.readFileSync(input, 'utf8');
const title = (md.match(/^#\s+(.+)$/m) ?? [, path.basename(input)])[1];
const output = input.replace(/\.md$/i, '') + '.html';

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.replace(/</g, '&lt;')}</title>
<style>
  :root { --bg:#f6f7f4; --card:#fff; --ink:#1f2a1a; --muted:#66705f; --line:#dde2d6; --brand:#5f7f12; }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.55 "Segoe UI", Arial, sans-serif; }
  main { max-width:1100px; margin:0 auto; padding:24px 16px 60px; background:var(--card); }
  h1 { color:#1c3144; } h2 { color:var(--brand); border-bottom:1px solid var(--line); padding-bottom:4px; margin-top:32px; }
  h3 { color:#1c3144; }
  table { border-collapse:collapse; width:100%; margin:12px 0; font-size:14px; display:block; overflow-x:auto; }
  th, td { border:1px solid var(--line); padding:6px 9px; vertical-align:top; text-align:left; }
  th { background:#eef1e8; }
  tr:nth-child(even) td { background:#fafbf8; }
  code { background:#eef1e8; padding:1px 5px; border-radius:4px; font-family:Consolas, monospace; font-size:13px; }
  pre { background:#1f2a1a; color:#e8eddf; padding:12px; border-radius:6px; overflow-x:auto; }
  pre code { background:none; color:inherit; padding:0; }
  .mermaid { background:#fff; text-align:center; margin:14px 0; }
  a { color:#1c4f9c; }
  details { margin:12px 0; }
</style></head>
<body><main id="content">Loading…</main>
<script id="md" type="text/markdown">${md.replace(/<\/script/gi, '<\\/script')}</script>
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
<script>
  const renderer = new marked.Renderer();
  const code = renderer.code.bind(renderer);
  renderer.code = (text, lang) => lang === 'mermaid' ? '<pre class="mermaid">' + text + '</pre>' : code(text, lang);
  // heading ids like GitHub, so the changelog's links work
  renderer.heading = (text, level, raw) => {
    const id = raw.toLowerCase().replace(/[^\\w\\s-]/g, '').trim().replace(/\\s/g, '-');
    return '<h' + level + ' id="' + id + '">' + text + '</h' + level + '>';
  };
  document.getElementById('content').innerHTML = marked.parse(document.getElementById('md').textContent, { renderer });
  mermaid.initialize({ startOnLoad: false, theme: 'default' });
  mermaid.run({ querySelector: '.mermaid' });
</script>
</body></html>
`;

fs.writeFileSync(output, html, 'utf8');
console.log(`Wrote ${output}`);
const opener = process.platform === 'win32' ? `start "" "${output}"` : process.platform === 'darwin' ? `open "${output}"` : `xdg-open "${output}"`;
exec(opener);
