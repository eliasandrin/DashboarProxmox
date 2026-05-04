/* INFORMIX Spa — Internationalization (IT/EN) */
const I18N = {

  it: {
    login_subtitle: "Accedi per usare il sistema di gestione",
    register_subtitle: "Crea il tuo account portale per continuare",
    username: "Nome utente", password: "Password", sign_in: "Accedi",
    logout: "Disconnettiti",
    full_name: "Nome completo", email: "Email", create_account: "Crea Account",
    confirm_password: "Conferma password",
    register_hint: "Registra il primo account per abilitare l'accesso al portale.",
    login_hint: "Usa le credenziali del tuo account per accedere.",
    register_success: "Registrazione completata. Ora puoi accedere.",
    register_failed: "Registrazione fallita",
    username_exists: "Nome utente gia esistente",
    email_exists: "Email gia esistente",
    email_domain_invalid: "Sono consentite solo email con dominio @informix.it",
    min_6_chars: "Questo campo deve contenere almeno 6 caratteri",
    min_8_chars: "Questo campo deve contenere almeno 8 caratteri",
    invalid_email_local: "Inserisci un nome email valido prima di @informix.it",
    password_mismatch: "Le password non coincidono",
    backend_unreachable: "Impossibile raggiungere il server. Verifica che i container siano attivi e ricarica la pagina.",
    registration_already_done: "La configurazione account e gia completata. Puoi accedere.",
    registration_required: "Non esiste ancora un account nel sistema. Prima crea il primo account dalla pagina di registrazione, poi effettua il login.",
    generic_error: "Si e verificato un errore imprevisto",
    already_have_account: "Hai gia un account?",
    go_to_login: "Vai al login",
    need_account: "Ti serve un account?",
    go_to_register: "Creane uno",
    nav_overview: "Panoramica", nav_dashboard: "Dashboard", nav_inventory: "Inventario VM/CT",
    nav_operations: "Operazioni", nav_monitoring: "Monitoraggio", nav_backup: "Snapshot e Backup",
    nav_advanced: "Avanzate", nav_cluster: "Cluster e Migrazione",
    refresh: "Aggiorna", loading: "Caricamento...",
    quick_overview: "Panoramica Rapida VM",
    vm_inventory: "Inventario VM / CT", search_vms: "Cerca VM...",
    th_name: "Nome", th_status: "Stato", th_type: "Tipo", th_node: "Nodo", th_actions: "Azioni",
    cpu_usage: "Utilizzo CPU (%)", mem_usage: "Utilizzo Memoria", net_io: "I/O di Rete", disk_io: "I/O Disco",
    select_target: "Seleziona target:", select_node_vm: "-- Seleziona Nodo o VM --",
    snapshots: "Snapshot", backup_history: "Cronologia Backup (PBS)",
    create_snapshot: "Crea Snapshot", start_backup: "Avvia Backup (PBS)",
    select_vm_backup: "Seleziona VM:", pbs_warning: "Il Proxmox Backup Server è temporaneamente non raggiungibile.",
    cluster_info: "Cluster Awareness — Mappa le VM sui nodi fisici ed esegui migrazioni live.",
    cluster_map: "Mappa Cluster", live_migration: "Migrazione Live",
    select_vm_migrate: "VM da Migrare", target_node: "Nodo Destinazione", start_migration: "Avvia Migrazione",
    cancel: "Annulla", confirm: "Conferma",
    confirm_action: "Sei sicuro di voler eseguire {action} su {name}?",
    snapshot_name: "Nome Snapshot", snapshot_desc: "Descrizione (opzionale)",
    no_snapshots: "Nessun snapshot trovato", no_backups: "Nessun backup trovato",
    backup_started: "Backup avviato con successo", backup_failed: "Backup fallito",
    migration_started: "Migrazione avviata", migration_failed: "Migrazione fallita",
    uptime: "Uptime", vms_count: "VM", cts_count: "CT",
    login_failed: "Nome utente o password non validi",
    cores: "Core",
    create_vm_ct: "Crea VM/CT",
    vm_type: "Tipo",
    vm_name: "Nome",
    vm_description: "Descrizione",
    vm_id: "VMID",
    ram_mb: "RAM (MB)",
    disk_gb: "Disco (GB)",
    network_bridge: "Network (bridge)",
    iso_storage: "Storage ISO",
    iso_file: "File ISO",
    iso_upload: "Carica ISO",
    ct_template: "Template CT",
    create: "Crea",
    disk_storage: "Storage Disco",
  }
};

let currentLang = 'it';

function t(key, replacements = {}) {
  let text = (I18N.it && I18N.it[key]) || key;
  for (const [k, v] of Object.entries(replacements)) text = text.replace(`{${k}}`, v);
  return text;
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applyI18n();
});
