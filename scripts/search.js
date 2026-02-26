/* Search page: autocomplete search */

async function initSearch() {
  await DataStore.load(['people']);

  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');

  input.addEventListener('input', () => {
    const query = input.value.trim();
    if (query.length < 2) {
      results.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--charcoal-blue);">Type at least 2 characters to search</div>';
      return;
    }
    const matches = DataStore.searchPeople(query);
    if (matches.length === 0) {
      results.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--charcoal-blue);">No results found</div>';
      return;
    }
    results.innerHTML = matches.map(p => `
      <a href="${makePersonUrl(p)}" class="search-result-item">
        <div class="search-result-name">${highlightMatch(p.name, query)}</div>
        ${p.description ? `<div class="search-result-desc">${highlightMatch(p.description, query)}</div>` : ''}
        <div class="search-result-roles">${renderRoleTags(p)}</div>
      </a>
    `).join('');
  });

  // Focus input on page load
  input.focus();

  // Check for query param
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');
  if (q) {
    input.value = q;
    input.dispatchEvent(new Event('input'));
  }
}

function highlightMatch(text, query) {
  if (!query || !text) return text || '';
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'gi');
  return text.replace(re, '<mark>$1</mark>');
}

document.addEventListener('DOMContentLoaded', initSearch);
