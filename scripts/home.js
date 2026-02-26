/* Home page: stats dashboard and charts */

async function initHome() {
  await DataStore.load(['stats', 'people']);
  const stats = DataStore.stats;

  // Populate stat cards
  document.getElementById('stat-people').textContent = stats.total_people;
  document.getElementById('stat-awards').textContent = stats.total_awards;
  document.getElementById('stat-journals').textContent = stats.total_journals;
  document.getElementById('stat-orgs').textContent = stats.total_organizations;

  renderTimelineChart(stats.timeline);
  renderTopConnected(stats.top_connected);
  renderOrgChart(stats.org_stats);
}

function renderTimelineChart(data) {
  const container = document.getElementById('timeline-chart');
  const width = container.clientWidth;
  const height = 250;
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const inner = { width: width - margin.left - margin.right, height: height - margin.top - margin.bottom };

  const svg = d3.select(container).append('svg')
    .attr('width', width).attr('height', height)
    .attr('class', 'bar-chart');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(data.map(d => d.decade)).range([0, inner.width]).padding(0.2);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.count)]).nice().range([inner.height, 0]);

  g.append('g').attr('class', 'axis').attr('transform', `translate(0,${inner.height})`)
    .call(d3.axisBottom(x).tickFormat(d => d + 's'));

  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(5));

  g.selectAll('.bar').data(data).enter().append('rect')
    .attr('class', 'bar')
    .attr('x', d => x(d.decade))
    .attr('y', d => y(d.count))
    .attr('width', x.bandwidth())
    .attr('height', d => inner.height - y(d.count));
}

function renderTopConnected(data) {
  const container = document.getElementById('top-connected');
  const width = container.clientWidth;
  const height = 300;
  const margin = { top: 10, right: 20, bottom: 10, left: 160 };
  const inner = { width: width - margin.left - margin.right, height: height - margin.top - margin.bottom };

  const svg = d3.select(container).append('svg')
    .attr('width', width).attr('height', height)
    .attr('class', 'bar-chart');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const top10 = data.slice(0, 10).reverse();

  const x = d3.scaleLinear().domain([0, d3.max(top10, d => d.connections)]).nice().range([0, inner.width]);
  const y = d3.scaleBand().domain(top10.map(d => d.name)).range([inner.height, 0]).padding(0.3);

  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).tickSize(0)).select('.domain').remove();

  g.selectAll('.bar').data(top10).enter().append('rect')
    .attr('class', 'bar')
    .attr('x', 0)
    .attr('y', d => y(d.name))
    .attr('width', d => x(d.connections))
    .attr('height', y.bandwidth())
    .style('cursor', 'pointer')
    .on('click', (e, d) => { window.location.href = makePersonUrl({id: d.id}); });

  g.selectAll('.label').data(top10).enter().append('text')
    .attr('x', d => x(d.connections) + 4)
    .attr('y', d => y(d.name) + y.bandwidth() / 2)
    .attr('dy', '0.35em')
    .style('font-size', '11px')
    .style('fill', '#1b4353')
    .text(d => d.connections);
}

function renderOrgChart(data) {
  const container = document.getElementById('org-chart');
  const width = container.clientWidth;
  const height = 300;
  const margin = { top: 10, right: 20, bottom: 10, left: 280 };
  const inner = { width: width - margin.left - margin.right, height: height - margin.top - margin.bottom };

  const svg = d3.select(container).append('svg')
    .attr('width', width).attr('height', height)
    .attr('class', 'bar-chart');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  // Show top 10 orgs
  const topOrgs = data.slice(0, 10).reverse();

  // Truncate long names
  const truncName = n => n.length > 40 ? n.slice(0, 38) + '...' : n;

  const x = d3.scaleLinear().domain([0, d3.max(topOrgs, d => d.count)]).nice().range([0, inner.width]);
  const y = d3.scaleBand().domain(topOrgs.map(d => truncName(d.name))).range([inner.height, 0]).padding(0.3);

  g.append('g').attr('class', 'axis').call(d3.axisLeft(y).tickSize(0)).select('.domain').remove();

  g.selectAll('.bar').data(topOrgs).enter().append('rect')
    .attr('class', 'bar')
    .attr('x', 0)
    .attr('y', d => y(truncName(d.name)))
    .attr('width', d => x(d.count))
    .attr('height', y.bandwidth());

  g.selectAll('.label').data(topOrgs).enter().append('text')
    .attr('x', d => x(d.count) + 4)
    .attr('y', d => y(truncName(d.name)) + y.bandwidth() / 2)
    .attr('dy', '0.35em')
    .style('font-size', '11px')
    .style('fill', '#1b4353')
    .text(d => d.count);
}

document.addEventListener('DOMContentLoaded', initHome);
