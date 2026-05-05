/* INFORMIX Spa — Backup & Snapshot Module */

let backupPollTimer = null;

function getSelectedBackupStorage() {
  const sel = document.getElementById('backupStorageSelect');
  return sel?.value || '';
}

function setBackupStatus(message, type = 'info') {
  const el = document.getElementById('backupStatus');
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.style.display = 'flex';
}

function clearBackupStatus() {
  const el = document.getElementById('backupStatus');
  if (!el) return;
  el.style.display = 'none';
  el.textContent = '';
}

function parseBackupProgress(logs) {
  if (!Array.isArray(logs)) return null;
  let lastPercent = null;
  logs.forEach((line) => {
    const text = line?.t || '';
    const matches = text.match(/(\d{1,3})%/g);
    if (!matches) return;
    matches.forEach((m) => {
      const val = parseInt(m.replace('%', ''), 10);
      if (!Number.isNaN(val)) lastPercent = Math.min(100, Math.max(0, val));
    });
  });
  return lastPercent;
}

function populateBackupVmSelect() {
  const sel = document.getElementById('backupVmSelect');
  if (!sel) return;

  let opts = '<option value="">-- Select --</option>';
  allVms.forEach((v) => {
    opts += `<option value="${v.node}/${v.vmid}/${v.type}" data-name="${v.name}">${v.name} (${v.vmid}) - ${v.node}</option>`;
  });
  sel.innerHTML = opts;
}

async function loadSnapshots(node, vmid, type) {
  const container = document.getElementById('snapshotList');
  if (!container) return;

  try {
    const data = await ApiClient.get(`/nodes/${node}/vms/${vmid}/snapshots?vm_type=${type}`);
    const snaps = data.snapshots || [];
    if (snaps.length === 0) {
      container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted);">${t('no_snapshots')}</div>`;
      return;
    }

    container.innerHTML = snaps
      .map((s) => {
        const timeInfo = s.snaptime ? ` · ${formatTimestamp(s.snaptime)}` : '';
        const ramInfo = s.vmstate ? ' · RAM' : '';
        return `
          <div class="snapshot-item">
            <div>
              <div class="snapshot-name">Snapshot ${s.name}</div>
              <div class="snapshot-meta">${s.description || ''}${timeInfo}${ramInfo}</div>
            </div>
          </div>
        `;
      })
      .join('');
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

async function loadBackupHistory(vmid, storage) {
  const container = document.getElementById('backupList');
  if (!container) return;

  const targetStorage = storage || getSelectedBackupStorage();
  if (!targetStorage) {
    container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted);">${t('select_backup_storage')}</div>`;
    return;
  }

  try {
    const encodedStorage = encodeURIComponent(targetStorage);
    const url = vmid ? `/storage/${encodedStorage}/content?vmid=${vmid}` : `/storage/${encodedStorage}/content`;
    const data = await ApiClient.get(url);
    if (data.warning) document.getElementById('pbsWarning').style.display = 'flex';

    const backups = data.backups || [];
    if (backups.length === 0) {
      container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted);">${t('no_backups')}</div>`;
      return;
    }

    container.innerHTML = backups
      .map(
        (b) => `
      <div class="backup-item">
        <div>
          <div style="font-weight:600; font-size:.85rem;">VM ${b.vmid || '?'}</div>
          <div style="font-size:.75rem; color:var(--text-muted);">${formatTimestamp(b.ctime)} · ${formatBytes(b.size)} · ${b.format}</div>
          ${b.notes ? `<div style="font-size:.73rem; color:var(--text-secondary);">${b.notes}</div>` : ''}
        </div>
      </div>
    `
      )
      .join('');
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

async function loadBackupStorages() {
  const sel = document.getElementById('backupStorageSelect');
  if (!sel) return;

  sel.innerHTML = '<option value="">-- Loading --</option>';

  try {
    const data = await ApiClient.get('/storages');
    const storages = data.storages || [];

    const unique = new Map();
    storages.forEach((s) => {
      const name = s.storage || s.name;
      if (!name) return;
      if (!unique.has(name)) unique.set(name, s);
    });

    const list = Array.from(unique.values());
    if (list.length === 0) {
      sel.innerHTML = '<option value="">-- No backup storage --</option>';
      return;
    }

    list.sort((a, b) => (a.storage || a.name).localeCompare(b.storage || b.name));
    const previous = sel.value;
    sel.innerHTML = list
      .map((s) => {
        const name = s.storage || s.name;
        const suffix = s.type ? ` · ${s.type}` : '';
        return `<option value="${name}">${name}${suffix}</option>`;
      })
      .join('');

    if (previous && list.some((s) => (s.storage || s.name) === previous)) {
      sel.value = previous;
    } else if (data.default_storage) {
      sel.value = data.default_storage;
    }

    const vmVal = document.getElementById('backupVmSelect')?.value;
    const vmid = vmVal ? parseInt(vmVal.split('/')[1], 10) : null;
    loadBackupHistory(vmid, sel.value);
  } catch (e) {
    sel.innerHTML = `<option value="">${e.message}</option>`;
  }
}

async function pollBackupTask(node, upid, vmid) {
  if (!upid) return;
  if (backupPollTimer) clearInterval(backupPollTimer);

  let attempts = 0;
  setBackupStatus(`Backup in corso (task ${upid}).`, 'info');

  backupPollTimer = setInterval(async () => {
    attempts += 1;
    try {
      const status = await ApiClient.get(`/nodes/${node}/tasks/${encodeURIComponent(upid)}/status`);
      const state = status.status || 'unknown';
      const exitStatus = status.exitstatus || '';

      let progressText = '';
      if (state !== 'stopped') {
        try {
          const logResp = await ApiClient.get(`/nodes/${node}/tasks/${encodeURIComponent(upid)}/log?start=0&limit=200`);
          const percent = parseBackupProgress(logResp.logs || []);
          if (percent !== null) progressText = `, ${percent}%`;
        } catch {}
      }

      if (state === 'stopped') {
        clearInterval(backupPollTimer);
        backupPollTimer = null;
        if (exitStatus && exitStatus.toUpperCase() === 'OK') {
          setBackupStatus('Backup completato con successo.', 'success');
        } else {
          setBackupStatus(`Backup terminato con stato: ${exitStatus || 'error'}`, 'error');
        }
        setTimeout(() => clearBackupStatus(), 5000);
        loadBackupHistory(parseInt(vmid, 10));
        return;
      }

      setBackupStatus(`Backup in corso (stato: ${state}${progressText}).`, 'info');
    } catch (e) {
      clearInterval(backupPollTimer);
      backupPollTimer = null;
      setBackupStatus(`Impossibile leggere lo stato backup: ${e.message}`, 'error');
    }

    if (attempts >= 60) {
      clearInterval(backupPollTimer);
      backupPollTimer = null;
      setBackupStatus('Backup avviato. Stato non disponibile (timeout).', 'warning');
    }
  }, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('backupVmSelect');
  if (sel) {
    sel.addEventListener('change', () => {
      const val = sel.value;
      if (!val) return;
      const [node, vmid, type] = val.split('/');
      loadSnapshots(node, vmid, type);
      loadBackupHistory(parseInt(vmid, 10));
    });
  }

  document.getElementById('backupStorageSelect')?.addEventListener('change', () => {
    const vmVal = document.getElementById('backupVmSelect')?.value;
    const vmid = vmVal ? parseInt(vmVal.split('/')[1], 10) : null;
    loadBackupHistory(vmid);
  });

  document.getElementById('createSnapshotBtn')?.addEventListener('click', () => {
    const val = document.getElementById('backupVmSelect')?.value;
    if (!val) {
      showToast('Select a VM first', 'error');
      return;
    }

    const [node, vmid, type] = val.split('/');
    const formHtml = `<div class="form-group"><label>${t('snapshot_name')}</label><input type="text" id="snapName" value="snap-${Date.now()}" style="width:100%; padding:10px; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text-primary); font-family:inherit;"></div><div class="form-group"><label>${t('snapshot_desc')}</label><input type="text" id="snapDesc" placeholder="Optional" style="width:100%; padding:10px; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text-primary); font-family:inherit;"></div>`;

    showModal(t('create_snapshot'), '', async () => {
      try {
        const name = document.getElementById('snapName').value || `snap-${Date.now()}`;
        const desc = document.getElementById('snapDesc')?.value || '';
        await ApiClient.post(`/nodes/${node}/vms/${vmid}/snapshots?vm_type=${type}`, {
          name,
          description: desc,
          include_ram: false,
        });
        showToast(`Snapshot '${name}' created`, 'success');
        loadSnapshots(node, vmid, type);
      } catch (e) {
        showToast(e.message, 'error');
      }
    }, formHtml);
  });

  document.getElementById('createBackupBtn')?.addEventListener('click', () => {
    const val = document.getElementById('backupVmSelect')?.value;
    if (!val) {
      showToast('Select a VM first', 'error');
      return;
    }

    const [node, vmid] = val.split('/');
    const storage = getSelectedBackupStorage();
    if (!storage) {
      showToast(t('select_backup_storage'), 'error');
      return;
    }

    showModal(t('start_backup'), `Start backup of VM ${vmid} to ${storage}?`, async () => {
      try {
        const res = await ApiClient.post(`/nodes/${node}/vms/${vmid}/backup`, {
          storage,
          mode: 'snapshot',
          compress: 'zstd',
        });

        if (res.status === 'ok') {
          showToast(t('backup_started'), 'success');
          if (res.task_id) {
            pollBackupTask(node, res.task_id, vmid);
          }
        } else {
          showToast(res.message, 'error');
          document.getElementById('pbsWarning').style.display = 'flex';
        }
        if (!res.task_id) loadBackupHistory(parseInt(vmid, 10), storage);
      } catch (e) {
        showToast(`${t('backup_failed')}: ${e.message}`, 'error');
      }
    });
  });
});

