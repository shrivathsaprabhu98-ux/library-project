document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch
    fetchUsers();
    fetchLoans();
    if (typeof CURRENT_USER_ROLE !== 'undefined' && CURRENT_USER_ROLE === 'admin') {
        fetchSettings();
    }

    // Tab switching logic attached to window for inline onclick access
    window.switchTab = (tabId) => {
        document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        
        document.getElementById(`${tabId}-sec`).classList.add('active');
        event.currentTarget.classList.add('active');
    };

    // --- USERS ---
    async function fetchUsers() {
        try {
            const res = await fetch('/api/admin/users');
            const users = await res.json();
            const tbody = document.getElementById('users-tbody');
            if(users.length === 0) tbody.innerHTML = '<tr><td colspan="4">No users found.</td></tr>';
            else {
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
                        actionCell = `<td><button class="btn btn-outline btn-sm" onclick="deleteUser(${u.id})" style="color:red;border-color:red;">Delete</button></td>`;
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
            }
        } catch (e) {
            console.error(e);
        }
    }

    window.changeRole = async (userId, newRole) => {
        try {
            const res = await fetch(`/api/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({role: newRole})
            });
            if (!res.ok) alert('Failed to update role');
        } catch(e) { console.error(e); }
    };

    window.deleteUser = async (userId) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
            if (res.ok) fetchUsers();
            else alert('Failed to delete user');
        } catch(e) { console.error(e); }
    };

    // --- LOANS ---
    async function fetchLoans() {
        try {
            const res = await fetch('/api/admin/loans');
            const loans = await res.json();
            const tbody = document.getElementById('loans-tbody');
            if(loans.length === 0) tbody.innerHTML = '<tr><td colspan="5">No active loans.</td></tr>';
            else {
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
            }
        } catch (e) { console.error(e); }
    }

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
                fetchLoans();
            }
            else {
                alert('Failed to return book');
            }
        } catch (e) { console.error(e); }
    };

    // --- SETTINGS ---
    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/admin/settings');
            if (response.ok) {
                const data = await response.json();
                const borrowEl = document.getElementById('borrow_duration_days');
                const fineEl = document.getElementById('fine_per_day');
                if (borrowEl) borrowEl.value = data.borrow_duration_days || 14;
                if (fineEl) fineEl.value = data.fine_per_day || 2;
            }
        } catch (e) {
            console.error(e);
        }
    }; 
    
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.onsubmit = async (e) => {
            e.preventDefault();
            const days = document.getElementById('borrow_duration_days').value;
            const fine = document.getElementById('fine_per_day').value;
            try {
                const res = await fetch('/api/admin/settings', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        borrow_duration_days: days,
                        fine_per_day: fine
                    })
                });
                if(res.ok) {
                    alert('Settings saved!');
                    fetchSettings();
                }
            } catch(e) { console.error(e); }
        };
    }
});
