/* INFORMIX Spa — Monitoring Module (Chart.js) */
let cpuChart, memChart, netChart, diskChart;
let monitorInterval = null;

const CHART_COLORS = {
  cpu: { line: '#0a84ff', fill: 'rgba(10,132,255,0.08)' },
  memory: { line: '#30d158', fill: 'rgba(48,209,88,0.08)' },
  network: { line: '#64d2ff', fill: 'rgba(100,210,255,0.08)' },
  disk: { line: '#ff9f0a', fill: 'rgba(255,159,10,0.08)' },
};

const CHART_DEFAULTS = {
  borderWidth: 1.5,
  tension: 0.4,
  pointRadius: 0,
  pointHoverRadius: 4,
  fill: true,
};

const gridColor = 'rgba(255,255,255,0.04)';
const tickColor = 'rgba(235,235,245,0.3)';

function lineDataset(label, colorConfig) {
  return {
    label,
    data: [],
    borderColor: colorConfig.line,
    backgroundColor: colorConfig.fill,
    ...CHART_DEFAULTS,
  };
}

function chartOpts(yLabel) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 360, easing: 'easeOutQuart' },
    plugins: {
      legend: {
        labels: {
          color: tickColor,
          font: { family: 'DM Sans', size: 11, weight: '500' },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: tickColor,
          font: { family: 'DM Sans', size: 10 },
          maxTicksLimit: 8,
        },
        grid: { color: gridColor },
      },
      y: {
        ticks: {
          color: tickColor,
          font: { family: 'DM Sans', size: 10 },
        },
        grid: { color: gridColor },
        title: {
          display: true,
          text: yLabel,
          color: tickColor,
          font: { family: 'DM Sans', size: 11, weight: '500' },
        },
      },
    },
  };
}

function initCharts() {
  const c = (id) => document.getElementById(id)?.getContext('2d');
  if (!c('chartCpu')) return;

  cpuChart = new Chart(c('chartCpu'), {
    type: 'line',
    data: { labels: [], datasets: [lineDataset('CPU %', CHART_COLORS.cpu)] },
    options: chartOpts('%'),
  });

  memChart = new Chart(c('chartMem'), {
    type: 'line',
    data: { labels: [], datasets: [lineDataset('Memory (GB)', CHART_COLORS.memory)] },
    options: chartOpts('GB'),
  });

  netChart = new Chart(c('chartNet'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        lineDataset('In (MB/s)', CHART_COLORS.network),
        lineDataset('Out (MB/s)', CHART_COLORS.disk),
      ],
    },
    options: chartOpts('MB/s'),
  });

  diskChart = new Chart(c('chartDisk'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        lineDataset('Read (MB/s)', CHART_COLORS.disk),
        lineDataset('Write (MB/s)', CHART_COLORS.memory),
      ],
    },
    options: chartOpts('MB/s'),
  });
}

async function loadMonitoringData() {
  const select = document.getElementById('monitorTarget');
  if (!select || !select.value) return;

  const val = select.value;
  const endpoint = val.includes('/')
    ? `/nodes/${val.split('/')[0]}/vms/${val.split('/')[1]}/rrddata`
    : `/nodes/${val}/rrddata`;

  try {
    const res = await ApiClient.get(endpoint);
    const data = res.data || [];
    const labels = data.map((d) =>
      new Date(d.time * 1000).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    );

    if (cpuChart) {
      cpuChart.data.labels = labels;
      cpuChart.data.datasets[0].data = data.map((d) => d.cpu ?? 0);
      cpuChart.update();
    }
    if (memChart) {
      memChart.data.labels = labels;
      memChart.data.datasets[0].data = data.map((d) => (d.mem || 0) / 1073741824);
      memChart.update();
    }
    if (netChart) {
      netChart.data.labels = labels;
      netChart.data.datasets[0].data = data.map((d) => (d.netin || 0) / 1048576);
      netChart.data.datasets[1].data = data.map((d) => (d.netout || 0) / 1048576);
      netChart.update();
    }
    if (diskChart) {
      diskChart.data.labels = labels;
      diskChart.data.datasets[0].data = data.map((d) => (d.diskread || 0) / 1048576);
      diskChart.data.datasets[1].data = data.map((d) => (d.diskwrite || 0) / 1048576);
      diskChart.update();
    }
  } catch (e) {
    console.error('Monitoring error:', e);
  }
}

function populateMonitorTargets() {
  const select = document.getElementById('monitorTarget');
  if (!select) return;

  let opts = `<option value="">-- ${t('select_node_vm')} --</option>`;
  allNodes.forEach((n) => {
    opts += `<option value="${n.node}">NODE · ${n.node}</option>`;
  });
  allVms
    .filter((v) => v.status === 'running')
    .forEach((v) => {
      opts += `<option value="${v.node}/${v.vmid}">VM · ${v.name} (${v.vmid})</option>`;
    });

  select.innerHTML = opts;
}

function startMonitoringRefresh() {
  if (monitorInterval) clearInterval(monitorInterval);
  monitorInterval = setInterval(loadMonitoringData, 60000);
}

document.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('monitorTarget');
  if (sel) {
    sel.addEventListener('change', () => {
      loadMonitoringData();
      startMonitoringRefresh();
    });
  }
});

