/* Shared data loading and utility functions */

const DataStore = {
  people: null,
  graph: null,
  stats: null,

  async load(datasets) {
    const promises = [];
    if (datasets.includes('people') && !this.people) {
      promises.push(fetch('data/people.json').then(r => r.json()).then(d => this.people = d));
    }
    if (datasets.includes('graph') && !this.graph) {
      promises.push(fetch('data/graph.json').then(r => r.json()).then(d => this.graph = d));
    }
    if (datasets.includes('stats') && !this.stats) {
      promises.push(fetch('data/stats.json').then(r => r.json()).then(d => this.stats = d));
    }
    await Promise.all(promises);
  },

  getPersonById(id) {
    if (!this.people) return null;
    return this.people.find(p => p.id === id);
  },

  searchPeople(query) {
    if (!this.people || !query) return [];
    const q = query.toLowerCase();
    return this.people.filter(p => {
      if (p.name.toLowerCase().includes(q)) return true;
      if (p.description && p.description.toLowerCase().includes(q)) return true;
      if (p.awards.some(a => a.name.toLowerCase().includes(q))) return true;
      if (p.editorships.some(e => e.journal.toLowerCase().includes(q))) return true;
      if (p.memberships.some(m => m.org.toLowerCase().includes(q))) return true;
      return false;
    }).slice(0, 50);
  }
};

function makePersonUrl(person) {
  return `person.html?id=${encodeURIComponent(person.id)}`;
}

function makeExternalLinks(person) {
  const links = [];
  if (person.wikidata_id) {
    links.push({
      label: 'Wikipedia',
      url: `https://en.wikipedia.org/wiki/Special:GoToLinkedPage/enwiki/${person.wikidata_id}`
    });
    links.push({
      label: 'Wikidata',
      url: `https://www.wikidata.org/wiki/${person.wikidata_id}`
    });
  }
  if (person.isiscb_id) {
    links.push({
      label: 'IsisCB',
      url: `https://data.isiscb.org/isis/authority/${person.isiscb_id}`
    });
  }
  if (person.viaf_id) {
    links.push({
      label: 'VIAF',
      url: `https://viaf.org/viaf/${person.viaf_id}`
    });
  }
  return links;
}

function renderExternalLinks(person) {
  return makeExternalLinks(person).map(l =>
    `<a href="${l.url}" class="person-link" target="_blank" rel="noopener">${l.label}</a>`
  ).join('');
}

function renderRoleTags(person) {
  const tags = [];
  if (person.awards.length > 0) tags.push(`<span class="tag">${person.awards.length} award${person.awards.length > 1 ? 's' : ''}</span>`);
  if (person.editorships.length > 0) tags.push(`<span class="tag">${person.editorships.length} editorship${person.editorships.length > 1 ? 's' : ''}</span>`);
  if (person.memberships.length > 0) tags.push(`<span class="tag">${person.memberships.length} membership${person.memberships.length > 1 ? 's' : ''}</span>`);
  return tags.join(' ');
}

/* Highlight the current nav link */
function setActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.app-nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

document.addEventListener('DOMContentLoaded', setActiveNav);
