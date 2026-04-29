from flask import Flask, render_template, jsonify, request, redirect, url_for, flash, session
from database import get_db_connection, init_db
import sqlite3
from datetime import datetime, timedelta

app = Flask(__name__)
app.secret_key = 'lumina_secret_key'

# Ensure DB is initialized
init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        
        conn = get_db_connection()
        user = conn.execute('SELECT * FROM users WHERE email = ? AND password = ?', (email, password)).fetchone()
        conn.close()
        
        if user:
            session['user_id'] = user['id']
            session['user_name'] = user['name']
            session['user_role'] = user['role']
            if user['role'] in ['admin', 'librarian']:
                return redirect(url_for('admin'))
            return redirect(url_for('catalog'))
        else:
            flash("Incorrect Email or Password")
            return redirect(url_for('login'))
            
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        name = request.form['name']
        email = request.form['email']
        password = request.form['password']
        role = request.form.get('role', 'user')
        
        try:
            conn = get_db_connection()
            conn.execute('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                         (name, email, password, role))
            conn.commit()
            conn.close()
            flash("Account created! Please log in.")
            return redirect(url_for('login'))
        except sqlite3.IntegrityError:
            flash("Email already exists.")
            return redirect(url_for('signup'))
            
    return render_template('signup.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/catalog')
def catalog():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('catalog.html', user=session)

@app.route('/shelf')
def shelf():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('shelf.html', user=session)

@app.route('/admin')
def admin():
    if session.get('user_role') not in ['admin', 'librarian']:
        return redirect(url_for('catalog'))
    return render_template('admin.html', user=session)

# --- API ROUTES ---

@app.route('/api/books', methods=['GET'])
def get_books():
    conn = get_db_connection()
    books = conn.execute('SELECT * FROM books').fetchall()
    conn.close()
    return jsonify([dict(book) for book in books])

@app.route('/api/books', methods=['POST'])
def add_book():
    if session.get('user_role') not in ['admin', 'librarian']:
        return jsonify({"error": "Unauthorized"}), 403
    
    data = request.json
    try:
        conn = get_db_connection()
        conn.execute('INSERT INTO books (title, author, isbn, genre, cover_url) VALUES (?, ?, ?, ?, ?)',
                     (data['title'], data['author'], data['isbn'], data['genre'], data['cover_url']))
        conn.commit()
        conn.close()
        return jsonify({"message": "Book added successfully"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/books/<int:book_id>', methods=['DELETE'])
def delete_book(book_id):
    if session.get('user_role') not in ['admin', 'librarian']:
        return jsonify({"error": "Unauthorized"}), 403
    
    conn = get_db_connection()
    conn.execute('DELETE FROM books WHERE id = ?', (book_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Book deleted successfully"})

@app.route('/api/books/<int:book_id>', methods=['PUT'])
def update_book(book_id):
    if session.get('user_role') not in ['admin', 'librarian']:
        return jsonify({"error": "Unauthorized"}), 403
    
    data = request.json
    try:
        conn = get_db_connection()
        conn.execute('UPDATE books SET title=?, author=?, isbn=?, genre=?, cover_url=? WHERE id=?',
                     (data['title'], data['author'], data['isbn'], data['genre'], data['cover_url'], book_id))
        conn.commit()
        conn.close()
        return jsonify({"message": "Book updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/borrow', methods=['POST'])
def borrow_book():
    if 'user_id' not in session:
        return jsonify({"error": "Login required"}), 401
    
    data = request.json
    book_id = data.get('book_id')
    user_id = session['user_id']
    
    conn = get_db_connection()
    book = conn.execute('SELECT * FROM books WHERE id = ?', (book_id,)).fetchone()
    
    if not book:
        conn.close()
        return jsonify({"error": "Book not found"}), 404
    
    if book['status'] != 'available':
        conn.close()
        return jsonify({"error": "Book is already borrowed"}), 400
    
    setting = conn.execute("SELECT value FROM settings WHERE key='borrow_duration_days'").fetchone()
    days = int(setting['value']) if setting else 14
    due_date = (datetime.now() + timedelta(days=days)).strftime('%Y-%m-%d')
    
    try:
        # Update book status
        conn.execute('UPDATE books SET status = "borrowed" WHERE id = ?', (book_id,))
        # Create loan record
        conn.execute('INSERT INTO loans (user_id, book_id, due_date) VALUES (?, ?, ?)',
                     (user_id, book_id, due_date))
        conn.commit()
        conn.close()
        return jsonify({"message": "Book borrowed successfully", "due_date": due_date})
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500

@app.route('/api/return', methods=['POST'])
def return_book():
    if 'user_id' not in session:
        return jsonify({"error": "Login required"}), 401
    
    data = request.json
    loan_id = data.get('loan_id')
    
    conn = get_db_connection()
    loan = conn.execute('SELECT * FROM loans WHERE id = ? AND status = "active"', (loan_id,)).fetchone()
    
    if not loan:
        conn.close()
        return jsonify({"error": "Active loan not found"}), 404
    
    try:
        # Calculate fine
        return_date = datetime.now().date()
        due_date = datetime.strptime(loan['due_date'], '%Y-%m-%d').date()
        
        fine_amount = 0.0
        if return_date > due_date:
            days_overdue = (return_date - due_date).days
            setting = conn.execute("SELECT value FROM settings WHERE key='fine_per_day'").fetchone()
            fine_per_day = float(setting['value']) if setting else 2.0
            fine_amount = days_overdue * fine_per_day

        # Update book status back to available
        conn.execute('UPDATE books SET status = "available" WHERE id = ?', (loan['book_id'],))
        # Update loan status to returned
        conn.execute('UPDATE loans SET status = "returned", return_date = ?, fine_amount = ? WHERE id = ?', 
                     (return_date.strftime('%Y-%m-%d'), fine_amount, loan_id))
        conn.commit()
        conn.close()
        return jsonify({"message": "Book returned successfully", "fine_amount": fine_amount, "loan_id": loan_id})
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500

@app.route('/api/my-loans')
def get_my_loans():
    if 'user_id' not in session:
        return jsonify({"error": "Login required"}), 401
    
    conn = get_db_connection()
    # Fetch active and returned loans
    loans = conn.execute('''
        SELECT l.id as loan_id, l.due_date, l.status as loan_status, l.fine_amount, l.return_date,
               b.title, b.author, b.cover_url, b.genre
        FROM loans l
        JOIN books b ON l.book_id = b.id
        WHERE l.user_id = ?
        ORDER BY l.status ASC, l.id DESC
    ''', (session['user_id'],)).fetchall()
    conn.close()
    return jsonify([dict(loan) for loan in loans])

@app.route('/receipt/<int:loan_id>')
def receipt(loan_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
        
    conn = get_db_connection()
    if session.get('user_role') in ['admin', 'librarian']:
        loan = conn.execute('''
            SELECT l.*, b.title, u.name as user_name 
            FROM loans l 
            JOIN books b ON l.book_id = b.id 
            JOIN users u ON l.user_id = u.id 
            WHERE l.id = ? AND l.status = "returned"
        ''', (loan_id,)).fetchone()
    else:
        loan = conn.execute('''
            SELECT l.*, b.title, u.name as user_name 
            FROM loans l 
            JOIN books b ON l.book_id = b.id 
            JOIN users u ON l.user_id = u.id 
            WHERE l.id = ? AND l.user_id = ? AND l.status = "returned"
        ''', (loan_id, session['user_id'])).fetchone()
        
    conn.close()
    
    if not loan:
        return "Receipt not found or you don't have permission.", 404
        
    return render_template('receipt.html', loan=dict(loan), current_date=datetime.now().strftime('%Y-%m-%d'))

@app.route('/api/admin/loans')
def get_all_loans():
    if session.get('user_role') not in ['admin', 'librarian']:
        return jsonify({"error": "Unauthorized"}), 403
    
    conn = get_db_connection()
    loans = conn.execute('''
        SELECT l.id as loan_id, l.borrow_date, l.due_date, l.status,
               b.title, u.name as user_name
        FROM loans l
        JOIN books b ON l.book_id = b.id
        JOIN users u ON l.user_id = u.id
    ''').fetchall()
    conn.close()
    return jsonify([dict(loan) for loan in loans])

@app.route('/api/admin/users', methods=['GET'])
def get_users():
    if session.get('user_role') not in ['admin', 'librarian']:
        return jsonify({"error": "Unauthorized"}), 403
    conn = get_db_connection()
    users = conn.execute('SELECT id, name, email, role FROM users').fetchall()
    conn.close()
    return jsonify([dict(u) for u in users])

@app.route('/api/admin/users/<int:user_id>/role', methods=['PUT'])
def update_user_role(user_id):
    if session.get('user_role') != 'admin':
        return jsonify({"error": "Unauthorized"}), 403
    role = request.json.get('role')
    conn = get_db_connection()
    conn.execute('UPDATE users SET role=? WHERE id=?', (role, user_id))
    conn.commit()
    conn.close()
    return jsonify({"message": "Role updated"})

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    if session.get('user_role') != 'admin':
        return jsonify({"error": "Unauthorized"}), 403
    conn = get_db_connection()
    conn.execute('DELETE FROM users WHERE id=?', (user_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "User deleted"})

@app.route('/api/admin/settings', methods=['GET', 'POST'])
def manage_settings():
    if session.get('user_role') != 'admin':
        return jsonify({"error": "Unauthorized"}), 403
    conn = get_db_connection()
    if request.method == 'POST':
        data = request.json
        for k, v in data.items():
            conn.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (k, str(v)))
        conn.commit()
        conn.close()
        return jsonify({"message": "Settings updated"})
    else:
        settings = conn.execute('SELECT * FROM settings').fetchall()
        conn.close()
        return jsonify({s['key']: s['value'] for s in settings})

@app.route('/api/status')
def status():
    return jsonify({"status": "Library System Backend is running", "version": "1.2.0"})

if __name__ == '__main__':
    app.run(debug=True)
