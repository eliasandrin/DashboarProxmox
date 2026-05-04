/* INFORMIX Spa - Dashboard Module */
let allNodes = [];
let allVms = [];

async function loadDashboard() {
  await Promise.all([loadNodes(), loadQuickVmList()]);
}

function ensureShowModal() {
  if (typeof window.showModal === 'function') return window.showModal;

  return function showModalFallback(title, body, onConfirm, formHtml = '') {
    const overlay = document.getElementById('modalOverlay');
    if (!overlay) return;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').textContent = body;
    document.getElementById('modalForm').innerHTML = formHtml;
    overlay.classList.add('active');
    const confirmBtn = document.getElementById('modalConfirm');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    newBtn.id = 'modalConfirm';
    newBtn.textContent = t('confirm');
    newBtn.addEventListener('click', () => { overlay.classList.remove('active'); onConfirm(); });
    document.getElementById('modalCancel').onclick = () => overlay.classList.remove('active');
  };
}

async function openCreateVmModal() {
  const showModal = ensureShowModal();
  try {
    if (allNodes.length === 0) {
      const data = await ApiClient.get('/nodes');
      allNodes = data.nodes || [];
    }

    const nodeOptions = allNodes.map(n => `<option value="${n.node}">${n.node}</option>`).join('');

    const formHtml = `
      <div class="form-group">
        <label>${t('th_node')}</label>
        <select id="createVmNode" style="width:100%; padding:10px; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text-primary); font-family:inherit;">
          ${nodeOptions}
        </select>
      </div>
      <div class="form-group">
        <label>${t('vm_id')}</label>
        <input id="createVmId" type="number" min="100" placeholder="100" style="width:100%;">
      </div>
      <div class="form-group">
        <label>${t('vm_name')}</label>
        <input id="createVmName" type="text" placeholder="vm-prod-01" style="width:100%;">
      </div>
      <div class="form-group">
        <label>${t('vm_description')}</label>
        <textarea id="createVmDesc" rows="2" placeholder="Descrizione VM" style="width:100%;"></textarea>
      </div>
      <div class="grid grid-2">
        <div class="form-group">
          <label>${t('cores')}</label>
          <input id="createVmCores" type="number" min="1" value="2" style="width:100%;">
        </div>
        <div class="form-group">
          <label>${t('ram_mb')}</label>
          <input id="createVmRam" type="number" min="256" value="2048" style="width:100%;">
        </div>
      </div>
      <div class="grid grid-2">
        <div class="form-group">
          <label>${t('disk_gb')}</label>
          <input id="createVmDisk" type="number" min="1" value="20" style="width:100%;">
        </div>
        <div class="form-group">
          <label>${t('network_bridge')}</label>
          <input id="createVmBridge" type="text" value="vmbr0" style="width:100%;">
        </div>
      </div>
      <div class="form-group">
        <label>${t('disk_storage')}</label>
        <input id="createVmDiskStorage" type="text" value="local-lvm" style="width:100%;">
      </div>
      <div class="form-group">
        <label>${t('iso_storage')}</label>
        <input id="createVmIsoStorage" type="text" value="local" style="width:100%;">
      </div>
      <div class="form-group">
        <label>${t('iso_file')}</label>
        <input id="createVmIsoFile" type="file" accept=".iso" style="width:100%;">
      </div>
      <div id="isoUploadStatus" style="font-size:.8rem; color:var(--text-muted);"></div>
    `;

    showModal(t('create_vm'), '', async () => {
      const vmType = 'qemu';
      const node = document.getElementById('createVmNode')?.value;
      const vmid = parseInt(document.getElementById('createVmId')?.value || '0', 10);
      const name = document.getElementById('createVmName')?.value?.trim();
      const description = document.getElementById('createVmDesc')?.value?.trim();
      const cores = parseInt(document.getElementById('createVmCores')?.value || '1', 10);
      const memoryMb = parseInt(document.getElementById('createVmRam')?.value || '1024', 10);
      const diskGb = parseInt(document.getElementById('createVmDisk')?.value || '8', 10);
      const bridge = document.getElementById('createVmBridge')?.value?.trim() || 'vmbr0';
      const diskStorage = document.getElementById('createVmDiskStorage')?.value?.trim() || 'local-lvm';

      if (!node || !vmid || !name) {
        showToast('Compila node, VMID e nome', 'error');
        return;
      }

      let isoFileName = null;
      const isoStorage = document.getElementById('createVmIsoStorage')?.value?.trim() || 'local';
      const isoInput = document.getElementById('createVmIsoFile');
      if (isoInput && isoInput.files && isoInput.files.length > 0) {
        const file = isoInput.files[0];
        const formData = new FormData();
        formData.append('file', file);
        try {
          const upload = await ApiClient.postForm(`/nodes/${node}/iso/upload?storage=${encodeURIComponent(isoStorage)}`, formData);
          isoFileName = upload.iso_file;
          showToast('ISO caricato con successo', 'success');
        } catch (e) {
          showToast(e.message, 'error');
          return;
        }
      }

      const payload = {
        vm_type: vmType,
        vmid: vmid,
        name: name,
        description: description || '',
        cores: cores,
        memory_mb: memoryMb,
        disk_gb: diskGb,
        network_bridge: bridge,
        disk_storage: diskStorage,
      };

      if (isoFileName) {
        payload.iso_storage = isoStorage;
        payload.iso_file = isoFileName;
      }

      try {
        const res = await ApiClient.post(`/nodes/${node}/provision`, payload);
        showToast(res.message || 'Creazione VM avviata', 'success');
        setTimeout(async () => {
          const data = await ApiClient.get('/vms/all');
          allVms = data.vms || [];
          renderVmTable(allVms);
        }, 1500);
      } catch (e) {
        showToast(e.message, 'error');
      }
    }, formHtml);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function openCreateCtModal() {
  const showModal = ensureShowModal();
  try {
    if (allNodes.length === 0) {
      const data = await ApiClient.get('/nodes');
      allNodes = data.nodes || [];
    }

    const nodeOptions = allNodes.map(n => `<option value="${n.node}">${n.node}</option>`).join('');

    const formHtml = `
      <div class="form-group">
        <label>${t('th_node')}</label>
        <select id="createCtNode" style="width:100%; padding:10px; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text-primary); font-family:inherit;">
          ${nodeOptions}
        </select>
      </div>
      <div class="form-group">
        <label>${t('vm_id')}</label>
        <input id="createCtId" type="number" min="100" placeholder="100" style="width:100%;">
      </div>
      <div class="form-group">
        <label>${t('vm_name')}</label>
        <input id="createCtName" type="text" placeholder="ct-prod-01" style="width:100%;">
      </div>
      <div class="form-group">
        <label>${t('vm_description')}</label>
        <textarea id="createCtDesc" rows="2" placeholder="Descrizione Container" style="width:100%;"></textarea>
      </div>
      <div class="grid grid-2">
        <div class="form-group">
          <label>${t('cores')}</label>
          <input id="createCtCores" type="number" min="1" value="2" style="width:100%;">
        </div>
        <div class="form-group">
          <label>${t('ram_mb')}</label>
          <input id="createCtRam" type="number" min="256" value="2048" style="width:100%;">
        </div>
      </div>
      <div class="grid grid-2">
        <div class="form-group">
          <label>${t('disk_gb')}</label>
          <input id="createCtDisk" type="number" min="1" value="20" style="width:100%;">
        </div>
        <div class="form-group">
          <label>${t('network_bridge')}</label>
          <input id="createCtBridge" type="text" value="vmbr0" style="width:100%;">
        </div>
      </div>
      <div class="form-group">
        <label>${t('disk_storage')}</label>
        <input id="createCtDiskStorage" type="text" value="local-lvm" style="width:100%;">
      </div>
      <div class="form-group">
        <label>${t('ct_template')}</label>
        <input id="createCtTemplate" type="text" placeholder="local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst" style="width:100%;">
      </div>
    `;

    showModal(t('create_ct'), '', async () => {
      const vmType = 'lxc';
      const node = document.getElementById('createCtNode')?.value;
      const vmid = parseInt(document.getElementById('createCtId')?.value || '0', 10);
      const name = document.getElementById('createCtName')?.value?.trim();
      const description = document.getElementById('createCtDesc')?.value?.trim();
      const cores = parseInt(document.getElementById('createCtCores')?.value || '1', 10);
      const memoryMb = parseInt(document.getElementById('createCtRam')?.value || '1024', 10);
      const diskGb = parseInt(document.getElementById('createCtDisk')?.value || '8', 10);
      const bridge = document.getElementById('createCtBridge')?.value?.trim() || 'vmbr0';
      const diskStorage = document.getElementById('createCtDiskStorage')?.value?.trim() || 'local-lvm';
      const template = document.getElementById('createCtTemplate')?.value?.trim();

      if (!node || !vmid || !name) {
        showToast('Compila node, CTID e nome', 'error');
        return;
      }

      if (!template) {
        showToast('Template CT obbligatorio', 'error');
        return;
      }

      const payload = {
        vm_type: vmType,
        vmid: vmid,
        name: name,
        description: description || '',
        cores: cores,
        memory_mb: memoryMb,
        disk_gb: diskGb,
        network_bridge: bridge,
        disk_storage: diskStorage,
        ct_template: template,
      };

      try {
        const res = await ApiClient.post(`/nodes/${node}/provision`, payload);
        showToast(res.message || 'Creazione CT avviata', 'success');
        setTimeout(async () => {
          const data = await ApiClient.get('/vms/all');
          allVms = data.vms || [];
          renderVmTable(allVms);
        }, 1500);
      } catch (e) {
        showToast(e.message, 'error');
      }
    }, formHtml);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function initCreateButtons() {
  const vmBtn = document.getElementById('createVmBtn');
  const ctBtn = document.getElementById('createCtBtn');
  
  if (vmBtn) {
    vmBtn.addEventListener('click', async () => {
      await openCreateVmModal();
    });
  }
  
  if (ctBtn) {
    ctBtn.addEventListener('click', async () => {
      await openCreateCtModal();
    });
  }
}

async function loadNodes() {
  const grid = document.getElementById('nodesGrid');
  if (!grid) return;
  try {
    const data = await ApiClient.get('/nodes');
    allNodes = data.nodes || [];
    grid.innerHTML = allNodes.map(n => renderNodeCard(n)).join('');
  } catch (e) {
    grid.innerHTML = `<div class="alert alert-error">Failed to load nodes: ${e.message}</div>`;
  }
}

function renderNodeCard(n) {
  const usageClass = (value) => {
    if (value > 85) return 'high';
    if (value >= 60) return 'medium';
    return 'low';
  };

  const cpuClass = usageClass(n.cpu || 0);
  const memClass = usageClass(n.mem_percent || 0);
  const diskClass = usageClass(n.disk_percent || 0);
  const nodeStatus = (n.status || '').toLowerCase() === 'online' ? 'online' : 'offline';
  const nodeName = (n.node || '').toUpperCase();

  return `
    <div class="card node-card">
      <div class="card-header">
        <h3>${nodeName}</h3>
        <div class="node-status-badge ${nodeStatus}">${nodeStatus}</div>
      </div>
      <div class="metric">
        <div class="metric-header"><span class="metric-label">CPU</span><span class="metric-value">${n.cpu.toFixed(1)}% (${n.maxcpu} ${t('cores')})</span></div>
        <div class="resource-bar-track"><div class="resource-bar-fill ${cpuClass}" style="width:${n.cpu}%"></div></div>
      </div>
      <div class="metric">
        <div class="metric-header"><span class="metric-label">RAM</span><span class="metric-value">${formatBytes(n.mem)} / ${formatBytes(n.maxmem)}</span></div>
        <div class="resource-bar-track"><div class="resource-bar-fill ${memClass}" style="width:${n.mem_percent}%"></div></div>
      </div>
      <div class="metric">
        <div class="metric-header"><span class="metric-label">Storage</span><span class="metric-value">${formatBytes(n.disk)} / ${formatBytes(n.maxdisk)}</span></div>
        <div class="resource-bar-track"><div class="resource-bar-fill ${diskClass}" style="width:${n.disk_percent}%"></div></div>
      </div>
      <div class="node-footer">
        <div class="node-stat"><div class="value">${formatUptime(n.uptime)}</div><div class="label">${t('uptime')}</div></div>
      </div>
    </div>`;
}
async function loadQuickVmList() {
  const container = document.getElementById('quickVmList');
  if (!container) return;
  try {
    const data = await ApiClient.get('/vms/all');
    allVms = data.vms || [];
    const running = allVms.filter(v => v.status === 'running').length;
    const stopped = allVms.filter(v => v.status === 'stopped').length;
    const qemu = allVms.filter(v => v.type === 'qemu').length;
    const lxc = allVms.filter(v => v.type === 'lxc').length;
    container.innerHTML = `
      <div class="stats-item">
        <span class="stats-label">Total:</span>
        <span class="stats-value" style="color:var(--accent);">${allVms.length}</span>
      </div>
      <div class="stats-item">
        <span class="stats-label">Running:</span>
        <span class="stats-value" style="color:var(--green);">${running}</span>
      </div>
      <div class="stats-item">
        <span class="stats-label">Stopped:</span>
        <span class="stats-value" style="color:var(--red);">${stopped}</span>
      </div>
      <div class="stats-item">
        <span class="stats-label">Type:</span>
        <span class="stats-value" style="color:var(--cyan);">${qemu} VM / ${lxc} CT</span>
      </div>`;
  } catch (e) {
    container.innerHTML = `<div style="color:var(--text-muted); font-size:.85rem;">Error loading stats</div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initCreateButtons();
  document.addEventListener('click', (event) => {
    const vmTarget = event.target.closest('#createVmBtn');
    const ctTarget = event.target.closest('#createCtBtn');
    if (vmTarget) openCreateVmModal();
    if (ctTarget) openCreateCtModal();
  });
});


