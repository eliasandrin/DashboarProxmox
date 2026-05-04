# GUIDA COMPLETA — PWMO INFORMIX

Questa guida passo-passo ti porta dalla preparazione locale fino alla consegna finale.

## FASE 1 — Preparazione (fai questo oggi)

Step 1.1 — Verifica che Docker funzioni
- Apri Docker Desktop. In basso a sinistra deve esserci la scritta "Engine running" con un pallino verde. Se non è verde, aspetta che si avvii.

Step 1.2 — Estrai il progetto
- Prendi il file `informix-proxmox-portal.zip` ed estrailo sul Desktop. Avrai una cartella chiamata `informix-proxmox-portal`.

Step 1.3 — Apri in VS Code
- Apri VS Code → File → Open Folder → seleziona `informix-proxmox-portal` → clicca Seleziona cartella.

Step 1.4 — Apri il terminale
- In VS Code vai su Terminal → New Terminal. Si apre in basso.

Step 1.5 — Crea il volume database
- Nel terminale scrivi esattamente questo e premi Invio:
  ```bash
  docker volume create informix-postgres-data
  ```
- Deve rispondere con `informix-postgres-data`. Se lo vedi, è fatto.

Step 1.6 — Crea il file .env
- Nel terminale scrivi:
  - Windows:
    ```powershell
    copy .env.example .env
    ```
  - Mac/Linux:
    ```bash
    cp .env.example .env
    ```

Step 1.7 — Avvia in modalità demo
- Nel terminale scrivi:
  ```bash
  docker compose up --build
  ```
- Aspetta finché non vedi nel terminale:
  `informix-backend  | 🚀 INFORMIX Portal is ready!`
- Poi apri `http://localhost` nel browser. Registra il tuo primo account e fai login. Vedrai la dashboard con dati simulati.

✅ Fase 1 completata — l'app gira in locale con dati finti.

## FASE 2 — Collegare Proxmox reale

Step 2.1 — Crea il token su Proxmox
- Apri il browser e vai su `https://IP-DEL-TUO-PROXMOX:8006`.
- Fai login come `root`. Poi: Datacenter → Permissions → API Tokens → Add
- Compila:
  - User: `root@pam`
  - Token ID: `portal-token`
  - Privilege Separation: togli la spunta
- Clicca Add. Copia subito il valore del token (lo vedrai solo una volta).

Step 2.2 — Modifica il file .env
- In VS Code apri `.env` e modifica:
  - `DEMO_MODE=false`
  - `PROXMOX_HOST=IP_DEL_TUO_PROXMOX` (es. `192.168.1.100`)
  - `PROXMOX_USER=root@pam!portal-token`
  - `PROXMOX_TOKEN_VALUE=incolla-qui-il-token-copiato`
- Salva con Ctrl+S.

Step 2.3 — Riavvia l'app
- Nel terminale ferma tutto con `Ctrl+C`, poi riscrivi:
  ```bash
  docker compose up --build
  ```
- Apri `http://localhost` — adesso vedrai le tue VM reali.

✅ Fase 2 completata — l'app parla con il tuo Proxmox reale.

## FASE 3 — Configurare AWS (parte obbligatoria per il voto)

> Nota: serve un account AWS.

Step 3.1 — Crea i repository su AWS ECR
- Nel terminale esegui (region = `eu-south-1`):
  ```bash
  aws ecr create-repository --repository-name informix-backend --region eu-south-1
  aws ecr create-repository --repository-name informix-frontend --region eu-south-1
  ```
- Copia i `repositoryUri` restituiti.

Step 3.2 — Fai il push delle immagini su ECR
- Autenticati su ECR (sostituisci `123456789012` con il tuo AWS Account ID):
  ```bash
  aws ecr get-login-password --region eu-south-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.eu-south-1.amazonaws.com
  ```
- Build e push backend:
  ```bash
  docker build -t informix-backend ./backend
  docker tag informix-backend:latest 123456789012.dkr.ecr.eu-south-1.amazonaws.com/informix-backend:latest
  docker push 123456789012.dkr.ecr.eu-south-1.amazonaws.com/informix-backend:latest
  ```
- Build e push frontend:
  ```bash
  docker build -t informix-frontend ./frontend
  docker tag informix-frontend:latest 123456789012.dkr.ecr.eu-south-1.amazonaws.com/informix-frontend:latest
  docker push 123456789012.dkr.ecr.eu-south-1.amazonaws.com/informix-frontend:latest
  ```

Step 3.3 — Crea il database su AWS RDS
- Console AWS → RDS → Create database
  - Engine: PostgreSQL (versione 16)
  - Template: Free tier
  - DB instance identifier: `informix-portal`
  - Master username: `informix_admin`
  - Master password: scegli una password sicura
  - Public access: Yes (per sviluppo)
- Copia l'Endpoint quando pronto.

Step 3.4 — Crea il secret su AWS Secrets Manager
- Console AWS → Secrets Manager → Store a new secret
- Tipo: Other type of secret, inserisci le coppie chiave/valore:
  - `PROXMOX_HOST`: IP del tuo Proxmox
  - `PROXMOX_USER`: `root@pam!portal-token`
  - `PROXMOX_TOKEN_VALUE`: token copiato
  - `DB_HOST`: endpoint RDS
  - `DB_PASSWORD`: password RDS
  - `JWT_SECRET_KEY`: stringa lunga casuale
- Nome del secret: `informix/portal/config`

Step 3.5 — Attiva Secrets Manager nel .env
- Modifica in `.env`:
  - `USE_AWS_SECRETS=true`
  - `AWS_REGION=eu-south-1`
  - `AWS_SECRET_NAME=informix/portal/config`
  - `AWS_ACCOUNT_ID=TUO_AWS_ACCOUNT_ID`

✅ Fase 3 completata — AWS ECR, RDS e Secrets Manager configurati.

## FASE 4 — Preparare la presentazione

Step 4.1 — Leggi la scaletta già pronta
- Apri [PRESENTAZIONE.md](PRESENTAZIONE.md#L1) e leggi la struttura.

Step 4.2 — Struttura delle slide
- Prepara ~12-15 slide:
  - Parte 1 — Prodotto (6 slide): Copertina, Problema, Soluzione, Demo live, Funzionalità, Sicurezza
  - Parte 2 — Tecnica (6 slide): Architettura, Stack, AWS, API Proxmox, Error handling, Test Plan
  - Servizio extra da mostrare: Creazione VM/CT con nome, descrizione e upload ISO

Step 4.3 — La demo live (ordine consigliato)
1. `docker compose up` (30s)
2. Apri `http://localhost`
3. Login
4. Dashboard con nodi reali
5. Inventario VM
6. Start/Stop VM
7. Creazione VM/CT: nome, descrizione, upload ISO
8. Grafici metriche
9. Backup → avvia snapshot
10. `http://localhost:8000/docs` (Swagger)

## FASE 5 — Consegna finale

Crea una cartella `consegna/` con:
- `informix-proxmox-portal/` (tutto il codice sorgente)
- `README.md` (già presente)
- `TEST_PLAN.md` (compilalo con i risultati reali)
- `presentazione.pptx` (le slide)

Checklist finale (verifica una per una):
- `docker compose up --build` funziona senza errori
- `http://localhost` si apre e login
- Dashboard mostra i nodi Proxmox reali
- Start/Stop VM funziona
- Grafici metriche si caricano
- Backup PBS funziona (o mostra banner se offline)
- Immagini pushate su AWS ECR
- Database su AWS RDS raggiungibile
- Secret su AWS Secrets Manager creato
- Presentazione slide pronta
- Demo live provata almeno 2 volte

## File che aprire in VS Code (promemoria rapido)
- `.env` — Fase 1 e 2: inserisci IP Proxmox e token
- `.env` — Fase 3: attiva `USE_AWS_SECRETS=true`
- `PRESENTAZIONE.md` — Fase 4: leggi la scaletta
- `TEST_PLAN.md` — Fase 5: compila con risultati
- `docker-compose.yml` — solo se c'è un errore



