/* Directory page: filterable, sortable table */

let allPeople = [];
let currentSort = { field: 'name', asc: true };

async function initDirectory() {
  await DataStore.load(['people', 'stats']);
  allPeople = DataStore.people;
  const stats = DataStore.stats;

  // Populate filter dropdowns
  populateSelect('filter-org', stats.organizations_list);
  populateSelect('filter-journal', stats.journals_list);
  populateSelect('filter-award', stats.awards_list);

  renderTable();

  document.getElementById('filter-search').addEventListener('input', renderTable);
  document.getElementById('filter-org').addEventListener('change', renderTable);
  document.getElementById('filter-journal').addEventListener('change', renderTable);
  document.getElementById('filter-award').addEventListener('change', renderTable);
}

function populateSelect(id, items) {
  const sel = document.getElementById(id);
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item;
    opt.textContent = item.length > 40 ? item.slice(0, 38) + '...' : item;
    sel.appendChild(opt);
  });
}

function getFiltered() {
  const search = document.getElementById('filter-search').value.toLowerCase();
  const org = document.getElementById('filter-org').value;
  const journal = document.getElementById('filter-journal').value;
  const award = document.getElementById('filter-award').value;

  return allPeople.filter(p => {
    if (search && !p.name.toLowerCase().includes(search) && !(p.description || '').toLowerCase().includes(search)) return false;
    if (org && !p.memberships.some(m => m.org === org)) return false;
    if (journal && !p.editorships.some(e => e.journal === journal)) return false;
    if (award && !p.awards.some(a => a.name === award)) return false;
    return true;
  });
}

function sortPeople(people) {
  const { field, asc } = currentSort;
  return [...people].sort((a, b) => {
    let va, vb;
    if (field === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
    else if (field === 'roles') { va = a.role_count; vb = b.role_count; }
    else { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ? 1 : -1;
    return 0;
  });
}

function renderTable() {
  const filtered = sortPeople(getFiltered());
  const tbody = document.getElementById('directory-tbody');
  const countEl = document.getElementById('result-count');
  countEl.textContent = `${filtered.length} of ${allPeople.length} people`;

  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td><a href="${makePersonUrl(p)}">${p.name}</a></td>
      <td class="desc-cell">${p.description || ''}</td>
      <td>${p.awards.map(a => a.name).join(', ') || '-'}</td>
      <td>${p.editorships.map(e => e.journal).join(', ') || '-'}</td>
      <td>${p.memberships.length > 0 ? p.memberships.length + ' org' + (p.memberships.length > 1 ? 's' : '') : '-'}</td>
      <td>${renderExternalLinks(p)}</td>
    </tr>
  `).join('');
}

function sortBy(field) {
  if (currentSort.field === field) {
    currentSort.asc = !currentSort.asc;
  } else {
    currentSort = { field, asc: true };
  }
  renderTable();
}

document.addEventListener('DOMContentLoaded', initDirectory);
