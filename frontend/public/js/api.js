/* INFORMIX Spa — API Client */
const API_BASE = '/api';

class ApiClient {
  static getToken() { return sessionStorage.getItem('informix_token'); }
  static setToken(token) { sessionStorage.setItem('informix_token', token); }
  static clearToken() { sessionStorage.removeItem('informix_token'); sessionStorage.removeItem('informix_user'); }
  static getUser() { try { return JSON.parse(sessionStorage.getItem('informix_user')); } catch { return null; } }
  static setUser(user) { sessionStorage.setItem('informix_user', JSON.stringify(user)); }

  static async request(endpoint, options = {}) {
    const token = this.getToken();
    const isFormData = options.body instanceof FormData;
    const headers = { ...options.headers };
    if (!isFormData) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
      if (res.status === 401) {
        this.clearToken();
        if (!window.location.pathname.endsWith('/login.html')) {
          window.location.href = '/login.html';
        }
        throw new Error('Unauthorized');
      }

      let data = null;
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = text ? { detail: text } : {};
      }

      if (!res.ok) {
        const detail = data && Object.prototype.hasOwnProperty.call(data, 'detail') ? data.detail : null;
        let message = `HTTP ${res.status}`;

        if (typeof detail === 'string' && detail.trim()) {
          message = detail;
        } else if (Array.isArray(detail) && detail.length > 0) {
          const first = detail[0];
          if (typeof first === 'string') message = first;
          else if (first && typeof first.msg === 'string') message = first.msg;
          else if (first && typeof first.message === 'string') message = first.message;
          else message = 'Request validation failed';
        } else if (detail && typeof detail === 'object') {
          if (typeof detail.msg === 'string') message = detail.msg;
          else if (typeof detail.message === 'string') message = detail.message;
          else message = 'Request failed';
        }

        throw new Error(message);
      }
      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  static get(endpoint) { return this.request(endpoint); }
  static post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); }
  static patch(endpoint, body) { return this.request(endpoint, { method: 'PATCH', body: JSON.stringify(body) }); }
  static delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }

  static async postForm(endpoint, formData) {
    const token = this.getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return this.request(endpoint, { method: 'POST', body: formData, headers });
  }
}

/* Utility functions */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
}

function formatTimestamp(ts) {
  if (!ts) return '—';
  const value = Number(ts);
  if (Number.isNaN(value)) return '—';
  // Proxmox usually returns seconds; fall back to ms if needed.
  const ms = value > 1e12 ? value : value * 1000;
  return new Date(ms).toLocaleString(undefined, { timeZoneName: 'short' });
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `${type === 'success' ? '✅' : '❌'} ${message}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
}
