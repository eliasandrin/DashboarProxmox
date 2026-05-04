/* INFORMIX Spa — Backup & Snapshot Module */

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

async function loadBackupHistory(vmid) {
  const container = document.getElementById('backupList');
  if (!container) return;

  try {
    const url = vmid ? `/storage/pbs/content?vmid=${vmid}` : '/storage/pbs/content';
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
    showModal(t('start_backup'), `Start backup of VM ${vmid} to PBS?`, async () => {
      try {
        const res = await ApiClient.post(`/nodes/${node}/vms/${vmid}/backup`, {
          storage: 'pbs',
          mode: 'snapshot',
          compress: 'zstd',
        });

        if (res.status === 'ok') {
          showToast(t('backup_started'), 'success');
        } else {
          showToast(res.message, 'error');
          document.getElementById('pbsWarning').style.display = 'flex';
        }
        loadBackupHistory(parseInt(vmid, 10));
      } catch (e) {
        showToast(`${t('backup_failed')}: ${e.message}`, 'error');
      }
    });
  });
});

