# INFORMIX Proxmox Portal

Portale web per il monitoraggio e la gestione operativa di ambienti Proxmox VE. Pensato per tecnici MSP di primo livello con interfaccia leggera e focus su rapidita di utilizzo.

![INFORMIX Portal](frontend/public/assets/logo.png)

## Architettura

```
┌─────────────┐    ┌───────────────┐    ┌──────────────────────────┐
│  Frontend   │───▶│   Backend     │───▶│  PostgreSQL / AWS RDS     │
│  (Nginx:80) │    │ (FastAPI:8000)│   │  (local demo o cloud)     │
└─────────────┘    └──────┬────────┘    └──────────────────────────┘
           │
         ┌──────┴───────┐
         │  Proxmox VE  │
         │  (API:8006)  │
         └──────────────┘
```

## Funzionalita principali

- Dashboard stato nodi (CPU, RAM, storage)
- Power management VM (start, stop, reboot, shutdown)
- Monitoring con grafici RRD
- Snapshot e backup
- Integrazione cloud: AWS RDS, AWS Secrets Manager, AWS ECR

## Requisiti

- Docker 24+ e Docker Compose v2
- (Opzionale) AWS CLI se vuoi pushare immagini su ECR

## Quick start (demo locale)

1. Copia la configurazione di esempio:

```bash
cp .env.example .env
```

2. Imposta questi valori in `.env`:

- `DEMO_MODE=true`
- `USE_AWS_SECRETS=false`

3. Avvia lo stack:

```bash
docker compose up -d --build
```

4. Apri il portale:

- UI: http://localhost
- API Docs: http://localhost:8000/docs

## Demo checklist

- `.env` impostato con `DEMO_MODE=true` e `USE_AWS_SECRETS=false`
- Stack avviato con `docker compose up -d --build`
- Health check OK: http://localhost:8000/api/health
- UI raggiungibile: http://localhost
- Pagina login e dashboard caricabili senza errori

## Presentazione su AWS (deploy prod-like)

Per un deploy completo con ECR, RDS e Secrets Manager, segui la guida dedicata:

- [AWS_PHASE_3_GUIDE.md](AWS_PHASE_3_GUIDE.md)

Note importanti per AWS:

- `USE_AWS_SECRETS=true` solo in ambiente AWS con ruolo IAM.
- Le immagini ECR devono esistere in `eu-west-1`:
  - `syam-gamma-projectwork-backend`
  - `syam-gamma-projectwork-frontend`
- Il DB RDS consigliato e `syam-gamma-projectwork-db`.

## Configurazione (.env)

Variabili principali:

- `DEMO_MODE`: `true` per demo senza Proxmox reale.
- `USE_AWS_SECRETS`: `true` per leggere i secrets da AWS (solo in cloud).
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`: usati in locale.
- `PROXMOX_HOST`, `PROXMOX_USER`, `PROXMOX_TOKEN_VALUE`: Proxmox API.

In locale, se `USE_AWS_SECRETS=true` il container deve avere credenziali AWS valide, altrimenti ricade su `.env`.

## Proxmox API (token consigliato)

Eseguire sul nodo Proxmox:

```bash
pveum role add PortalAdmin --privs "VM.Audit VM.Config.Memory VM.Config.Network VM.Config.HWType VM.Console VM.Monitor VM.PowerMgmt VM.Migrate Datastore.Audit Node.Audit"
pveum user add apiuser@pve --comment "User per Proxmox Portal"
pveum user token add apiuser@pve portal-token --privsep 0
pveum acl modify / --user apiuser@pve --role PortalAdmin
```

Imposta in `.env`:

- `PROXMOX_USER=apiuser@pve!portal-token`
- `PROXMOX_TOKEN_VALUE=<token>`

## Dominio locale (opzionale)

Se vuoi un dominio locale nella LAN, usa il DNS locale con CoreDNS:

```bash
docker compose -f docker-compose.yml -f docker-compose.lan-dns.yml up -d --build
```

Imposta `LAN_DNS_IP` in `.env` con l'IP del PC che ospita Docker.

## Guida all'uso (passo-passo)

### 1) Accesso iniziale

1. Apri il portale: http://localhost
2. Se e il primo avvio, usa la pagina di registrazione per creare il primo account.
3. Vai alla pagina di login ed effettua l'accesso.

Nota: non esiste un account admin preimpostato. Il primo utente registrato diventa admin.

Suggerimento: se sei in modalita demo, la UI mostra dati di esempio ma tutte le funzioni restano navigabili.

### 2) Dashboard

La dashboard mostra lo stato generale dei nodi:

- CPU, RAM e storage per nodo
- indicatori di carico
- accesso rapido alle sezioni principali

Verifica che i riquadri siano popolati e che i valori si aggiornino.

### 3) Inventario VM

Apri la sezione Inventario per vedere la lista VM:

- nome VM e nodo di appartenenza
- stato (running, stopped)
- azioni rapide

Seleziona una VM per aprire i dettagli.

### 4) Power Management

Dalla lista VM puoi:

- avviare (Start)
- spegnere (Shutdown)
- forzare stop (Stop)
- riavviare (Reboot)

Le azioni richiedono conferma. Usa questa sezione per simulare i flussi operativi durante la demo.

### 5) Monitoring

Apri la sezione Monitoring per i grafici RRD:

- seleziona VM o nodo
- scegli il timeframe
- verifica i grafici di CPU, RAM e I/O

### 6) Snapshot e Backup

Nella sezione Backup puoi:

- creare snapshot
- avviare un backup
- verificare lo storico

In demo mode, le operazioni sono simulate; in produzione richiedono un Proxmox raggiungibile.

### 7) Metriche cluster

La sezione Metriche aggrega lo stato dei nodi e delle VM per una vista complessiva del cluster.

### 8) Logout e sessioni

Usa il logout quando hai finito per chiudere la sessione.

---

## Troubleshooting rapido

- Se vedi errori di connessione Proxmox, controlla `PROXMOX_HOST` e token.
- Se la UI e vuota, verifica `DEMO_MODE=true` per la demo.
- Se l'API non risponde, controlla i container con `docker compose ps`.

## Struttura progetto

```
DashboardProxmox/
├── docker-compose.yml
├── docker-compose.prod.yml
├── docker-compose.lan-dns.yml
├── .env.example
├── README.md
├── TEST_PLAN.md
├── PRESENTAZIONE.md
├── AWS_PHASE_3_GUIDE.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── models.py
│       ├── schemas.py
│       ├── auth.py
│       ├── secrets_manager.py
│       ├── proxmox_client.py
│       └── routers/
│           ├── auth_router.py
│           ├── backup_router.py
│           ├── cluster_router.py
│           ├── monitoring_router.py
│           ├── nodes_router.py
│           └── vms_router.py
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── public/
        ├── index.html
        ├── login.html
        ├── dashboard.html
        ├── css/
        ├── js/
        └── assets/
```

## Licenza

Progetto realizzato per INFORMIX Spa - Project Work SYAM A1.
