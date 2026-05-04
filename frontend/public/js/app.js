/* INFORMIX Spa — Main App Controller */
document.addEventListener('DOMContentLoaded', () => {
  // Auth guard
  if (!ApiClient.getToken()) { window.location.href = '/login.html'; return; }

  // Load user info
  const user = ApiClient.getUser();
  if (user) {
    const avatar = document.getElementById('userAvatar');
    const name = document.getElementById('userName');
    const role = document.getElementById('userRole');
    if (avatar) avatar.textContent = (user.full_name || user.username)[0].toUpperCase();
    if (name) name.textContent = user.full_name || user.username;
    if (role) role.textContent = user.role;
  }

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    ApiClient.clearToken();
    window.location.href = '/login.html';
  });

  // Navigation
  const navItems = document.querySelectorAll('.nav-item[data-section]');
  const sections = document.querySelectorAll('.section');
  const pageTitle = document.getElementById('pageTitle');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
  const isMobile = () => window.matchMedia('(max-width: 900px)').matches;

  const closeMobileMenu = () => {
    sidebar?.classList.remove('open');
    sidebarBackdrop?.classList.remove('active');
  };

  const openMobileMenu = () => {
    sidebar?.classList.add('open');
    sidebarBackdrop?.classList.add('active');
  };

  mobileMenuBtn?.addEventListener('click', () => {
    if (sidebar?.classList.contains('open')) closeMobileMenu();
    else openMobileMenu();
  });

  sidebarCloseBtn?.addEventListener('click', closeMobileMenu);
  sidebarBackdrop?.addEventListener('click', closeMobileMenu);

  document.querySelector('.sidebar-nav')?.addEventListener('click', () => {
    if (isMobile()) closeMobileMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMobileMenu();
  });

  window.addEventListener('resize', () => {
    if (!isMobile()) closeMobileMenu();
  });

  const sectionTitles = {
    dashboard: 'nav_dashboard', vms: 'nav_inventory',
    monitoring: 'nav_monitoring', backup: 'nav_backup', cluster: 'nav_cluster'
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      sections.forEach(s => s.classList.remove('active'));
      const target = document.getElementById(`section-${section}`);
      if (target) target.classList.add('active');
      if (pageTitle) pageTitle.textContent = t(sectionTitles[section] || section);

      // Load section data
      if (section === 'vms') loadVmTable();
      if (section === 'monitoring') { initCharts(); populateMonitorTargets(); }
      if (section === 'backup') { populateBackupVmSelect(); loadBackupHistory(); }
      if (section === 'cluster') loadCluster();
    });
  });

  // Refresh button
  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    const active = document.querySelector('.nav-item.active')?.dataset.section;
    if (active === 'dashboard') loadDashboard();
    else if (active === 'vms') { allVms = []; loadVmTable(); }
    else if (active === 'monitoring') loadMonitoringData();
    else if (active === 'backup') { const val = document.getElementById('backupVmSelect')?.value; if (val) { const [n, v, tp] = val.split('/'); loadSnapshots(n, v, tp); loadBackupHistory(parseInt(v)); } }
    else if (active === 'cluster') loadCluster();
    showToast('Data refreshed', 'success');
  });

  // Initial load
  loadDashboard();
  applyI18n();

  // Check demo mode and show badge
  ApiClient.get('/health').then(h => {
    if (h && h.demo_mode) {
      const badge = document.getElementById('demoBadge');
      if (badge) badge.style.display = '';
    }
  }).catch(() => {});
});
