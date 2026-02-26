/* Network graph page: D3 force-directed graph */

const COLORS = {
  award: '#e74c3c',
  editor: '#2892d7',
  member: '#27ae60',
  multi: '#9b59b6',
  default: '#6daedb'
};

let simulation, svg, g, link, node, tooltip;
let graphData, peopleMap;

async function initGraph() {
  await DataStore.load(['graph', 'people', 'stats']);
  graphData = DataStore.graph;
  const stats = DataStore.stats;

  // Build people lookup
  peopleMap = {};
  DataStore.people.forEach(p => { peopleMap[p.id] = p; });

  // Populate filter
  const filterEl = document.getElementById('graph-filter');
  const orgGroup = document.createElement('optgroup');
  orgGroup.label = 'Organizations';
  stats.organizations_list.forEach(o => {
    const opt = document.createElement('option');
    opt.value = 'org:' + o;
    opt.textContent = o.length > 50 ? o.slice(0, 48) + '...' : o;
    orgGroup.appendChild(opt);
  });
  filterEl.appendChild(orgGroup);

  const journalGroup = document.createElement('optgroup');
  journalGroup.label = 'Journals';
  stats.journals_list.forEach(j => {
    const opt = document.createElement('option');
    opt.value = 'journal:' + j;
    opt.textContent = j;
    journalGroup.appendChild(opt);
  });
  filterEl.appendChild(journalGroup);

  const awardGroup = document.createElement('optgroup');
  awardGroup.label = 'Awards';
  stats.awards_list.forEach(a => {
    const opt = document.createElement('option');
    opt.value = 'award:' + a;
    opt.textContent = a;
    awardGroup.appendChild(opt);
  });
  filterEl.appendChild(awardGroup);

  filterEl.addEventListener('change', applyFilter);
  document.getElementById('min-connections').addEventListener('input', applyFilter);

  // Default: show all (edges already filtered to weight >= 2 in build)
  document.getElementById('min-connections').value = '1';
  applyFilter();
}

function applyFilter() {
  const filterVal = document.getElementById('graph-filter').value;
  const minConn = parseInt(document.getElementById('min-connections').value) || 1;

  let filteredNodeIds = new Set();

  if (filterVal) {
    const [type, ...rest] = filterVal.split(':');
    const name = rest.join(':');
    DataStore.people.forEach(p => {
      if (type === 'org' && p.memberships.some(m => m.org === name)) filteredNodeIds.add(p.id);
      if (type === 'journal' && p.editorships.some(e => e.journal === name)) filteredNodeIds.add(p.id);
      if (type === 'award' && p.awards.some(a => a.name === name)) filteredNodeIds.add(p.id);
    });
  } else {
    graphData.nodes.forEach(n => filteredNodeIds.add(n.id));
  }

  // Count connections within the filtered set
  const connCount = {};
  graphData.links.forEach(l => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    if (filteredNodeIds.has(s) && filteredNodeIds.has(t)) {
      connCount[s] = (connCount[s] || 0) + 1;
      connCount[t] = (connCount[t] || 0) + 1;
    }
  });

  // Apply min connections filter
  const visibleIds = new Set();
  filteredNodeIds.forEach(id => {
    if ((connCount[id] || 0) >= minConn) visibleIds.add(id);
  });

  const nodes = graphData.nodes.filter(n => visibleIds.has(n.id)).map(n => ({...n}));
  const nodeIdSet = new Set(nodes.map(n => n.id));
  const links = graphData.links
    .filter(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      return nodeIdSet.has(s) && nodeIdSet.has(t);
    })
    .map(l => ({
      source: typeof l.source === 'object' ? l.source.id : l.source,
      target: typeof l.target === 'object' ? l.target.id : l.target,
      weight: l.weight
    }));

  document.getElementById('graph-info').textContent =
    `${nodes.length} people, ${links.length} connections`;

  renderGraph({ nodes, links });
}

function getNodeColor(id) {
  const p = peopleMap[id];
  if (!p) return COLORS.default;
  const hasAward = p.awards.length > 0;
  const hasEditor = p.editorships.length > 0;
  const hasMember = p.memberships.length > 0;
  const types = [hasAward, hasEditor, hasMember].filter(Boolean).length;
  if (types >= 2) return COLORS.multi;
  if (hasAward) return COLORS.award;
  if (hasEditor) return COLORS.editor;
  if (hasMember) return COLORS.member;
  return COLORS.default;
}

function renderGraph(data) {
  const container = document.getElementById('graph-svg');
  container.innerHTML = '';

  const rect = container.parentElement.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  svg = d3.select(container)
    .attr('viewBox', [0, 0, width, height]);

  g = svg.append('g');

  // Zoom
  const zoom = d3.zoom()
    .scaleExtent([0.1, 8])
    .on('zoom', (e) => g.attr('transform', e.transform));
  svg.call(zoom);

  tooltip = document.getElementById('graph-tooltip');

  // Compute node degrees for sizing
  const degree = {};
  data.links.forEach(l => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    degree[s] = (degree[s] || 0) + 1;
    degree[t] = (degree[t] || 0) + 1;
  });

  link = g.append('g')
    .selectAll('line')
    .data(data.links)
    .join('line')
    .attr('stroke', '#b0c4d8')
    .attr('stroke-opacity', 0.3)
    .attr('stroke-width', d => Math.min(d.weight * 0.5, 3));

  node = g.append('g')
    .selectAll('circle')
    .data(data.nodes)
    .join('circle')
    .attr('r', d => Math.max(3, Math.min(15, Math.sqrt(degree[d.id] || 1) * 2)))
    .attr('fill', d => getNodeColor(d.id))
    .attr('stroke', '#fff')
    .attr('stroke-width', 1)
    .style('cursor', 'pointer')
    .on('mouseover', showTooltip)
    .on('mouseout', hideTooltip)
    .on('click', (e, d) => { window.location.href = makePersonUrl({id: d.id}); })
    .call(d3.drag()
      .on('start', dragStarted)
      .on('drag', dragged)
      .on('end', dragEnded));

  // Labels for high-degree nodes
  const labelThreshold = d3.quantile(
    Object.values(degree).sort(d3.ascending), 0.9
  ) || 5;

  g.append('g')
    .selectAll('text')
    .data(data.nodes.filter(d => (degree[d.id] || 0) >= labelThreshold))
    .join('text')
    .attr('class', 'node-label')
    .attr('font-size', '9px')
    .attr('fill', '#173753')
    .attr('text-anchor', 'middle')
    .attr('dy', d => -Math.max(3, Math.min(15, Math.sqrt(degree[d.id] || 1) * 2)) - 3)
    .text(d => d.name.split(',')[0]);

  simulation = d3.forceSimulation(data.nodes)
    .force('link', d3.forceLink(data.links).id(d => d.id).distance(60).strength(d => d.weight * 0.05))
    .force('charge', d3.forceManyBody().strength(-80))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => Math.max(3, Math.sqrt(degree[d.id] || 1) * 2) + 2))
    .on('tick', ticked);
}

function ticked() {
  link
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);

  node
    .attr('cx', d => d.x)
    .attr('cy', d => d.y);

  g.selectAll('.node-label')
    .attr('x', d => d.x)
    .attr('y', d => d.y);
}

function showTooltip(event, d) {
  const p = peopleMap[d.id];
  if (!p) return;
  let html = `<strong>${p.name}</strong>`;
  if (p.description) html += `<br><span style="color:var(--charcoal-blue)">${p.description}</span>`;
  const roles = [];
  if (p.awards.length) roles.push(`${p.awards.length} award(s)`);
  if (p.editorships.length) roles.push(`${p.editorships.length} editorship(s)`);
  if (p.memberships.length) roles.push(`${p.memberships.length} membership(s)`);
  if (roles.length) html += `<br>${roles.join(' &middot; ')}`;
  tooltip.innerHTML = html;
  tooltip.style.display = 'block';
  tooltip.style.left = (event.pageX + 12) + 'px';
  tooltip.style.top = (event.pageY - 12) + 'px';
}

function hideTooltip() {
  tooltip.style.display = 'none';
}

function dragStarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event, d) {
  d.fx = event.x;
  d.fy = event.y;
}

function dragEnded(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}

document.addEventListener('DOMContentLoaded', initGraph);
