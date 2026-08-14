(() => {
  'use strict';

  const STORAGE_KEY = 'sitesearch_history';
  const MAX_HISTORY = 8;

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  let currentDomain = '';

  // --- Init ---
  async function init() {
    // Get the current tab's domain
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const url = new URL(tab.url);
        currentDomain = url.hostname;
        $('#current-site').textContent = currentDomain;
        $('#current-site').title = currentDomain;
      }
    } catch (e) {
      $('#current-site').textContent = 'No site';
    }

    // Load saved engine preference
    const saved = await chrome.storage.local.get(['sitesearch_engine']);
    if (saved.sitesearch_engine) {
      const radio = $(`input[name="engine"][value="${saved.sitesearch_engine}"]`);
      if (radio) radio.checked = true;
    }

    // Load and render history
    renderHistory();

    // Focus input
    $('#query').focus();

    // Event listeners
    $('#search-form').addEventListener('submit', handleSearch);
    $$('input[name="engine"]').forEach(r => {
      r.addEventListener('change', () => {
        chrome.storage.local.set({ sitesearch_engine: r.value });
      });
    });
    $('#clear-history').addEventListener('click', clearHistory);
  }

  // --- Search ---
  function handleSearch(e) {
    e.preventDefault();
    const query = $('#query').value.trim();
    if (!query || !currentDomain) return;

    const engine = $('input[name="engine"]:checked').value;
    const searchUrl = buildSearchUrl(engine, currentDomain, query);

    // Save to history
    saveToHistory(query, currentDomain, engine);

    // Open in new tab
    chrome.tabs.create({ url: searchUrl });
    window.close();
  }

  function buildSearchUrl(engine, domain, query) {
    const siteQuery = `site:${domain} ${query}`;
    switch (engine) {
      case 'google':
        return `https://www.google.com/search?q=${encodeURIComponent(siteQuery)}`;
      case 'bing':
        return `https://www.bing.com/search?q=${encodeURIComponent(siteQuery)}`;
      case 'duckduckgo':
        return `https://duckduckgo.com/?q=${encodeURIComponent(siteQuery)}`;
      default:
        return `https://www.google.com/search?q=${encodeURIComponent(siteQuery)}`;
    }
  }

  // --- History ---
  async function saveToHistory(query, domain, engine) {
    const data = await chrome.storage.local.get([STORAGE_KEY]);
    let history = data[STORAGE_KEY] || [];
    
    // Remove duplicate
    history = history.filter(h => !(h.query === query && h.domain === domain));
    
    // Add to front
    history.unshift({
      query,
      domain,
      engine,
      timestamp: Date.now()
    });

    // Keep max
    history = history.slice(0, MAX_HISTORY);

    await chrome.storage.local.set({ [STORAGE_KEY]: history });
  }

  async function renderHistory() {
    const data = await chrome.storage.local.get([STORAGE_KEY]);
    const history = data[STORAGE_KEY] || [];
    const section = $('#history-section');
    const list = $('#history-list');

    if (history.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    list.innerHTML = '';

    history.forEach(item => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <span class="hist-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="12 8 12 12 14 14"/>
            <circle cx="12" cy="12" r="10"/>
          </svg>
        </span>
        <span class="hist-query">${escapeHtml(item.query)}</span>
        <span class="hist-site">${escapeHtml(item.domain)}</span>
      `;
      li.addEventListener('click', () => {
        const url = buildSearchUrl(item.engine || 'google', item.domain, item.query);
        chrome.tabs.create({ url });
        window.close();
      });
      list.appendChild(li);
    });
  }

  async function clearHistory() {
    await chrome.storage.local.remove([STORAGE_KEY]);
    renderHistory();
  }

  // --- Util ---
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Start ---
  document.addEventListener('DOMContentLoaded', init);
})();
