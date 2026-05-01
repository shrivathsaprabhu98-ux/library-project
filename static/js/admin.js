// Functions moved to global scope for reliable access from inline handlers
window.switchTab = (tabId, event) => {
    document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    const section = document.getElementById(`${tabId}-sec`);
    if (section) section.classList.add('active');
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
};

window.changeRole = async (userId, newRole) => {
    try {
        const res = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({role: newRole})
        });
        if (!res.ok) alert('Failed to update role');
    } catch(e) { console.error('Error changing role:', e); }
};

window.deleteUser = async (userId) => {
    console.log('Attempting to delete user:', userId);
    if (!confirm('Are you sure you want to delete this user? This will also remove their loan history.')) {
        return;
    }
    try {
        const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
        if (res.ok) {
            console.log('User deleted successfully');
            // We'll call the refresh function if it exists
            if (window.refreshUsers) window.refreshUsers();
        } else {
            const errorData = await res.json();
            alert('Failed to delete user: ' + (errorData.error || 'Unknown error'));
        }
    } catch(e) { console.error('Error deleting user:', e); }
};

window.returnAdminLoan = async (loanId) => {
    if(!confirm('Force return this book?')) return;
    try {
        const res = await fetch('/api/return', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({loan_id: loanId})
        });
        if (res.ok) {
            const data = await res.json();
            if(data.fine_amount > 0) {
                alert(`Book force returned! A fine of ₹${data.fine_amount.toFixed(2)} was charged.`);
            } else {
                alert('Book force returned successfully!');
            }
            if (window.refreshLoans) window.refreshLoans();
        } else {
            alert('Failed to return book');
        }
    } catch (e) { console.error('Error returning loan:', e); }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin Dashboard JS Loaded');
    
    // Make refresh functions available globally
    window.refreshUsers = fetchUsers;
    window.refreshLoans = fetchLoans;

    // Initial fetch
    fetchUsers();
    fetchLoans();

    // --- USERS ---
    async function fetchUsers() {
        const tbody = document.getElementById('users-tbody');
        if (!tbody) return;
        
        try {
            const res = await fetch('/api/admin/users');
            const users = await res.json();
            
            if(users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4">No users found.</td></tr>';
                return;
            }

            tbody.innerHTML = users.map(u => {
                let roleCell = `<span style="text-transform: capitalize;">${u.role}</span>`;
                let actionCell = '';
                if (typeof CURRENT_USER_ROLE !== 'undefined' && CURRENT_USER_ROLE === 'admin') {
                    roleCell = `
                        <select class="role-select" onchange="changeRole(${u.id}, this.value)">
                            <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                            <option value="librarian" ${u.role === 'librarian' ? 'selected' : ''}>Librarian</option>
                            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    `;
                    actionCell = `<td><button class="btn btn-outline btn-sm delete-user-btn" data-id="${u.id}" style="color:red;border-color:red;">Delete</button></td>`;
                }
                return `
                    <tr>
                        <td>${u.name}</td>
                        <td>${u.email}</td>
                        <td>${roleCell}</td>
                        ${actionCell}
                    </tr>
                `;
            }).join('');

            // Attach event listeners to delete buttons (Event Delegation is better, but let's use direct attachment for simplicity since we refresh the whole table)
            document.querySelectorAll('.delete-user-btn').forEach(btn => {
                btn.onclick = () => window.deleteUser(btn.dataset.id);
            });

        } catch (e) {
            console.error('Failed to fetch users:', e);
        }
    }

    // --- LOANS ---
    async function fetchLoans() {
        const tbody = document.getElementById('loans-tbody');
        if (!tbody) return;

        try {
            const res = await fetch('/api/admin/loans');
            const loans = await res.json();
            
            if(loans.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5">No active loans.</td></tr>';
                return;
            }

            tbody.innerHTML = loans.map(l => `
                <tr>
                    <td>${l.title}</td>
                    <td>${l.user_name}</td>
                    <td>${l.due_date}</td>
                    <td><span class="status-badge status-${l.status === 'active' ? 'borrowed' : 'available'}">${l.status}</span></td>
                    <td>
                        ${l.status === 'active' ? `<button class="btn btn-outline btn-sm" onclick="returnAdminLoan(${l.loan_id})">Force Return</button>` : '-'}
                    </td>
                </tr>
            `).join('');
        } catch (e) { console.error('Failed to fetch loans:', e); }
    }


});
