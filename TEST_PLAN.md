# INFORMIX Portal — Test Plan

## Ambiente di Test
- **URL Frontend:** `http://localhost`
- **URL Login:** `http://localhost/login.html`
- **URL API:** `http://localhost:8000`
- **API Docs:** `http://localhost:8000/docs`
- **Demo Mode:** Attivo (dati simulati)
- **Proxmox User (Production):** `apiuser@pve!portal-token`

---

## 1. Health Check

```bash
curl -s http://localhost:8000/api/health | python -m json.tool
```
**Expected:** `{"status": "healthy", "demo_mode": true, ...}`

---

## 2. Autenticazione

### Registrazione iniziale
Aprire `http://localhost/` e creare il primo account.
**Expected:** redirect a `http://localhost/login.html` con messaggio di registrazione completata.

### Login (successo)
```bash
curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin2024!"}' | python -m json.tool
```
**Expected:** JWT token + user object, solo se l'account è stato creato in precedenza.

### Login (fallimento)
```bash
curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "wrong"}'
```
**Expected:** `401 Unauthorized`

### Profilo utente
```bash
TOKEN="<jwt_token_here>"
curl -s http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

---

## 3. Nodi

### Lista nodi
```bash
curl -s http://localhost:8000/api/nodes \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```
**Expected:** 3 nodi (pve-node01, pve-node02, pve-node03)

### Dettaglio nodo
```bash
curl -s http://localhost:8000/api/nodes/pve-node01 \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```
**Expected:** CPU%, RAM, Storage, Uptime

---

## 4. VM/CT Inventory

### Lista tutte le VM
```bash
curl -s http://localhost:8000/api/vms/all \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```
**Expected:** 16 VM/CT con vmid, name, status, type, node

### VM per nodo
```bash
curl -s http://localhost:8000/api/nodes/pve-node01/vms \
  -H "Authorization: Bearer $TOKEN"

curl -s http://localhost:8000/api/nodes/pve-node01/containers \
  -H "Authorization: Bearer $TOKEN"
```

---

## 5. Power Management

### Start VM
```bash
curl -s -X POST http://localhost:8000/api/nodes/pve-node01/vms/103/status/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{}'
```
**Expected:** `{"vmid": 103, "action": "start", "status": "ok", ...}`

### Shutdown VM
```bash
curl -s -X POST http://localhost:8000/api/nodes/pve-node01/vms/100/status/shutdown \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{}'
```

### Reboot VM
```bash
curl -s -X POST http://localhost:8000/api/nodes/pve-node02/vms/110/status/reboot \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{}'
```

---

## 6. Monitoring

### RRD data nodo (ultimi 30 min)
```bash
curl -s "http://localhost:8000/api/nodes/pve-node01/rrddata?timeframe=hour" \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```
**Expected:** 30 data points con cpu, mem, netin, netout, diskread, diskwrite

### RRD data VM
```bash
curl -s "http://localhost:8000/api/nodes/pve-node01/vms/100/rrddata?timeframe=hour" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 7. Snapshot & Backup

### Lista snapshot
```bash
curl -s "http://localhost:8000/api/nodes/pve-node01/vms/100/snapshots?vm_type=qemu" \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** Snapshot list per VM 100

### Crea snapshot
```bash
curl -s -X POST "http://localhost:8000/api/nodes/pve-node01/vms/100/snapshots?vm_type=qemu" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-snap", "description": "Test snapshot", "include_ram": false}'
```

### Avvia backup PBS
```bash
curl -s -X POST http://localhost:8000/api/nodes/pve-node01/vms/100/backup \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"storage": "pbs", "mode": "snapshot", "compress": "zstd"}'
```
**Expected:** `status: ok` oppure `status: error` con warning PBS (resilienza)

### Lista backup
```bash
curl -s "http://localhost:8000/api/storage/pbs/content?vmid=100" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 8. Cluster & Migration (Bonus)

### Risorse cluster
```bash
curl -s http://localhost:8000/api/cluster/resources \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```
**Expected:** Nodi + VM + Storage mappati

### Live migration
```bash
curl -s -X POST http://localhost:8000/api/cluster/migrate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vmid": 100, "source_node": "pve-node01", "target_node": "pve-node02", "online": true}'
```
**Expected:** VM 100 migrata a pve-node02

---

## 9. Test di Resilienza

### PBS irraggiungibile
In demo mode, il 20% delle richieste di backup simula PBS irraggiungibile.
Ripetere la chiamata backup più volte per verificare che:
- L'app **non crasha**
- Viene restituito un messaggio di warning
- Il frontend mostra il banner di avviso

### Token scaduto
```bash
curl -s http://localhost:8000/api/nodes \
  -H "Authorization: Bearer invalid-token"
```
**Expected:** `401 Unauthorized`

---

## 10. Test Frontend (Browser)

| Test | Azione | Risultato Atteso |
|:---|:---|:---|
| Registrazione | Inserire dati validi e conferma password | Redirect a login |
| Login | Inserire credenziali registrate | Redirect a dashboard |
| Login fallito | Password sbagliata | Errore visualizzato |
| Dashboard | Navigare | 3 node cards con metriche |
| VM Inventory | Click su sezione | Tabella 16 VM/CT |
| Filtro | Click "Running" | Solo VM running |
| Ricerca | Digitare "web" | Solo web-server-prod |
| Power action | Click ▶ su VM stopped | Modal conferma → start |
| Monitoring | Selezionare nodo | 4 grafici Chart.js |
| Snapshot | Selezionare VM → Create | Snapshot aggiunto |
| Backup PBS | Click "Start Backup" | Success o PBS warning |
| Cluster | Navigare | Tree view del cluster |
| Migration | Selezionare VM e target | Migrazione completata |
| Logout | Click ⏻ | Redirect a login |
| i18n | Click IT | Interfaccia in italiano |
| Responsive | Resize mobile | Layout adattato |

## 11. Note di coerenza con la traccia
- Il database è configurato come entità esterna nella modalità cloud-ready (`docker-compose.prod.yml`) e come servizio locale solo nella modalità demo.
- I segreti sensibili vengono caricati da AWS Secrets Manager quando `USE_AWS_SECRETS=true`.
- Le immagini sono pensate per essere pubblicate su AWS ECR nella pipeline di deploy.
