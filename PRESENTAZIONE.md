# INFORMIX Spa — Materiali di Presentazione

## Parte 1: Presentazione Prodotto

### Slide 1 — Copertina
- **INFORMIX Proxmox Portal**
- Portale di gestione infrastrutture virtualizzate
- Project Work SYAM A1 — INFORMIX Spa

### Slide 2 — Il Problema
- I tecnici L1 necessitano di uno strumento semplificato
- L'interfaccia nativa Proxmox è complessa per operazioni quotidiane
- Necessità di centralizzare stato, backup e controllo VM

### Slide 3 — La Soluzione
- Portale web leggero, Dockerizzato, cloud-ready
- Dashboard intuitiva con metriche in tempo reale
- Power management con un click
- Integrazione backup PBS con resilienza

### Slide 4 — Demo Live
- Login → Dashboard → VM Management → Monitoring → Backup → Migration

### Slide 5 — Architettura
- Diagramma: Frontend (Nginx) → Backend (FastAPI) → DB (PostgreSQL/RDS)
- Proxmox VE ← API Token
- AWS Secrets Manager per credenziali

### Slide 6 — Sicurezza
- Zero hardcoded secrets (AWS Secrets Manager)
- API Token authentication (no root password)
- JWT con bcrypt hashing
- Audit logging completo

---

## Parte 2: Relazione Tecnica

### Scelte Tecnologiche Motivate

1. **FastAPI** — Framework async Python con documentazione OpenAPI automatica, ideale per REST API performanti
2. **Vanilla JavaScript** — Nessun build step necessario, deploy immediato via Nginx, riduce la complessità
3. **Chart.js** — Libreria leggera per grafici real-time, nessuna dipendenza server-side
4. **Docker multi-stage build** — Immagini ottimizzate, user non-root per sicurezza
5. **Demo Mode** — Flag per testing completo senza infrastruttura Proxmox reale

### Flusso di Sicurezza

```
App Start → AWS Secrets Manager → Credenziali in memoria
         → Database Connection (RDS)
         → Proxmox API Token Connection
         → Ready to serve
```

### API Proxmox Utilizzate

| Endpoint Proxmox | Uso nel Portale |
|:---|:---|
| `GET /api2/json/nodes` | Dashboard nodi |
| `GET /api2/json/nodes/{node}/qemu` | Lista VM |
| `GET /api2/json/nodes/{node}/lxc` | Lista Container |
| `POST .../status/start\|stop\|shutdown\|reboot` | Power management |
| `GET .../rrddata` | Grafici monitoring |
| `GET/POST .../snapshot` | Gestione snapshot |
| `POST .../vzdump` | Backup verso PBS |
| `GET /api2/json/cluster/resources` | Cluster map |
| `POST .../migrate` | Live migration |

### Normalizzazione Dati

- **CPU**: Proxmox restituisce decimale (0.5 = 50%), il backend converte in percentuale
- **Memoria**: Mantenuta in bytes, formattata dal frontend (GB, TB)
- **Uptime**: Secondi → formato human-readable (Xd Xh)

### Gestione Errori e Resilienza

- PBS irraggiungibile → Warning banner, NO crash
- Token JWT scaduto → Redirect automatico a login
- Proxmox disconnesso → Messaggio di errore, app funzionante
- DB connection pool con `pool_pre_ping` per reconnect automatico su RDS

---

## Sessione Live — Scaletta

1. **[2 min]** Avvio stack con `docker-compose up -d`
2. **[1 min]** Login e tour dashboard
3. **[2 min]** Navigazione VM inventory, filtri, ricerca
4. **[2 min]** Operazioni VM: start, shutdown, reboot
5. **[2 min]** Monitoring: selezione target, grafici real-time
6. **[2 min]** Snapshot: creazione e visualizzazione
7. **[2 min]** Backup PBS: avvio e gestione errore resilienza
8. **[2 min]** Cluster: tree view e live migration
9. **[1 min]** Cambio lingua IT/EN
10. **[1 min]** API Docs (Swagger UI)
11. **[2 min]** Q&A

**Durata totale stimata: ~20 minuti**
