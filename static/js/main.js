document.addEventListener('DOMContentLoaded', () => {
    console.log('Lumina Library System Loaded');

    const catalogGrid = document.getElementById('catalog-grid');
    const shelfGrid = document.getElementById('shelf-grid');
    const searchInput = document.getElementById('book-search');
    const genreFilter = document.getElementById('genre-filter');
    const addBookBtn = document.getElementById('add-book-btn');
    const addBookModal = document.getElementById('add-book-modal');
    const closeModal = document.getElementById('close-modal');
    const addBookForm = document.getElementById('add-book-form');

    let allBooks = [];

    // --- FETCH & RENDER CATALOG ---
    const fetchBooks = async () => {
        try {
            const response = await fetch('/api/books');
            allBooks = await response.json();
            renderBooks(allBooks);
        } catch (err) {
            console.error('Failed to fetch books:', err);
            if (catalogGrid) catalogGrid.innerHTML = '<p class="error">Failed to load books.</p>';
        }
    };

    const renderBooks = (books) => {
        if (!catalogGrid) return;
        
        if (books.length === 0) {
            catalogGrid.innerHTML = '<div class="loader">No books found matching your criteria.</div>';
            return;
        }

        catalogGrid.innerHTML = books.map(book => {
            const coverUrl = book.cover_url || 'https://placehold.co/400x600/e2e8f0/475569?text=No+Cover';
            return `
                <div class="book-card animate-up">
                    <div class="book-cover">
                        <img src="${coverUrl}" 
                             onerror="this.onerror=null; this.src='https://placehold.co/400x600/e2e8f0/475569?text=Cover+Error';" 
                             alt="${book.title}"
                             loading="lazy">
                        <span class="status-badge status-${book.status}">${book.status}</span>
                    </div>
                    <div class="book-info">
                        <h3>${book.title}</h3>
                        <p class="book-author">by ${book.author}</p>
                        <div class="book-meta">
                            <span class="book-genre">${book.genre}</span>
                            <div>
                            ${!addBookBtn ? `
                                ${book.status === 'available' 
                                    ? `<button onclick="borrowBook(${book.id})" class="btn btn-primary btn-sm">Borrow</button>` 
                                    : `<span class="btn btn-outline btn-sm disabled">Unavailable</span>`}
                            ` : `
                                <div style="display: flex; flex-direction: column; gap: 5px;">
                                    <button onclick="openEditModal(${book.id})" class="btn btn-outline btn-sm">Edit</button>
                                    <button onclick="deleteBook(${book.id})" class="btn btn-outline btn-sm" style="color: #ef4444; border-color: #ef4444;">Delete</button>
                                </div>
                            `}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    // --- FETCH & RENDER SHELF ---
    const fetchShelf = async () => {
        if (!shelfGrid) return;
        try {
            const response = await fetch('/api/my-loans');
            const loans = await response.json();
            
            const historyGrid = document.getElementById('history-grid');
            const activeLoans = loans.filter(l => l.loan_status === 'active');
            const returnedLoans = loans.filter(l => l.loan_status === 'returned');

            if (activeLoans.length === 0) {
                shelfGrid.innerHTML = '<p class="empty-state">Your active shelf is empty. Go to the catalog to borrow some books!</p>';
            } else {
                shelfGrid.innerHTML = activeLoans.map(loan => `
                    <div class="book-card animate-up">
                        <div class="book-cover">
                            <img src="${loan.cover_url || 'https://placehold.co/400x600?text=No+Cover'}" alt="${loan.title}" onerror="this.onerror=null; this.src='https://placehold.co/400x600?text=No+Cover';">
                            <div class="status-badge status-borrowed">Due: ${loan.due_date}</div>
                        </div>
                        <div class="book-info">
                            <h3 class="book-title">${loan.title}</h3>
                            <p class="book-author">by ${loan.author}</p>
                            <div class="book-meta">
                                <span class="book-genre">${loan.genre}</span>
                                <button onclick="returnBook(${loan.loan_id})" class="btn btn-outline btn-sm">Return</button>
                            </div>
                        </div>
                    </div>
                `).join('');
            }

            if (historyGrid) {
                if (returnedLoans.length === 0) {
                    historyGrid.innerHTML = '<p class="empty-state">No return history yet.</p>';
                } else {
                    historyGrid.innerHTML = returnedLoans.map(loan => `
                        <div class="book-card animate-up" style="opacity: 0.8;">
                            <div class="book-cover">
                                <img src="${loan.cover_url || 'https://placehold.co/400x600?text=No+Cover'}" alt="${loan.title}" onerror="this.onerror=null; this.src='https://placehold.co/400x600?text=No+Cover';">
                                <div class="status-badge status-available">Returned</div>
                            </div>
                            <div class="book-info">
                                <h3 class="book-title">${loan.title}</h3>
                                <p class="book-author">Returned: ${loan.return_date}</p>
                                <div class="book-meta">
                                    <span class="book-genre" style="${loan.fine_amount > 0 ? 'color: #ef4444; font-weight: bold;' : ''}">
                                        ${loan.fine_amount > 0 ? `Fine: ₹${loan.fine_amount.toFixed(2)}` : 'No Fine'}
                                    </span>
                                    <a href="/receipt/${loan.loan_id}" target="_blank" class="btn btn-outline btn-sm">Receipt</a>
                                </div>
                            </div>
                        </div>
                    `).join('');
                }
            }
        } catch (err) {
            console.error('Failed to fetch shelf:', err);
            shelfGrid.innerHTML = '<p class="error">Failed to load your shelf.</p>';
        }
    };

    // --- ACTIONS ---
    window.borrowBook = async (bookId) => {
        try {
            const response = await fetch('/api/borrow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ book_id: bookId })
            });
            const result = await response.json();
            if (response.ok) {
                alert('Success! Return by: ' + result.due_date);
                fetchBooks();
            } else {
                alert(result.error);
            }
        } catch (err) {
            console.error('Borrow failed:', err);
        }
    };

    window.returnBook = async (loanId) => {
        try {
            const response = await fetch('/api/return', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loan_id: loanId })
            });
            if (response.ok) {
                const data = await response.json();
                if(data.fine_amount > 0) {
                    alert(`Book returned! A fine of ₹${data.fine_amount.toFixed(2)} was charged for late return.`);
                } else {
                    alert('Book returned successfully!');
                }
                fetchShelf();
            } else {
                const result = await response.json();
                alert(result.error);
            }
        } catch (err) {
            console.error('Return failed:', err);
        }
    };

    window.deleteBook = async (bookId) => {
        if (!confirm('Are you sure you want to delete this book? This will also remove its loan history.')) return;
        try {
            const response = await fetch(`/api/books/${bookId}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (response.ok) {
                alert('Book deleted successfully');
                fetchBooks();
            } else {
                alert('Error: ' + result.error);
            }
        } catch (err) {
            console.error('Delete book failed:', err);
        }
    };

    // --- SEARCH & FILTER ---
    const filterBooks = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedGenre = genreFilter.value;

        const filtered = allBooks.filter(book => {
            const matchesSearch = book.title.toLowerCase().includes(searchTerm) || 
                                book.author.toLowerCase().includes(searchTerm) ||
                                book.isbn.includes(searchTerm);
            const matchesGenre = selectedGenre === 'all' || book.genre === selectedGenre;
            return matchesSearch && matchesGenre;
        });

        renderBooks(filtered);
    };

    if (searchInput) searchInput.addEventListener('input', filterBooks);
    if (genreFilter) genreFilter.addEventListener('change', filterBooks);

    // --- ADMIN MODAL LOGIC ---
    if (addBookBtn) {
        addBookBtn.onclick = () => addBookModal.style.display = 'block';
    }

    if (closeModal) {
        closeModal.onclick = () => addBookModal.style.display = 'none';
    }

    window.onclick = (event) => {
        if (event.target == addBookModal) {
            addBookModal.style.display = 'none';
        }
        if (typeof editBookModal !== 'undefined' && event.target == editBookModal) {
            editBookModal.style.display = 'none';
        }
    };

    if (addBookForm) {
        addBookForm.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(addBookForm);
            const bookData = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/api/books', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bookData)
                });

                if (response.ok) {
                    addBookModal.style.display = 'none';
                    addBookForm.reset();
                    fetchBooks();
                } else {
                    const err = await response.json();
                    alert('Error: ' + err.error);
                }
            } catch (err) {
                console.error('Failed to add book:', err);
            }
        };
    }

    const editBookModal = document.getElementById('edit-book-modal');
    const closeEditModal = document.getElementById('close-edit-modal');
    const editBookForm = document.getElementById('edit-book-form');

    window.openEditModal = (bookId) => {
        const book = allBooks.find(b => b.id === bookId);
        if(book) {
            document.getElementById('edit-book-id').value = book.id;
            document.getElementById('edit-book-title').value = book.title;
            document.getElementById('edit-book-author').value = book.author;
            document.getElementById('edit-book-isbn').value = book.isbn;
            document.getElementById('edit-book-genre').value = book.genre;
            document.getElementById('edit-book-cover').value = book.cover_url || '';
            editBookModal.style.display = 'block';
        }
    };

    if (closeEditModal) {
        closeEditModal.onclick = () => editBookModal.style.display = 'none';
    }

    if (editBookForm) {
        editBookForm.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(editBookForm);
            const bookData = Object.fromEntries(formData.entries());
            const bookId = bookData.id;
            delete bookData.id;

            try {
                const response = await fetch(`/api/books/${bookId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bookData)
                });

                if (response.ok) {
                    editBookModal.style.display = 'none';
                    editBookForm.reset();
                    fetchBooks();
                } else {
                    const err = await response.json();
                    alert('Error: ' + err.error);
                }
            } catch (err) {
                console.error('Failed to update book:', err);
            }
        };
    }

    // Initial load
    if (catalogGrid) fetchBooks();
    if (shelfGrid) fetchShelf();

    // Smooth scroll for landing page
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                const element = document.getElementById(targetId);
                if (element) {
                    window.scrollTo({
                        top: element.offsetTop - 80,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
});
