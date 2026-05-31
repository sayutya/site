'use strict';

/* ================================================
   Progress Bar
   ================================================ */
function initProgressBar() {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;
  function update() {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* ================================================
   Table of Contents  (builds into #toc-list in sidebar)
   ================================================ */
function buildTOC() {
  const content = document.getElementById('c');
  const tocList = document.getElementById('toc-list');
  if (!content || !tocList) return;

  const headings = Array.from(content.querySelectorAll('h1, h2, h3'));
  if (headings.length === 0) {
    const toc = document.querySelector('.sidebar-toc');
    if (toc) toc.style.display = 'none';
    return;
  }

  tocList.innerHTML = '';
  headings.forEach((h, i) => {
    if (!h.id) h.id = 'sec-' + i;
    const a = document.createElement('a');
    a.className = 'toc-item toc-' + h.tagName.toLowerCase();
    a.href = '#' + h.id;
    a.textContent = h.textContent.replace(/\s+/g, ' ').trim();
    a.addEventListener('click', e => {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    tocList.appendChild(a);
  });

  // Highlight active heading on scroll
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const link = tocList.querySelector(`[href="#${entry.target.id}"]`);
      if (link) link.classList.toggle('active', entry.isIntersecting);
    });
  }, {
    rootMargin: '0px 0px -70% 0px',
    threshold: 0
  });
  headings.forEach(h => observer.observe(h));
}

/* ================================================
   Copy Buttons
   ================================================ */
function initCopyButtons() {
  // CoCoFoliaコピーボタン
  document.addEventListener('click', async e => {
    const ccBtn = e.target.closest('.ccfolia-copy-btn');
    if (!ccBtn) return;
    e.stopPropagation();
    const card = ccBtn.closest('.ccfolia-card');
    if (!card) return;
    const name     = card.querySelector('.box-title')?.textContent.trim() || '';
    const memoEl   = card.querySelector('.ccfolia-memo-block');
    const cmdEl    = card.querySelector('.ccfolia-commands-block');
    const memo     = memoEl ? memoEl.textContent.trim() : '';
    const commands = cmdEl  ? cmdEl.textContent.trim()  : '';
    const status   = Array.from(card.querySelectorAll('[data-cc-stat]')).map(row => ({
      label: row.querySelector('.ccfolia-stat-label')?.textContent.trim() || '',
      value: parseInt(row.querySelector('.ccfolia-stat-val')?.textContent) || 0,
      max:   parseInt(row.querySelector('.ccfolia-stat-max')?.textContent) || 0
    })).filter(s => s.label);
    const params = Array.from(card.querySelectorAll('[data-cc-param]')).map(row => ({
      label: row.querySelector('.kv-label')?.textContent.trim() || '',
      value: row.querySelector('.kv-value')?.textContent.trim() || ''
    })).filter(p => p.label);
    const color = card.dataset.ccColor || undefined;
    const data  = { name, memo, commands, status, params };
    if (color) data.color = color;
    const json = JSON.stringify({ kind: 'character', data });
    const origText = ccBtn.textContent;
    try {
      await navigator.clipboard.writeText(json);
      ccBtn.textContent = '✓ コピー完了';
    } catch {
      const ta = Object.assign(document.createElement('textarea'),
        { value: json, style: 'position:fixed;top:0;left:0;opacity:0;pointer-events:none' });
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      ccBtn.textContent = '✓ コピー完了';
    }
    ccBtn.classList.add('copied');
    setTimeout(() => { ccBtn.textContent = origText; ccBtn.classList.remove('copied'); }, 1800);
  });

  document.addEventListener('click', async e => {
    const btn = e.target.closest('.box-copy-btn, .box-copy-title-btn');
    if (!btn) return;
    const box = btn.closest('.scenario-box');
    if (!box) return;

    let text = '';
    if (btn.classList.contains('box-copy-title-btn')) {
      const title    = box.querySelector('.box-title');
      const subtitle = box.querySelector('.box-subtitle');
      const body     = box.querySelector('.box-body');
      text = [
        title    ? title.textContent.trim()    : '',
        subtitle ? subtitle.textContent.trim() : '',
        body     ? body.innerText.trim()       : ''
      ].filter(Boolean).join('\n');
    } else {
      const body = box.querySelector('.box-body');
      if (body) text = body.innerText.trim();
    }
    if (!text) return;

    const origText = btn.textContent;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = Object.assign(document.createElement('textarea'), {
        value: text,
        style: 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
      });
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    btn.textContent = '✓ コピー完了';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = origText; btn.classList.remove('copied'); }, 1800);
  });
}

/* ================================================
   Checklist Persistence
   ================================================ */
function initChecklists() {
  const KEY = 'cbstate_' + location.pathname;
  let states;
  try { states = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { states = {}; }

  function save() {
    document.querySelectorAll('.task-checkbox').forEach((cb, i) => { states[i] = cb.checked; });
    localStorage.setItem(KEY, JSON.stringify(states));
  }

  document.querySelectorAll('.task-checkbox').forEach((cb, i) => {
    if (states[i] !== undefined) cb.checked = !!states[i];
    const item = cb.closest('.task-item');
    if (item) item.classList.toggle('task-done', cb.checked);
    cb.addEventListener('change', () => {
      const item = cb.closest('.task-item');
      if (item) item.classList.toggle('task-done', cb.checked);
      save();
    });
  });
}

/* ================================================
   Jump Links
   ================================================ */
function initJumpLinks() {
  document.addEventListener('click', e => {
    const link = e.target.closest('a.jump-link');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    // "#hash" 形式またはdata-targetがあるときだけスムーズスクロール
    // それ以外（別ページへのリンク等）はブラウザのデフォルト動作に任せる
    if (!link.dataset.target && !href.startsWith('#')) return;
    e.preventDefault();
    const id = link.dataset.target || href.slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* ================================================
   In-page Search  (Ctrl+F / Cmd+F)
   ================================================ */
function initSearch() {
  if (!document.getElementById('search-bar')) {
    const bar = document.createElement('div');
    bar.id = 'search-bar';
    bar.innerHTML =
      '<input type="text" id="sb-input" placeholder="このページを検索..." autocomplete="off">' +
      '<span id="sb-info">0 / 0</span>' +
      '<button class="sb-btn" id="sb-prev" title="前へ">&#8593;</button>' +
      '<button class="sb-btn" id="sb-next" title="次へ">&#8595;</button>' +
      '<button class="sb-btn" id="sb-close" title="閉じる">&#10005;</button>';
    document.body.appendChild(bar);
  }

  const bar   = document.getElementById('search-bar');
  const input = document.getElementById('sb-input');
  const info  = document.getElementById('sb-info');
  const content = document.getElementById('c');
  let matches = [], cur = -1;

  function clearMarks() {
    if (!content) return;
    content.querySelectorAll('mark.esh').forEach(m => {
      m.parentNode.replaceChild(document.createTextNode(m.textContent), m);
      m.parentNode.normalize();
    });
    matches = []; cur = -1;
  }

  function doSearch(q) {
    clearMarks();
    if (!q || !content) { info.textContent = '0 / 0'; return; }
    const lower = q.toLowerCase(), len = q.length;
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const text = node.textContent, ltext = text.toLowerCase();
      const parts = []; let idx = 0;
      while (true) {
        const pos = ltext.indexOf(lower, idx);
        if (pos < 0) break;
        if (pos > idx) parts.push(document.createTextNode(text.slice(idx, pos)));
        const m = document.createElement('mark');
        m.className = 'esh'; m.textContent = text.slice(pos, pos + len);
        parts.push(m); matches.push(m); idx = pos + len;
      }
      if (idx < text.length) parts.push(document.createTextNode(text.slice(idx)));
      if (parts.length > 1) {
        const frag = document.createDocumentFragment();
        parts.forEach(p => frag.appendChild(p));
        node.parentNode.replaceChild(frag, node);
      }
    });
    info.textContent = matches.length ? `1 / ${matches.length}` : '0 / 0';
    if (matches.length) goTo(0);
  }

  function goTo(idx) {
    if (!matches.length) return;
    if (cur >= 0 && matches[cur]) matches[cur].classList.remove('esh-active');
    cur = ((idx % matches.length) + matches.length) % matches.length;
    matches[cur].classList.add('esh-active');
    matches[cur].scrollIntoView({ behavior: 'smooth', block: 'center' });
    info.textContent = `${cur + 1} / ${matches.length}`;
  }

  const open  = () => { bar.classList.add('open'); input.focus(); input.select(); };
  const close = () => { bar.classList.remove('open'); clearMarks(); info.textContent = '0 / 0'; };

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); open(); }
    if (e.key === 'Escape' && bar.classList.contains('open')) close();
    if (e.key === 'Enter'  && bar.classList.contains('open')) {
      e.preventDefault(); goTo(e.shiftKey ? cur - 1 : cur + 1);
    }
  });

  input.addEventListener('input', e => doSearch(e.target.value.trim()));
  document.getElementById('sb-prev')?.addEventListener('click', () => goTo(cur - 1));
  document.getElementById('sb-next')?.addEventListener('click', () => goTo(cur + 1));
  document.getElementById('sb-close')?.addEventListener('click', close);
}

/* ================================================
   Hamburger Menu
   ================================================ */
function initHamburger() {
  const btn     = document.getElementById('hamburger-btn');
  const sidebar = document.getElementById('site-sidebar');
  const overlay = document.getElementById('sb-overlay');
  if (!btn || !sidebar) return;

  function open() {
    sidebar.classList.add('sb-open');
    overlay && overlay.classList.add('open');
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }
  function close() {
    sidebar.classList.remove('sb-open');
    overlay && overlay.classList.remove('open');
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }
  function toggle() { sidebar.classList.contains('sb-open') ? close() : open(); }

  btn.addEventListener('click', toggle);
  overlay && overlay.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

/* ================================================
   Boot
   ================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initProgressBar();
  buildTOC();
  initCopyButtons();
  initChecklists();
  initJumpLinks();
  initSearch();
  initHamburger();
});
