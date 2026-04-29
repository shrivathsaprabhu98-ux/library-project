import sqlite3
import os

DB_PATH = 'library.db'

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create Users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL
    )
    ''')
    
    # Create Books table (Phase 2)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        isbn TEXT UNIQUE NOT NULL,
        genre TEXT,
        cover_url TEXT,
        status TEXT DEFAULT 'available'
    )
    ''')
    
    # Create Loans table (Phase 3)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        book_id INTEGER NOT NULL,
        borrow_date DATE DEFAULT (DATE('now')),
        due_date DATE NOT NULL,
        status TEXT DEFAULT 'active',
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (book_id) REFERENCES books (id)
    )
    ''')
    
    # Create Settings table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    ''')
    cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('borrow_duration_days', '14')")
    cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('fine_per_day', '2')")
    
    # Safely add new columns to loans if they don't exist
    try:
        cursor.execute("ALTER TABLE loans ADD COLUMN return_date DATE")
        cursor.execute("ALTER TABLE loans ADD COLUMN fine_amount REAL DEFAULT 0.0")
    except sqlite3.OperationalError:
        pass
    
    # Initial seed data for books
    seed_books = [
        ('The Great Gatsby', 'F. Scott Fitzgerald', '9780743273565', 'Classic', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=800&q=80'),
        ('1984', 'George Orwell', '9780451524935', 'Dystopian', 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&w=800&q=80'),
        ('To Kill a Mockingbird', 'Harper Lee', '9780061120084', 'Classic', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80'),
        ('The Hobbit', 'J.R.R. Tolkien', '9780547928227', 'Fantasy', 'https://images.unsplash.com/photo-1621351183012-e2f9972dd9bf?auto=format&fit=crop&w=800&q=80'),
        ('Pride and Prejudice', 'Jane Austen', '9780141439518', 'Romance', 'https://images.unsplash.com/photo-1543004622-05960d75ae7a?auto=format&fit=crop&w=800&q=80')
    ]
    
    for book in seed_books:
        try:
            cursor.execute('INSERT INTO books (title, author, isbn, genre, cover_url) VALUES (?, ?, ?, ?, ?)', book)
        except sqlite3.IntegrityError:
            pass # Book already exists
            
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully.")
