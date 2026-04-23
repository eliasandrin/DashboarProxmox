import { useEffect, useState } from 'react'
import api from '../api/client'

const REFRESH_INTERVAL_MS = 5000

const STATUS_COLORS = {
  running: { bg: '#14532d', text: '#86efac' },
  stopped: { bg: '#1e293b', text: '#94a3b8' },
  paused:  { bg: '#451a03', text: '#fcd34d' },
  unknown: { bg: '#1e293b', text: '#64748b' },
}

function PowerButton({ label, color, onClick, disabled }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        padding: '4px 10px', borderRadius: 6, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: color, color: '#fff', fontSize: 11, fontWeight: 500, opacity: disabled ? 0.4 : 1
      }}
    >{label}</button>
  )
}

export default function Inventory() {
  const [vms, setVms] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [message, setMessage] = useState(null)

  const fetchVms = async () => {
    try {
      const res = await api.get('/vms/')
      setVms(res.data)
    } catch (e) {
      setMessage({ type: 'error', text: 'Errore nel caricamento VM' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVms()
    const interval = setInterval(fetchVms, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const doAction = async (vm, action) => {
    const key = `${vm.node}-${vm.vmid}-${action}`
    setActionLoading(key)
    try {
      await api.post(`/vms/${vm.node}/${vm.type}/${vm.vmid}/${action}`)
      setMessage({ type: 'success', text: `${action} inviato a ${vm.name}` })
      setTimeout(fetchVms, 2000)
    } catch (e) {
      const detail = e.response?.data?.detail
      const msg = typeof detail === 'object' ? detail.message || detail.detail : detail
      setMessage({ type: 'error', text: msg || `Errore durante ${action}` })
    } finally {
      setActionLoading(null)
      setTimeout(() => setMessage(null), 4000)
    }
  }

  const filtered = vms.filter(v =>
    v.name?.toLowerCase().includes(filter.toLowerCase()) ||
    String(v.vmid).includes(filter) ||
    v.node?.toLowerCase().includes(filter.toLowerCase())
  )

  if (loading) return <div style={{ color: '#94a3b8', padding: 32 }}>Caricamento VM...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 600, margin: 0 }}>
          Inventario VM/CT ({vms.length})
        </h2>
        <input
          placeholder="Cerca per nome, ID, nodo..."
          value={filter} onChange={e => setFilter(e.target.value)}
          style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
            padding: '8px 12px', color: '#f1f5f9', fontSize: 13, width: 260
          }}
        />
      </div>

      <div style={{ color: '#64748b', fontSize: 12, marginTop: -10, marginBottom: 14 }}>
        Aggiornamento automatico ogni 5 secondi
      </div>

      {message && (
        <div style={{
          background: message.type === 'success' ? '#14532d' : '#450a0a',
          border: `1px solid ${message.type === 'success' ? '#166534' : '#7f1d1d'}`,
          borderRadius: 8, padding: '10px 16px', marginBottom: 16,
          color: message.type === 'success' ? '#86efac' : '#fca5a5', fontSize: 13
        }}>{message.text}</div>
      )}

      <div style={{ background: '#1e293b', borderRadius: 12, overflow: 'hidden', border: '1px solid #334155' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#0f172a' }}>
              {['ID', 'Nome', 'Tipo', 'Nodo', 'Status', 'CPU', 'RAM', 'Azioni'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontSize: 12, fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(vm => {
              const sc = STATUS_COLORS[vm.status] || STATUS_COLORS.unknown
              const isRunning = vm.status === 'running'
              const isStopped = vm.status === 'stopped'
              const actionKey = `${vm.node}-${vm.vmid}`
              const busy = actionLoading?.startsWith(actionKey)

              return (
                <tr key={`${vm.node}-${vm.vmid}`} style={{ borderTop: '1px solid #1e293b' }}>
                  <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 13 }}>{vm.vmid}</td>
                  <td style={{ padding: '12px 16px', color: '#f1f5f9', fontSize: 13, fontWeight: 500 }}>{vm.name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11, padding: '2px 7px', borderRadius: 4, fontWeight: 500,
                      background: vm.type === 'qemu' ? '#1e3a5f' : '#1a3a2e',
                      color: vm.type === 'qemu' ? '#93c5fd' : '#6ee7b7'
                    }}>{vm.type === 'qemu' ? 'VM' : 'LXC'}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>{vm.node}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 20,
                      background: sc.bg, color: sc.text, fontWeight: 500
                    }}>{vm.status}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>{vm.cpu}%</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>
                    {vm.mem_used_mb} / {vm.mem_total_mb} MB
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <PowerButton label="Start"    color="#16a34a" disabled={busy || isRunning}  onClick={() => doAction(vm, 'start')} />
                      <PowerButton label="Stop"     color="#dc2626" disabled={busy || isStopped}  onClick={() => doAction(vm, 'stop')} />
                      <PowerButton label="Shutdown" color="#d97706" disabled={busy || isStopped}  onClick={() => doAction(vm, 'shutdown')} />
                      <PowerButton label="Reboot"   color="#7c3aed" disabled={busy || isStopped}  onClick={() => doAction(vm, 'reboot')} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ color: '#64748b', textAlign: 'center', padding: 48 }}>Nessuna VM trovata</div>
        )}
      </div>
    </div>
  )
}
