use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Book {
    pub id: String,
    pub title: String,
    pub path: String,
    pub format: String,
    pub added_at: i64,
    pub last_read_at: Option<i64>,
    pub last_position: i64,
    pub tags: String, // JSON array string
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stock {
    pub id: String,
    pub code: String,
    pub name: String,
}

/// Returns the path to the database file: ~/.mofish/mofish.db
pub fn get_db_path() -> std::io::Result<PathBuf> {
    let home = dirs::home_dir().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::NotFound, "Cannot find home directory")
    })?;
    let mofish_dir = home.join(".mofish");
    Ok(mofish_dir.join("mofish.db"))
}

/// Initialize the database connection and create tables if they don't exist
pub fn init_db() -> Result<Connection> {
    let db_path = get_db_path().map_err(|e: std::io::Error| {
        rusqlite::Error::InvalidPath(e.to_string().into())
    })?;

    // Ensure the directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e: std::io::Error| {
            rusqlite::Error::InvalidPath(e.to_string().into())
        })?;
    }

    let conn = Connection::open(&db_path)?;

    // Create books table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS books (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            path TEXT NOT NULL,
            format TEXT NOT NULL,
            added_at INTEGER NOT NULL,
            last_read_at INTEGER,
            last_position INTEGER NOT NULL DEFAULT 0,
            tags TEXT NOT NULL DEFAULT '[]'
        )",
        [],
    )?;

    // Create tags table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            color TEXT
        )",
        [],
    )?;

    // Create bookmarks table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS bookmarks (
            id TEXT PRIMARY KEY,
            book_id TEXT NOT NULL,
            position INTEGER NOT NULL,
            note TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (book_id) REFERENCES books(id)
        )",
        [],
    )?;

    // Create stocks table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS stocks (
            id TEXT PRIMARY KEY,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL
        )",
        [],
    )?;

    Ok(conn)
}

/// Global lazy connection pool - wrapped in mutex since Connection is not Sync
static DB_CONNECTION: OnceLock<Mutex<Connection>> = OnceLock::new();

/// Get or create the cached database connection
fn get_db_connection() -> Result<&'static Mutex<Connection>> {
    let conn = DB_CONNECTION.get_or_init(|| {
        Mutex::new(init_db().expect("Failed to initialize database"))
    });
    Ok(conn)
}

// Book row mapper - extracts a Book from a row
fn row_to_book(row: &rusqlite::Row) -> rusqlite::Result<Book> {
    Ok(Book {
        id: row.get("id")?,
        title: row.get("title")?,
        path: row.get("path")?,
        format: row.get("format")?,
        added_at: row.get("added_at")?,
        last_read_at: row.get("last_read_at")?,
        last_position: row.get("last_position")?,
        tags: row.get("tags")?,
    })
}

// Stock row mapper - extracts a Stock from a row
fn row_to_stock(row: &rusqlite::Row) -> rusqlite::Result<Stock> {
    Ok(Stock {
        id: row.get("id")?,
        code: row.get("code")?,
        name: row.get("name")?,
    })
}

// Book CRUD functions

/// Get all books from the database
pub fn get_all_books() -> Result<Vec<Book>> {
    let conn_mutex = get_db_connection()?;
    let conn = conn_mutex.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, title, path, format, added_at, last_read_at, last_position, tags FROM books ORDER BY added_at DESC"
    )?;

    let books = stmt.query_map([], row_to_book)?.collect::<Result<Vec<_>>>()?;
    Ok(books)
}

/// Search books by keyword in title
pub fn search_books(keyword: &str) -> Result<Vec<Book>> {
    let conn_mutex = get_db_connection()?;
    let conn = conn_mutex.lock().unwrap();
    let pattern = format!("%{}%", keyword);
    let mut stmt = conn.prepare(
        "SELECT id, title, path, format, added_at, last_read_at, last_position, tags FROM books WHERE title LIKE ? ORDER BY added_at DESC"
    )?;

    let books = stmt.query_map([&pattern], row_to_book)?.collect::<Result<Vec<_>>>()?;
    Ok(books)
}

/// Get a book by its ID
pub fn get_book_by_id(id: &str) -> Result<Option<Book>> {
    let conn_mutex = get_db_connection()?;
    let conn = conn_mutex.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, title, path, format, added_at, last_read_at, last_position, tags FROM books WHERE id = ?"
    )?;

    let mut books = stmt.query_map([id], row_to_book)?;

    match books.next() {
        Some(result) => Ok(Some(result?)),
        None => Ok(None),
    }
}

/// Update the reading position of a book
pub fn update_book_position(id: &str, position: i64) -> Result<()> {
    let conn_mutex = get_db_connection()?;
    let conn = conn_mutex.lock().unwrap();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "UPDATE books SET last_position = ?, last_read_at = ? WHERE id = ?",
        (position, now, id),
    )?;

    Ok(())
}

/// Add a new book to the library
pub fn add_book(title: &str, path: &str, format: &str) -> Result<String> {
    let conn_mutex = get_db_connection()?;
    let conn = conn_mutex.lock().unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "INSERT INTO books (id, title, path, format, added_at, last_position, tags) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (&id, title, path, format, now, 0, "[]"),
    )?;

    Ok(id)
}

/// Check if a book with the given path already exists
pub fn book_exists_by_path(path: &str) -> Result<bool> {
    let conn_mutex = get_db_connection()?;
    let conn = conn_mutex.lock().unwrap();

    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM books WHERE path = ?",
        [path],
        |row| row.get(0),
    )?;

    Ok(count > 0)
}

// Stock CRUD functions

/// Add a new stock
pub fn add_stock(code: &str, name: &str) -> Result<()> {
    let conn_mutex = get_db_connection()?;
    let conn = conn_mutex.lock().unwrap();
    let id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO stocks (id, code, name) VALUES (?, ?, ?)",
        (&id, code, name),
    )?;

    Ok(())
}

/// Get all stocks
pub fn get_all_stocks() -> Result<Vec<Stock>> {
    let conn_mutex = get_db_connection()?;
    let conn = conn_mutex.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, code, name FROM stocks ORDER BY code")?;

    let stocks = stmt.query_map([], row_to_stock)?.collect::<Result<Vec<_>>>()?;
    Ok(stocks)
}

/// Delete a stock by ID
pub fn delete_stock(id: &str) -> Result<()> {
    let conn_mutex = get_db_connection()?;
    let conn = conn_mutex.lock().unwrap();
    conn.execute("DELETE FROM stocks WHERE id = ?", [id])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_db_path() {
        let path = get_db_path().unwrap();
        assert!(path.to_str().unwrap().ends_with(".mofish/mofish.db"));
    }

    #[test]
    fn test_init_db() {
        let conn = init_db();
        assert!(conn.is_ok());

        // Verify tables exist
        if let Ok(conn) = conn {
            let mut stmt = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'").unwrap();
            let tables: Vec<String> = stmt.query_map([], |row| row.get(0)).unwrap().map(|r| r.unwrap()).collect();
            assert!(tables.contains(&"books".to_string()));
            assert!(tables.contains(&"tags".to_string()));
            assert!(tables.contains(&"bookmarks".to_string()));
            assert!(tables.contains(&"stocks".to_string()));
            drop(stmt);
        }
    }
}
