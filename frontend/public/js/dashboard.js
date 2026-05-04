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
        <label>${t('vm_type')}</label>
        <select id="createVmType" style="width:100%; padding:10px; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text-primary); font-family:inherit;">
          <option value="qemu">QEMU (VM)</option>
          <option value="lxc">LXC (CT)</option>
        </select>
      </div>
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
        <textarea id="createVmDesc" rows="2" placeholder="Descrizione VM/CT" style="width:100%;"></textarea>
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
      <div id="isoFields">
        <div class="grid grid-2">
          <div class="form-group">
            <label>${t('iso_storage')}</label>
            <input id="createVmIsoStorage" type="text" value="local" style="width:100%;">
          </div>
          <div class="form-group">
            <label>${t('iso_file')}</label>
            <input id="createVmIsoFile" type="file" accept=".iso" style="width:100%;">
          </div>
        </div>
        <div id="isoUploadStatus" style="font-size:.8rem; color:var(--text-muted);"></div>
      </div>
      <div id="ctTemplateFields" style="display:none;">
        <div class="form-group">
          <label>${t('ct_template')}</label>
          <input id="createCtTemplate" type="text" placeholder="local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst" style="width:100%;">
        </div>
      </div>
    `;

    showModal(t('create_vm_ct'), '', async () => {
      const vmType = document.getElementById('createVmType')?.value || 'qemu';
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
      if (vmType === 'qemu') {
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

      if (vmType === 'qemu') {
        const isoStorage = document.getElementById('createVmIsoStorage')?.value?.trim() || 'local';
        if (isoFileName) {
          payload.iso_storage = isoStorage;
          payload.iso_file = isoFileName;
        }
      } else {
        const template = document.getElementById('createCtTemplate')?.value?.trim();
        if (!template) {
          showToast('Template CT obbligatorio', 'error');
          return;
        }
        payload.ct_template = template;
      }

      try {
        const res = await ApiClient.post(`/nodes/${node}/provision`, payload);
        showToast(res.message || 'Creazione avviata', 'success');
        setTimeout(async () => {
          const data = await ApiClient.get('/vms/all');
          allVms = data.vms || [];
          renderVmTable(allVms);
        }, 1500);
      } catch (e) {
        showToast(e.message, 'error');
      }
    }, formHtml);

    const typeSelect = document.getElementById('createVmType');
    const isoFields = document.getElementById('isoFields');
    const ctFields = document.getElementById('ctTemplateFields');
    if (typeSelect) {
      typeSelect.addEventListener('change', () => {
        const isQemu = typeSelect.value === 'qemu';
        if (isoFields) isoFields.style.display = isQemu ? '' : 'none';
        if (ctFields) ctFields.style.display = isQemu ? 'none' : '';
      });
    }
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function initCreateVmButton() {
  const btn = document.getElementById('createVmBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    await openCreateVmModal();
  });
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
      <div class="grid grid-4">
        <div style="text-align:center; padding:16px;">
          <div style="font-size:2rem; font-weight:800; color:var(--accent); font-family:var(--font-mono);">${allVms.length}</div>
          <div style="font-size:.8rem; color:var(--text-muted);">Total</div>
        </div>
        <div style="text-align:center; padding:16px;">
          <div style="font-size:2rem; font-weight:800; color:var(--green); font-family:var(--font-mono);">${running}</div>
          <div style="font-size:.8rem; color:var(--text-muted);">Running</div>
        </div>
        <div style="text-align:center; padding:16px;">
          <div style="font-size:2rem; font-weight:800; color:var(--red); font-family:var(--font-mono);">${stopped}</div>
          <div style="font-size:.8rem; color:var(--text-muted);">Stopped</div>
        </div>
        <div style="text-align:center; padding:16px;">
          <div style="font-size:2rem; font-weight:800; color:var(--cyan); font-family:var(--font-mono);">${qemu} VM / ${lxc} CT</div>
          <div style="font-size:.8rem; color:var(--text-muted);">By Type</div>
        </div>
      </div>`;
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initCreateVmButton();
  document.addEventListener('click', (event) => {
    const target = event.target.closest('#createVmBtn');
    if (target) openCreateVmModal();
  });
});


