/* INFORMIX Spa — Cluster & Migration Module */

async function loadCluster() {
  await loadClusterTree();
  populateMigrationSelects();
}

async function loadClusterTree() {
  const container = document.getElementById('clusterTree');
  if (!container) return;

  try {
    const data = await ApiClient.get('/cluster/resources');
    const resources = data.resources || [];
    const nodes = resources.filter((r) => r.type === 'node');
    const vms = resources.filter((r) => r.type === 'qemu' || r.type === 'lxc');

    let html = `<div style="margin-bottom:12px; font-size:.85rem; color:var(--text-secondary);">INFORMIX-Cluster · ${data.node_count} nodes, ${data.vm_count} VMs, ${data.ct_count} CTs</div>`;

    nodes.forEach((node) => {
      const nodeVms = vms.filter((v) => v.node === node.node);
      const cpuPct = ((node.cpu || 0) * 100).toFixed(1);

      html += `
        <div class="tree-node">
          <div class="tree-node-header">
            <span class="tree-node-icon">NODE</span>
            <strong>${node.name}</strong>
            <span class="status-badge ${node.status === 'online' ? 'running' : 'stopped'}">${node.status}</span>
            <span style="font-size:.75rem; color:var(--text-muted);">CPU ${cpuPct}% · RAM ${formatBytes(node.mem)}/${formatBytes(node.maxmem)}</span>
          </div>
          <div class="tree-children">
      `;

      nodeVms.forEach((vm) => {
        html += `
          <div class="tree-node-header" style="padding-left:16px;">
            <span class="tree-node-icon">${vm.type.toUpperCase()}</span>
            <span>${vm.name}</span><span class="vm-id">#${vm.vmid}</span>
            <span class="status-badge ${vm.status}">${vm.status}</span>
          </div>
        `;
      });

      html += '</div></div>';
    });

    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

function populateMigrationSelects() {
  const vmSel = document.getElementById('migrateVmSelect');
  const nodeSel = document.getElementById('migrateTargetSelect');
  if (!vmSel || !nodeSel) return;

  let vmOpts = '<option value="">-- Select VM --</option>';
  allVms
    .filter((v) => v.type === 'qemu' && v.status === 'running')
    .forEach((v) => {
      vmOpts += `<option value="${v.node}/${v.vmid}">${v.name} (${v.vmid}) - ${v.node}</option>`;
    });
  vmSel.innerHTML = vmOpts;

  let nodeOpts = '<option value="">-- Select Target --</option>';
  allNodes.forEach((n) => {
    nodeOpts += `<option value="${n.node}">${n.node}</option>`;
  });
  nodeSel.innerHTML = nodeOpts;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('migrateBtn')?.addEventListener('click', () => {
    const vmVal = document.getElementById('migrateVmSelect')?.value;
    const target = document.getElementById('migrateTargetSelect')?.value;
    if (!vmVal || !target) {
      showToast('Select VM and target node', 'error');
      return;
    }

    const [sourceNode, vmid] = vmVal.split('/');
    if (sourceNode === target) {
      showToast('Source and target are the same node', 'error');
      return;
    }

    showModal(t('live_migration'), `Migrate VM ${vmid} from ${sourceNode} to ${target}?`, async () => {
      const status = document.getElementById('migrationStatus');
      status.innerHTML = '<div class="spinner"></div> Migration in progress...';

      try {
        const res = await ApiClient.post('/cluster/migrate', {
          vmid: parseInt(vmid, 10),
          source_node: sourceNode,
          target_node: target,
          online: true,
        });

        if (res.status === 'ok') {
          status.innerHTML = `<div class="alert alert-success">${res.message}</div>`;
          showToast(t('migration_started'), 'success');
          setTimeout(() => {
            loadClusterTree();
            loadDashboard();
          }, 2000);
        } else {
          status.innerHTML = `<div class="alert alert-error">${res.message}</div>`;
        }
      } catch (e) {
        status.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
        showToast(t('migration_failed'), 'error');
      }
    });
  });
});

