const summarizeBtn = document.getElementById('summarizeBtn');
const optionsBtn = document.getElementById('optionsBtn');
const output = document.getElementById('output');
const statusEl = document.createElement('div'); // live timer / status line
statusEl.id = 'status';
output.before(statusEl);

/* ------------------------------------------------------------------ */
/* Settings panel (inline, slides down under the toolbar)             */
/* ------------------------------------------------------------------ */
const settingsEl = document.getElementById('settings');
const apiKeyInput = document.getElementById('apiKey');
const sessionOnlyCheck = document.getElementById('sessionOnly');
const routingSelect = document.getElementById('routing');
const routingHint = document.getElementById('routingHint');
const modelField = document.getElementById('modelField');
const modelSelect = document.getElementById('modelSelect');
const customModelInput = document.getElementById('customModel');
const thinkingSelect = document.getElementById('thinkingLevel');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const settingsMsg = document.getElementById('settingsMsg');
const KEY_MASK = '********';

const ROUTING_HINTS = {
  auto: 'Technical or long pages use Gemini 3.8, then 3.6 Flash. Everything else uses 3.5, then 3.1 Flash-Lite.',
  light: 'Always use 3.5, then 3.1 Flash-Lite. Fastest and easiest on quota.',
  strong: 'Try 3.8, then 3.6 Flash first, then fall back to the Flash-Lite models.',
  manual: 'Use only the model chosen below.'
};

function toggleSettings(open) {
  const willOpen = open === undefined ? !settingsEl.classList.contains('open') : open;
  settingsEl.classList.toggle('open', willOpen);
  optionsBtn.classList.toggle('open', willOpen);
  optionsBtn.setAttribute('aria-expanded', String(willOpen));
}
optionsBtn.addEventListener('click', () => toggleSettings());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleSettings(false); });

function syncSettingsUI() {
  routingHint.textContent = ROUTING_HINTS[routingSelect.value] || '';
  modelField.hidden = routingSelect.value !== 'manual';
  customModelInput.hidden = modelSelect.value !== 'custom';
}
routingSelect.addEventListener('change', syncSettingsUI);
modelSelect.addEventListener('change', syncSettingsUI);

let settingsMsgTimer = null;
function flashSettingsMsg(text) {
  settingsMsg.textContent = text;
  clearTimeout(settingsMsgTimer);
  settingsMsgTimer = setTimeout(() => { settingsMsg.textContent = ''; }, 2200);
}

async function loadSettings() {
  try {
    const [local, ses] = await Promise.all([
      browser.storage.local.get(['apiKey', 'model', 'customModel', 'thinkingLevel', 'routing']),
      browser.storage.session.get(['apiKey'])
    ]);
    if (ses.apiKey || local.apiKey) {
      apiKeyInput.value = KEY_MASK;
      sessionOnlyCheck.checked = !!ses.apiKey;
    }
    routingSelect.value = local.routing || 'auto';
    if (local.model && [...modelSelect.options].some((o) => o.value === local.model)) {
      modelSelect.value = local.model;
    }
    customModelInput.value = local.customModel || '';
    if (local.thinkingLevel) thinkingSelect.value = local.thinkingLevel;
  } catch (_) {}
  syncSettingsUI();
}

saveBtn.addEventListener('click', async () => {
  try {
    await browser.storage.local.set({
      model: modelSelect.value,
      customModel: customModelInput.value.trim(),
      thinkingLevel: thinkingSelect.value,
      routing: routingSelect.value
    });

    const typed = apiKeyInput.value;
    if (!typed) {
      await browser.storage.local.remove(['apiKey']);
      await browser.storage.session.remove(['apiKey']);
    } else {
      // If the field still shows the mask, keep the existing key but honour the memory-only checkbox
      let key = typed;
      if (typed === KEY_MASK) {
        const s = await browser.storage.session.get('apiKey');
        const l = await browser.storage.local.get('apiKey');
        key = s.apiKey || l.apiKey;
      }
      if (key) {
        if (sessionOnlyCheck.checked) {
          await browser.storage.session.set({ apiKey: key });
          await browser.storage.local.remove(['apiKey']);
        } else {
          await browser.storage.local.set({ apiKey: key });
          await browser.storage.session.remove(['apiKey']);
        }
        apiKeyInput.value = KEY_MASK;
      }
    }
    flashSettingsMsg('Saved');
    setTimeout(() => toggleSettings(false), 600);
  } catch (e) {
    flashSettingsMsg('Could not save');
  }
});

clearBtn.addEventListener('click', async () => {
  try {
    await browser.storage.local.remove(['apiKey']);
    await browser.storage.session.remove(['apiKey']);
    apiKeyInput.value = '';
    flashSettingsMsg('Key removed');
  } catch (_) {}
});

/* ------------------------------------------------------------------ */
/* Helpers: always use textContent / DOM nodes so nothing is parsed   */
/* as HTML                                                            */
/* ------------------------------------------------------------------ */
function showMessage(text, isError = false) {
  output.textContent = '';
  const div = document.createElement('div');
  if (isError) div.className = 'error';
  div.textContent = text;
  output.appendChild(div);
}

function appendError(text) {
  const div = document.createElement('div');
  div.className = 'error';
  div.textContent = text;
  output.appendChild(div);
  output.scrollTo(0, output.scrollHeight);
}

/* ------------------------------------------------------------------ */
/* Safe Markdown renderer (builds DOM nodes; never uses innerHTML)    */
/* Supports: headings, paragraphs, bold, italic, inline code, fenced  */
/* code blocks, nested lists, task-list checkboxes, tables, quotes,   */
/* hr, http(s) links, and muted [#heading-id] references.             */
/* ------------------------------------------------------------------ */
const INLINE_SRC =
  '(`+)([^`]+?)\\1' +                       // 1,2: inline code
  '|\\*\\*(.+?)\\*\\*' +                    // 3: bold
  '|\\*([^\\s*][^*]*?)\\*' +                // 4: italic
  '|\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)' + // 5,6: link (http/https only)
  '|\\[(#[^\\]\\s]*)\\]';                   // 7: heading reference like [#setup]

function renderInline(text, parent) {
  const re = new RegExp(INLINE_SRC, 'g'); // new instance: recursion-safe
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));

    if (m[2] !== undefined) {
      const el = document.createElement('code');
      el.textContent = m[2];
      parent.appendChild(el);
    } else if (m[3] !== undefined) {
      const el = document.createElement('strong');
      renderInline(m[3], el);
      parent.appendChild(el);
    } else if (m[4] !== undefined) {
      const el = document.createElement('em');
      renderInline(m[4], el);
      parent.appendChild(el);
    } else if (m[5] !== undefined) {
      const a = document.createElement('a');
      a.href = m[6];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      renderInline(m[5], a);
      parent.appendChild(a);
    } else if (m[7] !== undefined) {
      const s = document.createElement('span');
      s.className = 'ref';
      s.textContent = m[7];
      parent.appendChild(s);
    }
    last = re.lastIndex;
  }
  if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
}

function renderMarkdown(raw, container, checked) {
  const frag = document.createDocumentFragment();
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');

  let stack = [];   // nested list state: [{ indent, list, li }]
  let para = null;  // currently open paragraph
  let quote = null; // currently open blockquote
  let cbIndex = 0;  // running checkbox index (for preserving checked state)
  let tldrBox = null; // open TL;DR callout, if any

  const indentOf = (s) => s.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
  const endFlow = () => { para = null; quote = null; };

  // Find the <li> a block with this indent belongs to; trims deeper lists off the stack.
  function attachPoint(indent) {
    let i = stack.length - 1;
    while (i >= 0 && stack[i].indent >= indent) i--;
    if (i < 0) { stack = []; return null; }
    stack.length = i + 1;
    return stack[i].li;
  }

  const splitRow = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const isTableSep = (s) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(s);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;

    // ---- Fenced code block (also handles unclosed fences while streaming)
    if ((m = line.match(/^([ \t]*)```+[ \t]*([\w+-]*)[ \t]*$/))) {
      const fenceIndent = indentOf(m[1]);
      const stripRe = new RegExp('^[ \\t]{0,' + m[1].length + '}');
      const code = [];
      i++;
      while (i < lines.length && !/^[ \t]*```+[ \t]*$/.test(lines[i])) {
        code.push(lines[i].replace(stripRe, ''));
        i++;
      }
      const pre = document.createElement('pre');
      const c = document.createElement('code');
      c.textContent = code.join('\n');
      pre.appendChild(c);
      (attachPoint(fenceIndent) || frag).appendChild(pre);
      endFlow();
      continue;
    }

    // ---- Blank line
    if (!line.trim()) { endFlow(); continue; }

    // ---- Heading
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      stack = []; endFlow();
      if (/^tl;?dr\b/i.test(m[2].trim())) {
        tldrBox = document.createElement('div');
        tldrBox.className = 'tldr';
        const lab = document.createElement('div');
        lab.className = 'tldr-label';
        lab.textContent = 'TL;DR';
        tldrBox.appendChild(lab);
        frag.appendChild(tldrBox);
        continue;
      }
      tldrBox = null;
      const h = document.createElement('h' + m[1].length);
      renderInline(m[2].trim(), h);
      if (/warn|caution|danger|caveat/i.test(m[2])) h.className = 'warn';
      frag.appendChild(h);
      continue;
    }

    // ---- Horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      stack = []; endFlow();
      tldrBox = null;
      frag.appendChild(document.createElement('hr'));
      continue;
    }

    // ---- Table
    if (/^\s*\|/.test(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      stack = []; endFlow();
      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const hr = document.createElement('tr');
      splitRow(line).forEach((cell) => {
        const th = document.createElement('th');
        renderInline(cell, th);
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      i += 2;
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const tr = document.createElement('tr');
        splitRow(lines[i]).forEach((cell) => {
          const td = document.createElement('td');
          renderInline(cell, td);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
        i++;
      }
      i--; // for-loop will increment again
      table.appendChild(tbody);
      wrap.appendChild(table);
      frag.appendChild(wrap);
      continue;
    }

    // ---- Blockquote
    if ((m = line.match(/^\s{0,3}>\s?(.*)$/))) {
      stack = []; para = null;
      if (!quote) {
        quote = document.createElement('blockquote');
        frag.appendChild(quote);
      } else {
        quote.appendChild(document.createElement('br'));
      }
      renderInline(m[1], quote);
      continue;
    }

    // ---- List item (bulleted or numbered, arbitrarily nested by indent)
    if ((m = line.match(/^([ \t]*)([-*+]|\d+[.)])\s+(.*)$/))) {
      const indent = indentOf(m[1]);
      const ordered = /\d/.test(m[2]);
      endFlow();

      while (stack.length && stack[stack.length - 1].indent > indent) stack.pop();
      let top = stack[stack.length - 1];
      if (!top || top.indent < indent) {
        const list = document.createElement(ordered ? 'ol' : 'ul');
        ((top && top.li) || tldrBox || frag).appendChild(list);
        top = { indent, list, li: null };
        stack.push(top);
      }

      const li = document.createElement('li');
      let text = m[3];
      const cb = text.match(/^\[([ xX])\]\s+(.*)$/);
      if (cb) {
        li.className = 'task';
        const box = document.createElement('input');
        box.type = 'checkbox';
        const idx = cbIndex++;
        box.checked = checked.has(idx) ? checked.get(idx) : cb[1].toLowerCase() === 'x';
        box.addEventListener('change', () => { checked.set(idx, box.checked); onCheckChange(); });
        li.appendChild(box);
        text = cb[2];
      }
      const span = document.createElement('span');
      renderInline(text, span);
      li.appendChild(span);

      top.list.appendChild(li);
      top.li = li;
      continue;
    }

    // ---- Plain text: continuation of a list item, or a paragraph
    const indent = indentOf(line);
    const text = line.trim();
    if (indent > 0 && stack.length) {
      const li = attachPoint(indent);
      if (li) {
        const div = document.createElement('div');
        renderInline(text, div);
        li.appendChild(div);
        endFlow();
        continue;
      }
    }
    stack = [];
    quote = null;
    if (para) {
      para.appendChild(document.createTextNode(' '));
      renderInline(text, para);
    } else {
      para = document.createElement('p');
      renderInline(text, para);
      (tldrBox || frag).appendChild(para);
    }
  }

  container.replaceChildren(frag);
}

/* ------------------------------------------------------------------ */
/* Streaming state: keep raw text, re-render (throttled) as it grows   */
/* ------------------------------------------------------------------ */
let mdBox = null;
let rawText = '';
let renderQueued = false;
const checkedState = new Map(); // remembers ticked checkboxes across re-renders

/* ---- Live timer (like Claude's waiting counter) ---- */
let timerId = null;
let startTime = 0;
let phase = '';
let gotFirstChunk = false;
let modelLabel = '';
function fmt(ms) {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}
function tick() { statusEl.textContent = `${phase} ${fmt(Date.now() - startTime)}${modelLabel ? ' · ' + modelLabel : ''}`; }
function setPhase(p) { phase = p; tick(); }
function startTimer(p) {
  clearInterval(timerId);
  startTime = Date.now();
  gotFirstChunk = false;
  modelLabel = '';
  setPhase(p);
  timerId = setInterval(tick, 500);
}
function stopTimer(label) {
  clearInterval(timerId);
  timerId = null;
  const ms = Date.now() - startTime;
  statusEl.textContent = `${label} ${fmt(ms)}${modelLabel ? ' · ' + modelLabel : ''}`;
  return ms;
}

/* ---- Remember summaries so closing/reopening the sidebar keeps them ---- */
const CACHE_KEY = 'pagesageCache';
let currentUrl = null;
let currentEntry = null;
async function loadCache() {
  try { return (await browser.storage.session.get(CACHE_KEY))[CACHE_KEY] || {}; } catch (_) { return {}; }
}
async function saveCache(url, entry) {
  try {
    const cache = await loadCache();
    delete cache[url];
    cache[url] = entry;
    const keys = Object.keys(cache);
    while (keys.length > 20) delete cache[keys.shift()];
    await browser.storage.session.set({ [CACHE_KEY]: cache });
  } catch (_) {}
}
function onCheckChange() {
  if (!currentUrl || !currentEntry) return;
  currentEntry.checked = [...checkedState];
  saveCache(currentUrl, currentEntry);
}

function renderNow() {
  renderQueued = false;
  if (!mdBox) return;
  const nearBottom = output.scrollHeight - output.scrollTop - output.clientHeight < 80;
  renderMarkdown(rawText, mdBox, checkedState);
  if (nearBottom) output.scrollTo(0, output.scrollHeight);
}

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(renderNow);
}

/* ------------------------------------------------------------------ */
/* Page extraction. Runs inside the page, so it must be self-contained */
/* ------------------------------------------------------------------ */
function extractPage() {
  try {
    let textContent = "";
    // HEADER removed from this list so article titles/intros inside <header> are kept
    const ignoreTags = new Set(['SCRIPT', 'STYLE', 'NAV', 'FOOTER', 'ASIDE', 'NOSCRIPT', 'IFRAME', 'SVG']);

    // Only keep heading IDs a human would recognise as a section anchor.
    // Drops framework-generated IDs (React/Radix like "_r_1kt_" or ":r1:"),
    // hash-like IDs, and generic page-title IDs (MediaWiki "firstHeading").
    function usefulId(id) {
      if (!id || id.length < 3) return false;
      if (/^[_:]/.test(id) || id.includes('_r_')) return false;
      if (/^(radix|react|headlessui|mantine|ember|ng-)/i.test(id)) return false;
      if (/^[0-9a-f-]{12,}$/i.test(id)) return false;
      if (/^(firstHeading|content|top|main|title)$/i.test(id)) return false;
      return true;
    }

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue.replace(/\s+/g, ' ');
        if (text.trim()) textContent += text + ' ';
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName.toUpperCase();
      if (ignoreTags.has(tag)) return;

      // Block code: fenced
      if (tag === 'PRE') {
        textContent += `\n\`\`\`\n${node.textContent || ''}\n\`\`\`\n`;
        return;
      }
      // Inline code: single backticks (CODE inside PRE is already handled above)
      if (tag === 'CODE') {
        textContent += `\`${node.textContent || ''}\` `;
        return;
      }
      // Headings: only add the [#id] reference when an id actually exists
      if (/^H[1-6]$/.test(tag)) {
        const headingText = (node.textContent || '').trim();
        textContent += `\n\n# ${headingText}${usefulId(node.id) ? ` [#${node.id}]` : ''}\n\n`;
        return;
      }

      if (tag === 'LI') textContent += '\n- ';
      if (tag === 'P' || tag === 'DIV' || tag === 'TABLE') textContent += '\n';

      // Safe class check to prevent SVG className errors
      const className = (typeof node.className === 'string' ? node.className : '').toLowerCase();
      if (className.includes('warning') || className.includes('alert')) textContent += ' [WARNING] ';
      if (className.includes('note') || className.includes('info')) textContent += ' [NOTE] ';

      for (const child of node.childNodes) walk(child);

      if (tag === 'P' || tag === 'DIV' || tag === 'TABLE') textContent += '\n';
    }

    walk(document.body);

    // Hard fallback: raw browser text
    if (!textContent.trim()) {
      textContent = document.body.innerText || document.body.textContent || "";
    }

    return {
      title: document.title,
      url: window.location.href,
      content: textContent.replace(/\n{3,}/g, '\n\n').trim()
    };
  } catch (err) {
    return { error: String(err), content: null };
  }
}

/* ------------------------------------------------------------------ */
/* Main click handler                                                  */
/* ------------------------------------------------------------------ */
async function summarize() {
  if (summarizeBtn.disabled) return; // already running
  output.textContent = '';
  startTimer('Extracting page…');
  summarizeBtn.disabled = true;

  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs.length) throw new Error("No active tab found.");

    const results = await browser.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: extractPage
    });

    const pageData = results?.[0]?.result;
    if (pageData?.error) throw new Error("Extraction script failed: " + pageData.error);
    if (!pageData || !pageData.content) throw new Error("Returned data was completely empty.");

    // Reset output: optional size warning, then the markdown container
    output.textContent = '';
    currentUrl = normUrl(tabs[0].url);
    currentEntry = null;
    setPhase('Waiting for Gemini…');
    if (pageData.content.length > 200000) {
      appendError('Warning: Page is extremely long. The model may truncate results.');
    }
    rawText = '';
    checkedState.clear();
    mdBox = document.createElement('div');
    mdBox.className = 'md';
    output.appendChild(mdBox);

    const port = browser.runtime.connect({ name: 'pagesage-stream' });
    let finished = false;

    port.onMessage.addListener((msg) => {
      if (msg.type === 'model') {
        modelLabel = msg.text;
        tick();
      } else if (msg.type === 'chunk') {
        if (!gotFirstChunk) { gotFirstChunk = true; setPhase('Generating…'); }
        rawText += msg.text;
        scheduleRender();
      } else if (msg.type === 'error') {
        finished = true;
        renderNow();
        stopTimer('✗ Stopped after');
        appendError(`Error: ${msg.text}`);
        summarizeBtn.disabled = false;
        port.disconnect();
      } else if (msg.type === 'done') {
        finished = true;
        renderNow(); // final, complete render
        const ms = stopTimer('✓ Done in');
        currentEntry = { title: pageData.title, raw: rawText, checked: [...checkedState], elapsed: ms, model: modelLabel };
        saveCache(currentUrl, currentEntry);
        summarizeBtn.disabled = false;
        port.disconnect();
      }
      // 'ping' keep-alive messages are intentionally ignored
    });

    // If the background script dies or disconnects early, don't leave the button stuck
    port.onDisconnect.addListener(() => {
      if (!finished) {
        renderNow();
        stopTimer('✗ Stopped after');
        appendError('Error: Connection to background script was lost.');
        summarizeBtn.disabled = false;
      }
    });

    port.postMessage({ action: 'summarize', data: pageData });

  } catch (err) {
    stopTimer('✗ Failed after');
    showMessage(err.message, true);
    summarizeBtn.disabled = false;
  }
}
summarizeBtn.addEventListener('click', summarize);

/* ------------------------------------------------------------------ */
/* On open: restore the saved summary for the current tab, if any      */
/* ------------------------------------------------------------------ */
function normUrl(u) { // ignore #fragment so anchors don't break the cache
  try { const x = new URL(u); x.hash = ''; return x.href; } catch (_) { return u; }
}

async function maybeAutoSummarize(url) {
  if (!/^https?:\/\//i.test(url)) return; // skip about:, new tab, etc.
  try {
    const [l, ses] = await Promise.all([
      browser.storage.local.get('apiKey'),
      browser.storage.session.get('apiKey')
    ]);
    if (!l.apiKey && !ses.apiKey) {
      statusEl.textContent = 'Add your Gemini API key to get started.';
      toggleSettings(true);
      return;
    }
  } catch (_) { return; }
  summarize();
}

(async () => {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.url) return;
    const url = normUrl(tabs[0].url);
    const entry = (await loadCache())[url];
    if (!entry) { await maybeAutoSummarize(url); return; }
    currentUrl = url;
    currentEntry = entry;
    rawText = entry.raw;
    checkedState.clear();
    (entry.checked || []).forEach(([k, v]) => checkedState.set(k, v));
    output.textContent = '';
    mdBox = document.createElement('div');
    mdBox.className = 'md';
    output.appendChild(mdBox);
    renderNow();
    output.scrollTo(0, 0);
    statusEl.textContent = `Restored · originally took ${fmt(entry.elapsed || 0)}${entry.model ? ' · ' + entry.model : ''}`;
  } catch (_) {}
})();

loadSettings();
