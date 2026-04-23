import { useEffect, useState } from 'react'
import api from '../api/client'

const REFRESH_INTERVAL_MS = 5000

function StatBar({ value, max = 100, color = '#3b82f6' }) {
  const pct = Math.min((value / max) * 100, 100)
  const bg = pct > 85 ? '#ef4444' : pct > 60 ? '#f59e0b' : color
  return (
    <div style={{ background: '#0f172a', borderRadius: 4, height: 6, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: bg, borderRadius: 4, transition: 'width .4s' }} />
    </div>
  )
}

function NodeCard({ node }) {
  return (
    <div style={{
      background: '#1e293b', borderRadius: 12, padding: 20,
      border: `1px solid ${node.status === 'online' ? '#1d4ed8' : '#7f1d1d'}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 15 }}>{node.node}</span>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500,
          background: node.status === 'online' ? '#14532d' : '#450a0a',
          color: node.status === 'online' ? '#86efac' : '#fca5a5'
        }}>{node.status}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>CPU</div>
          <div style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 600 }}>{node.cpu}%</div>
          <StatBar value={node.cpu} />
        </div>
        <div>
          <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>RAM</div>
          <div style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 600 }}>{node.mem_percent}%</div>
          <StatBar value={node.mem_percent} color="#8b5cf6" />
          <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
            {node.mem_used_gb} / {node.mem_total_gb} GB
          </div>
        </div>
        <div>
          <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>Disco</div>
          <div style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 600 }}>
            {node.disk_total_gb > 0 ? Math.round(node.disk_used_gb / node.disk_total_gb * 100) : 0}%
          </div>
          <StatBar value={node.disk_used_gb} max={node.disk_total_gb} color="#10b981" />
          <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>
            {node.disk_used_gb} / {node.disk_total_gb} GB
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchNodes = async () => {
    try {
      const res = await api.get('/nodes/')
      setNodes(res.data)
      setError('')
    } catch (e) {
      setError(e.response?.data?.detail?.detail || 'Errore nel caricamento dei nodi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNodes()
    const interval = setInterval(fetchNodes, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div style={{ color: '#94a3b8', padding: 32 }}>Caricamento nodi...</div>

  return (
    <div>
      <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Dashboard cluster</h2>
      <div style={{ color: '#64748b', fontSize: 12, marginTop: -12, marginBottom: 16 }}>
        Aggiornamento automatico ogni 5 secondi
      </div>

      {error && (
        <div style={{
          background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 8,
          padding: '12px 16px', color: '#fca5a5', fontSize: 13, marginBottom: 20
        }}>
          Attenzione: {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {nodes.map(n => <NodeCard key={n.node} node={n} />)}
      </div>

      {nodes.length === 0 && !error && (
        <div style={{ color: '#64748b', textAlign: 'center', padding: 48 }}>Nessun nodo trovato</div>
      )}
    </div>
  )
}
