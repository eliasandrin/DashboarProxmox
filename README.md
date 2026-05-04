# INFORMIX Spa — Proxmox VE Management Portal

> Portale web leggero per tecnici MSP di primo livello, finalizzato al controllo centralizzato delle infrastrutture di virtualizzazione Proxmox VE.

![INFORMIX Portal](frontend/public/assets/logo.png)

---

## 🏗️ Architettura

```
┌─────────────┐    ┌──────────────┐    ┌──────────────────────────┐
│   Frontend   │───▶│   Backend    │───▶│  PostgreSQL / AWS RDS    │
│  (Nginx:80)  │    │ (FastAPI:8000)│   │  (local demo or cloud)   │
└─────────────┘    └──────┬───────┘    └──────────────────────────┘
           │
         ┌──────┴───────┐
         │  Proxmox VE  │
         │  (API:8006)  │
         └──────────────┘
```

| Layer | Tecnologia | Motivazione |
|:---|:---|:---|
| Backend | Python 3.12 + FastAPI | Async, veloce, libreria `proxmoxer` nativa |
| Frontend | HTML5 + CSS3 + Vanilla JS | Leggero, zero build step, Chart.js per grafici |
| Database | PostgreSQL 16 / AWS RDS | Persistenza esterna, compatibile cloud |
| Auth | JWT + bcrypt | Sessioni stateless, password hashate |
### Dominio unico ovunque senza servizi esterni

Questa e la soluzione giusta se vuoi usare sempre `informixspa.it` dentro le reti che controlli, senza Cloudflare, Route53 o altri servizi terzi.

L'idea è questa:
1. Il PC che ospita Docker riceve sempre lo stesso IP tramite prenotazione DHCP sul router.
2. Il DNS locale del progetto risolve `informixspa.it` verso quell'IP.
3. Il router distribuisce quel DNS ai client tramite DHCP.

Per configurarla:
1. Prenota nel router un IP fisso per il PC che ospita Docker.
2. Imposta `LAN_DNS_IP` nel file `.env` con quello stesso IP.
3. Avvia il DNS locale incluso nel progetto.

```bash
docker compose -f docker-compose.yml -f docker-compose.lan-dns.yml up -d --build
```

4. Configura il router perché i client ricevano come DNS il server locale/CoreDNS, oppure usa il DNS del router se supporta record locali personalizzati.

Con questa configurazione tutti i dispositivi della stessa rete risolvono automaticamente:

```text
informixspa.it -> LAN_DNS_IP
```

Nota importante: senza un servizio esterno o una VPN, lo stesso dominio non può essere raggiungibile automaticamente da reti completamente diverse che non controlli. In quel caso devi replicare la stessa configurazione DNS in ogni rete o usare una VPN.

| Proxmox | `proxmoxer` + API Tokens | Sicuro, no password root |
| Security | AWS Secrets Manager | Zero hardcoded secrets |
| Registry | AWS ECR | Immagini Docker private e versionate |

---

## 🚀 Quick Start

### Prerequisiti
- Docker 24+ e Docker Compose v2
- (Opzionale) AWS CLI configurato per Secrets Manager

### Avvio in modalità Demo locale

```bash
# 1. Clona il repository
git clone https://github.com/informix-spa/proxmox-portal.git
cd proxmox-portal

# 2. Copia il file di configurazione
cp .env.example .env

# 3. Avvia lo stack
docker-compose up -d --build

# Registrazione iniziale: http://localhost
# Login successivo: http://localhost/login.html
# API Docs: http://localhost:8000/docs
```

### Persistenza account e dati DB

Il database locale usa un volume Docker esterno chiamato `informix-postgres-data`, quindi i dati restano dopo `stop/start` o `restart` dei container.

```bash
# crea il volume una sola volta (se non esiste)
docker volume create informix-postgres-data

# avvio stack
docker compose up -d --build
```

Nota: evitare comandi distruttivi sul volume (`docker volume rm informix-postgres-data` o `docker volume prune`) se vuoi mantenere gli account.

---

## 🔒 Sicurezza e Proxmox API

In produzione, è fondamentale **non utilizzare l'utente root** di Proxmox. Si raccomanda la creazione di un utente API dedicato con privilegi minimi.

### Creazione API Token Proxmox

Eseguire i seguenti comandi sulla shell di Proxmox (o via SSH) per configurare l'accesso:

```bash
# 1. Crea un nuovo ruolo con permessi limitati
pveum role add PortalAdmin --privs "VM.Audit VM.Config.Memory VM.Config.Network VM.Config.HWType VM.Console VM.Monitor VM.PowerMgmt VM.Migrate Datastore.Audit Node.Audit"

# 2. Crea l'utente locale (PVE)
pveum user add apiuser@pve --comment "User per Dashboard Proxmox"

# 3. Crea il Token API per l'utente (segnare il valore restituito!)
pveum user token add apiuser@pve portal-token --privsep 0

# 4. Assegna il ruolo all'utente sul percorso radice
pveum acl modify / --user apiuser@pve --role PortalAdmin
```

Una volta ottenuto il token, configuralo nel file `.env`:
`PROXMOX_USER=apiuser@pve!portal-token`
`PROXMOX_TOKEN_VALUE=il-tuo-token-uuid`

---

### Dominio locale personalizzato per una sola LAN

Se vuoi restare solo in rete locale, puoi avviare il DNS locale incluso nel progetto (CoreDNS):

```bash
docker compose -f docker-compose.yml -f docker-compose.lan-dns.yml up -d --build
```

Poi imposta nel router la prenotazione DHCP per il PC che ospita Docker e fai distribuire ai client il DNS locale oppure il DNS del router con record personalizzato.
Se stai usando la configurazione di esempio, imposta `LAN_DNS_IP=10.1.11.57` nel file `.env` oppure nel tuo override locale.

Con questa configurazione, tutti i dispositivi della stessa rete risolvono automaticamente:

```text
informixspa.it -> LAN_DNS_IP
```

Se il tuo PC riceve un IP diverso via DHCP, aggiorna `LAN_DNS_IP` o la prenotazione DHCP prima di avviare lo stack.
---

### AWS Secrets Manager
Creare un secret con nome `informix/portal/config` contenente:
  "db_password": "YourSecurePassword",
  "proxmox_user": "apiuser@pve!portal-token",
  "proxmox_token_value": "your-api-token-uuid",
  "jwt_secret_key": "your-jwt-secret-256bit"
}
```

### AWS RDS
```bash
aws rds create-db-instance \
  --db-instance-identifier informix-portal-db \
  --engine postgres \
  --engine-version 16.4 \
  --db-instance-class db.t3.micro \
  --master-username informix_admin \
  --master-user-password YourSecurePassword \
  --allocated-storage 20
```

### AWS ECR — Deploy
```bash
# Login ECR
aws ecr get-login-password --region eu-south-1 | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.eu-south-1.amazonaws.com

# Build & Push
docker build -t informix-backend ./backend
docker tag informix-backend:latest $AWS_ACCOUNT_ID.dkr.ecr.eu-south-1.amazonaws.com/informix-backend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.eu-south-1.amazonaws.com/informix-backend:latest

# Produzione
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Modalità di esecuzione
- `docker compose up -d --build` avvia lo stack locale di demo con database containerizzato.
- `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d` avvia lo stack cloud-ready con immagini ECR, AWS Secrets Manager e database esterno.

---

## 📋 Funzionalità

### Livello 1 — Core ✅
- ✅ **Dashboard di Stato** — CPU, RAM, Storage per nodo con progress bars animate
- ✅ **Power Management** — Start, Stop, Shutdown, Reboot con conferma modale
- ✅ **Resource Monitoring** — Grafici Chart.js in tempo reale (30 min)
- ✅ **Snapshot & Backup** — Creazione snapshot, backup PBS con resilienza
- ✅ **Cloud Integration** — AWS RDS, Secrets Manager, ECR

### Livello 2 — Bonus (Lode) ✅
- ✅ **Cluster Awareness** — Mappa VM su più nodi fisici
- ✅ **Live Migration** — Spostamento VM tra nodi via interfaccia

### Sicurezza
- 🔒 API Token authentication (no root password)
- 🔒 AWS Secrets Manager (zero hardcoded secrets)
- 🔒 Resilienza PBS (no crash su irraggiungibilità)
- 🔒 Audit logging di tutte le operazioni
- 🔒 Security headers Nginx

---

## 📁 Struttura Progetto

```
informix-proxmox-portal/
├── docker-compose.yml          # Stack locale/demo
├── docker-compose.prod.yml     # Override cloud-ready (ECR/RDS)
├── .env.example                # Template configurazione
├── README.md
├── TEST_PLAN.md
├── PRESENTAZIONE.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # FastAPI entry point
│       ├── config.py           # Pydantic settings
│       ├── database.py         # SQLAlchemy async
│       ├── models.py           # User, AuditLog
│       ├── schemas.py          # Pydantic schemas
│       ├── auth.py             # JWT + bcrypt
│       ├── secrets_manager.py  # AWS Secrets Manager
│       ├── proxmox_client.py   # Proxmox wrapper + demo data
│       └── routers/
│           ├── auth_router.py
│           ├── nodes_router.py
│           ├── vms_router.py
│           ├── monitoring_router.py
│           ├── backup_router.py
│           └── cluster_router.py
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── public/
        ├── index.html          # Registration page
        ├── login.html          # Login page
        ├── dashboard.html      # Main dashboard
        ├── css/style.css       # Design system
        ├── js/                 # Moduli JS
        └── assets/logo.png
```

---

## 🛠️ Scelte Tecniche

1. **FastAPI** scelto per le performance async e la documentazione automatica OpenAPI
2. **Vanilla JS** anziché React/Vue per semplicità di deploy (nessun build step)
3. **Dark Mode** come tema predefinito — standard per ambienti NOC/data center
4. **Demo Mode** con flag `DEMO_MODE=true` per testing senza Proxmox reale
5. **Registrazione iniziale** — il primo account viene creato dal portale e salvato nel DB
6. **Resilienza PBS** — il backup non crasha l'app se PBS è irraggiungibile
7. **Audit Log** — tutte le operazioni VM vengono tracciate con user e timestamp

---

## 📄 Licenza

Progetto realizzato per INFORMIX Spa — Project Work SYAM A1.
