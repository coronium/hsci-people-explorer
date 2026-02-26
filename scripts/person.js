/* Person detail page */

async function initPerson() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    document.getElementById('person-content').innerHTML =
      '<p>No person ID specified. <a href="search.html">Search for a person</a>.</p>';
    return;
  }

  await DataStore.load(['people', 'graph']);
  const person = DataStore.getPersonById(id);
  if (!person) {
    document.getElementById('person-content').innerHTML =
      `<p>Person not found: ${id}. <a href="search.html">Search for a person</a>.</p>`;
    return;
  }

  document.title = `${person.name} - HoS People Explorer`;
  renderPersonDetail(person);
  renderMiniGraph(person);
}

function renderPersonDetail(p) {
  const content = document.getElementById('person-content');

  let html = `
    <div class="person-header">
      <h1>${p.name}</h1>
      ${p.description ? `<div class="description">${p.description}</div>` : ''}
      <div class="person-links" style="margin-top:0.75rem">
        ${renderExternalLinks(p)}
      </div>
    </div>
  `;

  // Awards
  if (p.awards.length > 0) {
    html += `<div class="person-section"><h2>Awards (${p.awards.length})</h2>`;
    p.awards.sort((a, b) => (a.year || 9999) - (b.year || 9999));
    p.awards.forEach(a => {
      html += `<div class="role-item">
        <div><span class="role-name">${a.name}</span></div>
        <div class="role-years">${a.year || 'unknown year'}</div>
      </div>`;
    });
    html += '</div>';
  }

  // Editorships
  if (p.editorships.length > 0) {
    html += `<div class="person-section"><h2>Journal Editorships (${p.editorships.length})</h2>`;
    p.editorships.forEach(e => {
      const years = [e.start, e.end].filter(Boolean).join(' - ') || '';
      html += `<div class="role-item">
        <div>
          <span class="role-name">${e.journal}</span>
          ${e.role ? `<div class="role-detail">${e.role}</div>` : ''}
        </div>
        <div class="role-years">${years}</div>
      </div>`;
    });
    html += '</div>';
  }

  // Memberships
  if (p.memberships.length > 0) {
    html += `<div class="person-section"><h2>Organizational Roles (${p.memberships.length})</h2>`;
    p.memberships.forEach(m => {
      const years = [m.start, m.end].filter(Boolean).join(' - ') || '';
      html += `<div class="role-item">
        <div>
          <span class="role-name">${m.org}</span>
          ${m.role ? `<div class="role-detail">${m.role}</div>` : ''}
        </div>
        <div class="role-years">${years}</div>
      </div>`;
    });
    html += '</div>';
  }

  // Mini graph section
  html += `<div class="person-section"><h2>Network Connections</h2>
    <div class="mini-graph" id="mini-graph-container"><svg id="mini-graph-svg"></svg></div>
  </div>`;

  content.innerHTML = html;
}

function renderMiniGraph(person) {
  const graphData = DataStore.graph;
  const personId = person.id;

  // Find direct connections
  const neighbors = new Set();
  const relevantLinks = [];
  graphData.links.forEach(l => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    if (s === personId) { neighbors.add(t); relevantLinks.push({ source: s, target: t, weight: l.weight }); }
    if (t === personId) { neighbors.add(s); relevantLinks.push({ source: s, target: t, weight: l.weight }); }
  });

  // Limit to top 20 by weight
  relevantLinks.sort((a, b) => b.weight - a.weight);
  const topLinks = relevantLinks.slice(0, 20);
  const topNeighbors = new Set();
  topLinks.forEach(l => {
    topNeighbors.add(l.source);
    topNeighbors.add(l.target);
  });

  const nodeIds = new Set([personId, ...topNeighbors]);
  const nodeMap = {};
  graphData.nodes.forEach(n => { if (nodeIds.has(n.id)) nodeMap[n.id] = { ...n }; });
  // Add person if not in graph nodes
  if (!nodeMap[personId]) {
    nodeMap[personId] = { id: personId, name: person.name };
  }
  const nodes = Object.values(nodeMap);
  const links = topLinks.filter(l => nodeMap[l.source] && nodeMap[l.target]);

  if (nodes.length <= 1) {
    document.getElementById('mini-graph-container').innerHTML =
      '<div style="padding:2rem;text-align:center;color:var(--charcoal-blue)">No network connections found</div>';
    return;
  }

  const container = document.getElementById('mini-graph-container');
  const width = container.clientWidth;
  const height = 300;

  const svg = d3.select('#mini-graph-svg')
    .attr('viewBox', [0, 0, width, height]);

  const g = svg.append('g');
  svg.call(d3.zoom().scaleExtent([0.5, 4]).on('zoom', e => g.attr('transform', e.transform)));

  const link = g.append('g').selectAll('line').data(links).join('line')
    .attr('stroke', '#b0c4d8').attr('stroke-opacity', 0.5).attr('stroke-width', 1);

  const node = g.append('g').selectAll('circle').data(nodes).join('circle')
    .attr('r', d => d.id === personId ? 10 : 5)
    .attr('fill', d => d.id === personId ? '#e74c3c' : '#2892d7')
    .attr('stroke', '#fff').attr('stroke-width', 1)
    .style('cursor', 'pointer')
    .on('click', (e, d) => {
      if (d.id !== personId) window.location.href = makePersonUrl({ id: d.id });
    });

  const label = g.append('g').selectAll('text').data(nodes).join('text')
    .attr('font-size', d => d.id === personId ? '11px' : '9px')
    .attr('fill', '#173753')
    .attr('text-anchor', 'middle')
    .attr('dy', d => d.id === personId ? -14 : -9)
    .text(d => d.name ? d.name.split(',')[0] : d.id);

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-150))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .on('tick', () => {
      link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('cx', d => d.x).attr('cy', d => d.y);
      label.attr('x', d => d.x).attr('y', d => d.y);
    });
}

document.addEventListener('DOMContentLoaded', initPerson);
