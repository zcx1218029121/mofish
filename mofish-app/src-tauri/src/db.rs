use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

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
pub fn get_db_path() -> PathBuf {
    let home = dirs::home_dir().expect("Cannot find home directory");
    let mofish_dir = home.join(".mofish");
    mofish_dir.join("mofish.db")
}

/// Initialize the database connection and create tables if they don't exist
pub fn init_db() -> Result<Connection> {
    let db_path = get_db_path();

    // Ensure the directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).expect("Cannot create .mofish directory");
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

// Book CRUD functions

/// Get all books from the database
pub fn get_all_books() -> Result<Vec<Book>> {
    let conn = init_db()?;
    let mut stmt = conn.prepare(
        "SELECT id, title, path, format, added_at, last_read_at, last_position, tags FROM books ORDER BY added_at DESC"
    )?;

    let books = stmt.query_map([], |row| {
        Ok(Book {
            id: row.get(0)?,
            title: row.get(1)?,
            path: row.get(2)?,
            format: row.get(3)?,
            added_at: row.get(4)?,
            last_read_at: row.get(5)?,
            last_position: row.get(6)?,
            tags: row.get(7)?,
        })
    })?.collect::<Result<Vec<_>>>()?;

    Ok(books)
}

/// Search books by keyword in title
pub fn search_books(keyword: &str) -> Result<Vec<Book>> {
    let conn = init_db()?;
    let pattern = format!("%{}%", keyword);
    let mut stmt = conn.prepare(
        "SELECT id, title, path, format, added_at, last_read_at, last_position, tags FROM books WHERE title LIKE ? ORDER BY added_at DESC"
    )?;

    let books = stmt.query_map([&pattern], |row| {
        Ok(Book {
            id: row.get(0)?,
            title: row.get(1)?,
            path: row.get(2)?,
            format: row.get(3)?,
            added_at: row.get(4)?,
            last_read_at: row.get(5)?,
            last_position: row.get(6)?,
            tags: row.get(7)?,
        })
    })?.collect::<Result<Vec<_>>>()?;

    Ok(books)
}

/// Get a book by its ID
pub fn get_book_by_id(id: &str) -> Result<Option<Book>> {
    let conn = init_db()?;
    let mut stmt = conn.prepare(
        "SELECT id, title, path, format, added_at, last_read_at, last_position, tags FROM books WHERE id = ?"
    )?;

    let mut books = stmt.query_map([id], |row| {
        Ok(Book {
            id: row.get(0)?,
            title: row.get(1)?,
            path: row.get(2)?,
            format: row.get(3)?,
            added_at: row.get(4)?,
            last_read_at: row.get(5)?,
            last_position: row.get(6)?,
            tags: row.get(7)?,
        })
    })?;

    match books.next() {
        Some(result) => Ok(Some(result?)),
        None => Ok(None),
    }
}

/// Update the reading position of a book
pub fn update_book_position(id: &str, position: i64) -> Result<()> {
    let conn = init_db()?;
    let now = chrono::Utc::now().timestamp();

    conn.execute(
        "UPDATE books SET last_position = ?, last_read_at = ? WHERE id = ?",
        (position, now, id),
    )?;

    Ok(())
}

// Stock CRUD functions

/// Add a new stock
pub fn add_stock(code: &str, name: &str) -> Result<()> {
    let conn = init_db()?;
    let id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO stocks (id, code, name) VALUES (?, ?, ?)",
        (&id, code, name),
    )?;

    Ok(())
}

/// Get all stocks
pub fn get_all_stocks() -> Result<Vec<Stock>> {
    let conn = init_db()?;
    let mut stmt = conn.prepare("SELECT id, code, name FROM stocks ORDER BY code")?;

    let stocks = stmt.query_map([], |row| {
        Ok(Stock {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
        })
    })?.collect::<Result<Vec<_>>>()?;

    Ok(stocks)
}

/// Delete a stock by ID
pub fn delete_stock(id: &str) -> Result<()> {
    let conn = init_db()?;
    conn.execute("DELETE FROM stocks WHERE id = ?", [id])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_db_path() {
        let path = get_db_path();
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
        }
    }

    #[test]
    fn test_book_crud() {
        // This test uses a temporary database path to avoid conflicts
        let temp_path = std::env::temp_dir().join("mofish_test.db");
        std::fs::remove_file(&temp_path).ok();

        let conn = Connection::open(&temp_path).unwrap();

        // Create tables manually for test
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
        ).unwrap();

        // Insert a test book
        let test_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();
        conn.execute(
            "INSERT INTO books (id, title, path, format, added_at, last_position, tags) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (&test_id, "Test Book", "/path/to/book.epub", "epub", now, 0, "[]"),
        ).unwrap();

        // Verify it was inserted
        let mut stmt = conn.prepare("SELECT title FROM books WHERE id = ?").unwrap();
        let title: String = stmt.query_row([&test_id], |row| row.get(0)).unwrap();
        assert_eq!(title, "Test Book");

        // Clean up
        std::fs::remove_file(&temp_path).ok();
    }

    #[test]
    fn test_stock_crud() {
        let temp_path = std::env::temp_dir().join("mofish_stock_test.db");
        std::fs::remove_file(&temp_path).ok();

        let conn = Connection::open(&temp_path).unwrap();

        // Create stocks table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS stocks (
                id TEXT PRIMARY KEY,
                code TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL
            )",
            [],
        ).unwrap();

        // Insert a test stock
        let stock_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO stocks (id, code, name) VALUES (?, ?, ?)",
            (&stock_id, "600000", "Shanghai Stock"),
        ).unwrap();

        // Verify it was inserted
        let mut stmt = conn.prepare("SELECT name FROM stocks WHERE code = ?").unwrap();
        let name: String = stmt.query_row(["600000"], |row| row.get(0)).unwrap();
        assert_eq!(name, "Shanghai Stock");

        // Clean up
        std::fs::remove_file(&temp_path).ok();
    }
}
