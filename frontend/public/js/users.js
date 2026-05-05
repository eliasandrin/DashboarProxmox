/* INFORMIX Spa — Users Management Module */
let allUsers = [];

function getShowModal() {
  if (typeof window.showModal === 'function') return window.showModal;
  if (typeof window.ensureShowModal === 'function') return window.ensureShowModal();
  return null;
}

async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  try {
    const data = await ApiClient.get('/users');
    allUsers = data || [];
    renderUsersTable(allUsers);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="alert alert-error">${e.message}</td></tr>`;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-muted);">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = users.map((user) => {
    const statusLabel = user.is_active ? 'Active' : 'Blocked';
    const statusClass = user.is_active ? 'status-badge running' : 'status-badge stopped';
    const toggleLabel = user.is_active ? 'Block' : 'Unblock';
    const roleToggleLabel = user.role === 'admin' ? 'Set operator' : 'Set admin';
    return `
      <tr>
        <td>${user.id}</td>
        <td>${user.username}</td>
        <td>${user.email}</td>
        <td>${user.role}</td>
        <td><span class="${statusClass}">${statusLabel}</span></td>
        <td>
          <div class="action-group">
            <button class="btn btn-sm btn-outline" onclick="toggleUserStatus(${user.id}, ${user.is_active})">${toggleLabel}</button>
            <button class="btn btn-sm btn-outline" onclick="toggleUserRole(${user.id}, '${user.role}')">${roleToggleLabel}</button>
            <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id}, '${user.username}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function toggleUserStatus(userId, currentStatus) {
  try {
    await ApiClient.patch(`/users/${userId}/status`, { is_active: !currentStatus });
    await loadUsers();
    showToast(currentStatus ? 'User blocked' : 'User unblocked', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteUser(userId, username) {
  const showModal = getShowModal();
  const proceed = async () => {
    try {
      await ApiClient.delete(`/users/${userId}`);
      await loadUsers();
      showToast(`User ${username} deleted`, 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  if (showModal) {
    showModal('Delete User', `Delete user ${username}?`, proceed);
  } else if (confirm(`Delete user ${username}?`)) {
    await proceed();
  }
}

async function toggleUserRole(userId, currentRole) {
  const nextRole = currentRole === 'admin' ? 'operator' : 'admin';
  try {
    await ApiClient.patch(`/users/${userId}/role`, { role: nextRole });
    await loadUsers();
    showToast(`Role set to ${nextRole}`, 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function openCreateUserModal() {
  const showModal = getShowModal();
  if (!showModal) {
    showToast('Modal not available', 'error');
    return;
  }

  const formHtml = `
    <div class="form-group">
      <label>Username</label>
      <input id="newUserUsername" type="text" style="width:100%;">
    </div>
    <div class="form-group">
      <label>Email</label>
      <input id="newUserEmail" type="email" style="width:100%;">
    </div>
    <div class="form-group">
      <label>Full name</label>
      <input id="newUserFullName" type="text" style="width:100%;">
    </div>
    <div class="form-group">
      <label>Password</label>
      <input id="newUserPassword" type="password" style="width:100%;">
    </div>
    <div class="form-group">
      <label>Role</label>
      <select id="newUserRole" style="width:100%;">
        <option value="operator">operator</option>
        <option value="admin">admin</option>
      </select>
    </div>
  `;

  showModal('Create User', '', async () => {
    const username = document.getElementById('newUserUsername')?.value?.trim();
    const email = document.getElementById('newUserEmail')?.value?.trim();
    const fullName = document.getElementById('newUserFullName')?.value?.trim();
    const password = document.getElementById('newUserPassword')?.value;
    const role = document.getElementById('newUserRole')?.value || 'operator';

    if (!username || !email || !password) {
      showToast('Username, email and password are required', 'error');
      return;
    }

    try {
      await ApiClient.post('/users', {
        username: username,
        email: email,
        full_name: fullName || null,
        password: password,
        role: role,
        is_active: true,
      });
      await loadUsers();
      showToast('User created', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }, formHtml);
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('createUserBtn');
  btn?.addEventListener('click', openCreateUserModal);
});
