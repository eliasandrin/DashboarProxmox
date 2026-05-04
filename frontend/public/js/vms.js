/* INFORMIX Spa — VM/CT Inventory Module */
let currentFilter = 'all';

function vmActionButtons(vm) {
  if (vm.status === 'stopped') {
    return `<button class="btn btn-sm btn-success" onclick="vmAction('${vm.node}',${vm.vmid},'start','${vm.type}','${vm.name}')">Start</button>`;
  }

  if (vm.status === 'running') {
    return `
      <button class="btn btn-sm btn-warning" onclick="vmAction('${vm.node}',${vm.vmid},'shutdown','${vm.type}','${vm.name}')">Shutdown</button>
      <button class="btn btn-sm btn-outline" onclick="vmAction('${vm.node}',${vm.vmid},'reboot','${vm.type}','${vm.name}')">Reboot</button>
      <button class="btn btn-sm btn-danger" onclick="vmAction('${vm.node}',${vm.vmid},'stop','${vm.type}','${vm.name}')">Stop</button>
      ${vm.type === 'qemu' ? `<button class="btn btn-sm btn-outline" onclick="vmMigrateDialog('${vm.node}',${vm.vmid},'${vm.name}')">Migrate</button>` : ''}
    `;
  }

  return '';
}

async function loadVmTable() {
  const tbody = document.getElementById('vmTableBody');
  if (!tbody) return;

  try {
    if (allVms.length === 0) {
      const data = await ApiClient.get('/vms/all');
      allVms = data.vms || [];
    }
    renderVmTable(allVms);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" class="alert alert-error">${e.message}</td></tr>`;
  }
}

function renderVmTable(vms) {
  const tbody = document.getElementById('vmTableBody');
  const vmCards = document.getElementById('vmCards');
  const search = (document.getElementById('vmSearch')?.value || '').toLowerCase();

  const filtered = vms.filter((v) => {
    if (search && !v.name.toLowerCase().includes(search) && !String(v.vmid).includes(search)) return false;
    if (currentFilter === 'running') return v.status === 'running';
    if (currentFilter === 'stopped') return v.status === 'stopped';
    if (currentFilter === 'qemu') return v.type === 'qemu';
    if (currentFilter === 'lxc') return v.type === 'lxc';
    return true;
  });

  const renderCards = () => {
    if (!vmCards) return;
    if (filtered.length === 0) {
      vmCards.innerHTML = '<div class="vm-card-empty">No VMs match your filter</div>';
      return;
    }

    vmCards.innerHTML = filtered
      .map(
        (vm) => `
      <article class="vm-mobile-card">
        <div class="vm-mobile-top">
          <div>
            <div class="vm-name">${vm.name}</div>
            <div class="vm-id">ID ${vm.vmid} • ${vm.node}</div>
          </div>
          <div class="vm-mobile-badges">
            <span class="status-badge ${vm.status}">${vm.status}</span>
            <span class="badge badge-${vm.type}">${vm.type.toUpperCase()}</span>
          </div>
        </div>
        <div class="vm-mobile-metrics">
          <span>CPU: ${vm.status === 'running' ? `${vm.cpu.toFixed(1)}%` : '—'}</span>
          <span>RAM: ${vm.status === 'running' ? `${formatBytes(vm.mem)} / ${formatBytes(vm.maxmem)}` : '—'}</span>
        </div>
        <div class="vm-mobile-actions">
          ${vmActionButtons(vm)}
        </div>
      </article>
    `
      )
      .join('');
  };

  renderCards();

  if (filtered.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align:center; padding:40px; color:var(--text-muted);">No VMs match your filter</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (vm) => `
    <tr>
      <td><span class="vm-id">${vm.vmid}</span></td>
      <td><span class="vm-name">${vm.name}</span></td>
      <td><span class="status-badge ${vm.status}">${vm.status}</span></td>
      <td><span class="badge badge-${vm.type}">${vm.type.toUpperCase()}</span></td>
      <td>${vm.node}</td>
      <td>${vm.status === 'running' ? `${vm.cpu.toFixed(1)}%` : '—'}</td>
      <td>${vm.status === 'running' ? `${formatBytes(vm.mem)} / ${formatBytes(vm.maxmem)}` : '—'}</td>
      <td>
        <div class="action-group">
          ${vm.status === 'stopped' ? `<button class="btn btn-sm btn-success btn-icon" onclick="vmAction('${vm.node}',${vm.vmid},'start','${vm.type}','${vm.name}')" title="Start">▶</button>` : ''}
          ${
            vm.status === 'running'
              ? `
            <button class="btn btn-sm btn-warning btn-icon" onclick="vmAction('${vm.node}',${vm.vmid},'shutdown','${vm.type}','${vm.name}')" title="Shutdown">■</button>
            <button class="btn btn-sm btn-outline btn-icon" onclick="vmAction('${vm.node}',${vm.vmid},'reboot','${vm.type}','${vm.name}')" title="Reboot">↻</button>
            <button class="btn btn-sm btn-danger btn-icon" onclick="vmAction('${vm.node}',${vm.vmid},'stop','${vm.type}','${vm.name}')" title="Force Stop">!</button>
            ${vm.type === 'qemu' ? `<button class="btn btn-sm btn-outline btn-icon" onclick="vmMigrateDialog('${vm.node}',${vm.vmid},'${vm.name}')" title="Migrate">⇄</button>` : ''}
          `
              : ''
          }
        </div>
      </td>
    </tr>
  `
    )
    .join('');
}

function vmAction(node, vmid, action, type, name) {
  const msg = t('confirm_action', { action: action.toUpperCase(), name: `${name} (${vmid})` });
  showModal(action.toUpperCase(), msg, async () => {
    try {
      const ep =
        type === 'lxc'
          ? `/nodes/${node}/containers/${vmid}/status/${action}`
          : `/nodes/${node}/vms/${vmid}/status/${action}`;
      const res = await ApiClient.post(ep, {});
      showToast(res.message, 'success');
      setTimeout(async () => {
        const data = await ApiClient.get('/vms/all');
        allVms = data.vms || [];
        renderVmTable(allVms);
      }, 1000);
    } catch (e) {
      showToast(e.message, 'error');
    }
  });
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('filter-btn')) {
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    e.target.classList.add('active');
    currentFilter = e.target.dataset.filter;
    renderVmTable(allVms);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const search = document.getElementById('vmSearch');
  if (search) search.addEventListener('input', () => renderVmTable(allVms));
});

function showModal(title, body, onConfirm, formHtml = '') {
  const overlay = document.getElementById('modalOverlay');
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').textContent = body;
  document.getElementById('modalForm').innerHTML = formHtml;
  overlay.classList.add('active');

  const confirmBtn = document.getElementById('modalConfirm');
  const newBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
  newBtn.id = 'modalConfirm';
  newBtn.textContent = t('confirm');
  newBtn.addEventListener('click', () => {
    overlay.classList.remove('active');
    onConfirm();
  });

  document.getElementById('modalCancel').onclick = () => overlay.classList.remove('active');
}

function vmMigrateDialog(currentNode, vmid, name) {
  const targetNode = prompt(
    `Inserisci il nodo di destinazione per ${name} (${vmid}):\n(Attuale: ${currentNode})`
  );
  if (!targetNode || targetNode === currentNode) return;

  const msg = `Sei sicuro di voler migrare ${name} a ${targetNode}?`;
  showModal('MIGRATE', msg, async () => {
    try {
      const res = await ApiClient.post('/migrate', {
        vmid,
        source_node: currentNode,
        target_node: targetNode,
        online: true,
      });
      showToast(res.message, 'success');
      setTimeout(async () => {
        loadVmTable();
      }, 3000);
    } catch (e) {
      showToast(`Errore Migration: ${e.message}`, 'error');
    }
  });
}

