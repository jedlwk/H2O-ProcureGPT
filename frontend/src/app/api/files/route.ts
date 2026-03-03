import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

const SPREADSHEET_EXTS = new Set(['xlsx', 'xls', 'csv', 'ods'])

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : ''
}

function esc(v: unknown): string {
  if (v == null) return ''
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function colLetter(idx: number): string {
  let s = ''
  let n = idx
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  }
  return s
}

function spreadsheetToHtml(buffer: ArrayBuffer): string {
  const wb = XLSX.read(buffer, { type: 'array' })

  const sheetHtmls: string[] = []

  wb.SheetNames.forEach((name, sheetIdx) => {
    const ws = wb.Sheets[name]
    const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    if (data.length === 0) return

    const maxCols = data.reduce((m, row) => Math.max(m, row.length), 0)

    // Build column header row
    let colHeaders = '<th class="corner"></th>'
    for (let c = 0; c < maxCols; c++) {
      colHeaders += `<th class="col-hdr">${colLetter(c)}</th>`
    }

    // Build data rows
    const rows = data.map((row, r) => {
      let cells = `<td class="row-num">${r + 1}</td>`
      for (let c = 0; c < maxCols; c++) {
        const val = c < row.length ? row[c] : ''
        const isEmpty = val === '' || val == null
        const isNum = typeof val === 'number'
        cells += `<td${isNum ? ' class="num"' : ''}>${isEmpty ? '' : esc(val)}</td>`
      }
      return `<tr>${cells}</tr>`
    }).join('\n')

    sheetHtmls.push(
      `<div class="sheet${sheetIdx === 0 ? ' active' : ''}" data-sheet="${sheetIdx}">` +
      `<table><thead><tr>${colHeaders}</tr></thead><tbody>${rows}</tbody></table></div>`
    )
  })

  // Sheet tabs
  const tabs = wb.SheetNames.length > 1
    ? `<div class="tab-bar">${wb.SheetNames.map((n, i) =>
        `<button class="tab${i === 0 ? ' active' : ''}" data-idx="${i}">${esc(n)}</button>`
      ).join('')}</div>`
    : ''

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
:root {
  --bg: #0f1117;
  --surface: #161822;
  --surface2: #1c1e2e;
  --border: #252839;
  --border-strong: #2f3347;
  --text: #c9cdd6;
  --text-dim: #6b7189;
  --accent: #6366f1;
  --accent-bg: rgba(99,102,241,0.06);
  --header-bg: #1a1c2b;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  height: 100%; overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg); color: var(--text);
}
body { display: flex; flex-direction: column; }

/* Scrollable grid area */
.sheet {
  display: none; flex: 1; overflow: auto;
}
.sheet.active { display: block; }

table {
  border-collapse: collapse; font-size: 13px; line-height: 1.4;
  /* Let columns size to content */
}

thead { position: sticky; top: 0; z-index: 3; }

/* Column headers (A, B, C) */
th.col-hdr {
  background: var(--header-bg); color: var(--text-dim);
  font-weight: 500; font-size: 11px; text-align: center;
  padding: 5px 12px; border: 1px solid var(--border);
  border-bottom: 2px solid var(--border-strong);
  white-space: nowrap; min-width: 80px;
  position: sticky; top: 0; z-index: 2;
}

/* Corner cell (top-left) */
th.corner {
  background: var(--header-bg); border: 1px solid var(--border);
  border-bottom: 2px solid var(--border-strong);
  border-right: 2px solid var(--border-strong);
  width: 46px; min-width: 46px;
  position: sticky; top: 0; left: 0; z-index: 4;
}

/* Row numbers */
td.row-num {
  background: var(--header-bg); color: var(--text-dim);
  font-size: 11px; text-align: center; font-weight: 400;
  padding: 4px 6px; width: 46px; min-width: 46px;
  border: 1px solid var(--border);
  border-right: 2px solid var(--border-strong);
  position: sticky; left: 0; z-index: 1;
}

/* Data cells */
td {
  background: var(--surface); color: var(--text);
  padding: 4px 10px; border: 1px solid var(--border);
  white-space: pre-wrap; word-break: break-word;
  max-width: 400px; vertical-align: top;
}
td.num { text-align: right; font-variant-numeric: tabular-nums; }

/* Hover */
tr:hover td { background: var(--surface2); }
tr:hover td.row-num { background: #1e2035; }

/* Clickable cell highlight */
td.selected {
  outline: 2px solid var(--accent); outline-offset: -1px;
  background: var(--accent-bg);
}
.col-hdr.selected-col { background: #1e2040; color: #8b8fce; }
td.row-num.selected-row { background: #1e2040; color: #8b8fce; }

/* Sheet tabs */
.tab-bar {
  display: flex; align-items: center; gap: 0;
  background: var(--header-bg); border-top: 1px solid var(--border);
  padding: 0 4px; flex-shrink: 0; height: 32px; overflow-x: auto;
}
.tab {
  background: transparent; border: none; color: var(--text-dim);
  font-size: 12px; padding: 6px 16px; cursor: pointer;
  border-bottom: 2px solid transparent; white-space: nowrap;
  transition: all 0.15s;
}
.tab:hover { color: var(--text); background: var(--surface2); }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); background: var(--surface); }

/* Cell reference bar */
.ref-bar {
  display: flex; align-items: center; gap: 8px;
  background: var(--header-bg); border-bottom: 1px solid var(--border);
  padding: 0 8px; height: 28px; flex-shrink: 0;
}
.ref-cell {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 3px; padding: 2px 8px; font-size: 11px;
  color: var(--accent); font-weight: 600; min-width: 48px; text-align: center;
}
.ref-value {
  font-size: 12px; color: var(--text); flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
</style></head><body>

<div class="ref-bar">
  <span class="ref-cell" id="refCell">A1</span>
  <span class="ref-value" id="refValue"></span>
</div>

${sheetHtmls.join('\n')}
${tabs}

<script>
// Sheet tab switching
document.querySelectorAll('.tab').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var idx = this.dataset.idx;
    document.querySelectorAll('.sheet').forEach(function(s) { s.classList.toggle('active', s.dataset.sheet === idx); });
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.toggle('active', t.dataset.idx === idx); });
  });
});

// Cell selection
var lastSelected = null;
var lastColHdr = null;
var lastRowNum = null;
document.querySelectorAll('.sheet tbody td:not(.row-num)').forEach(function(td) {
  td.addEventListener('click', function() {
    if (lastSelected) lastSelected.classList.remove('selected');
    if (lastColHdr) lastColHdr.classList.remove('selected-col');
    if (lastRowNum) lastRowNum.classList.remove('selected-row');

    td.classList.add('selected');
    lastSelected = td;

    var tr = td.parentElement;
    var cellIdx = Array.from(tr.children).indexOf(td) - 1; // subtract row-num col
    var rowIdx = Array.from(tr.parentElement.children).indexOf(tr);

    // Highlight column header
    var thead = tr.closest('table').querySelector('thead tr');
    if (thead && thead.children[cellIdx + 1]) {
      thead.children[cellIdx + 1].classList.add('selected-col');
      lastColHdr = thead.children[cellIdx + 1];
    }

    // Highlight row number
    var rowNum = tr.children[0];
    if (rowNum) { rowNum.classList.add('selected-row'); lastRowNum = rowNum; }

    // Update reference bar
    document.getElementById('refCell').textContent = colLabel(cellIdx) + (rowIdx + 1);
    document.getElementById('refValue').textContent = td.textContent;
  });
});

function colLabel(idx) {
  var s = '';
  var n = idx;
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
}
</script>
</body></html>`
}

export async function GET(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get('name')
  if (!filename) {
    return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 })
  }

  const upstream = await fetch(
    `${API_BASE}/api/upload/files/${encodeURIComponent(filename)}`,
  )

  if (!upstream.ok) {
    return NextResponse.json({ error: 'File not found' }, { status: upstream.status })
  }

  const ext = getExtension(filename)

  // Spreadsheets: convert to HTML so they render inline in the iframe
  if (SPREADSHEET_EXTS.has(ext)) {
    try {
      const buffer = await upstream.arrayBuffer()
      const html = spreadsheetToHtml(buffer)
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    } catch {
      // Fall through to raw passthrough
    }
  }

  // PDFs and everything else: pass through as-is
  const blob = await upstream.blob()
  return new NextResponse(blob, {
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Disposition': 'inline',
    },
  })
}
