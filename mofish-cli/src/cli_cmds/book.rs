use mofish_core::{db, Book};
use std::fs;
use std::path::Path;

/// Book management commands
#[derive(clap::Subcommand)]
pub enum BookAction {
    /// Add a book by file path
    Add { path: String },
    /// Scan directory for books
    Scan { path: String },
    /// List all books
    List,
    /// Search books by keyword
    Search { keyword: String },
}

pub fn handle(action: BookAction) {
    match action {
        BookAction::Add { path } => add_book(&path),
        BookAction::Scan { path } => scan_dir(&path),
        BookAction::List => list_books(),
        BookAction::Search { keyword } => search_books(&keyword),
    }
}

/// Add a single book by file path
fn add_book(path: &str) {
    let path_obj = Path::new(path);

    if !path_obj.exists() {
        println!("✗ File not found: {}", path);
        return;
    }

    // Determine format from extension
    let format = if path.ends_with(".txt") {
        "txt"
    } else if path.ends_with(".epub") {
        "epub"
    } else {
        "txt"
    };

    // Extract title from filename
    let title = path_obj
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown")
        .to_string();

    // Check if already exists
    match db::book_exists_by_path(path) {
        Ok(true) => {
            println!("⚠ Book already exists: {}", title);
        }
        Ok(false) => {
            match db::add_book(&title, path, format) {
                Ok(id) => {
                    println!("✓ Added: {} ({})", title, id);
                }
                Err(e) => {
                    println!("✗ Failed to add book: {}", e);
                }
            }
        }
        Err(e) => {
            println!("✗ Error checking book: {}", e);
        }
    }
}

/// Scan a directory and add all TXT/EPUB files
fn scan_dir(dir_path: &str) {
    let path_obj = Path::new(dir_path);

    if !path_obj.exists() || !path_obj.is_dir() {
        println!("✗ Directory not found: {}", dir_path);
        return;
    }

    println!("\n🔍 Scanning directory: {}\n", dir_path);

    let mut added = 0;
    let mut skipped = 0;
    let mut errors = 0;

    // Read directory entries
    let entries = match fs::read_dir(path_obj) {
        Ok(e) => e,
        Err(e) => {
            println!("✗ Failed to read directory: {}", e);
            return;
        }
    };

    for entry in entries.flatten() {
        let file_path = entry.path();

        // Only process .txt and .epub files
        let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("");
        if ext != "txt" && ext != "epub" {
            continue;
        }

        // Skip if not a file
        if !file_path.is_file() {
            continue;
        }

        let path_str = file_path.to_string_lossy().to_string();

        // Check if already exists
        match db::book_exists_by_path(&path_str) {
            Ok(true) => {
                skipped += 1;
            }
            Ok(false) => {
                let format = if ext == "txt" { "txt" } else { "epub" };
                let title = file_path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Unknown")
                    .to_string();

                match db::add_book(&title, &path_str, format) {
                    Ok(_) => {
                        added += 1;
                        println!("  ✓ {}", title);
                    }
                    Err(e) => {
                        errors += 1;
                        println!("  ✗ {} - {}", title, e);
                    }
                }
            }
            Err(e) => {
                errors += 1;
                println!("  ✗ Error: {}", e);
            }
        }
    }

    println!("\n📊 Summary: {} added, {} skipped, {} errors\n", added, skipped, errors);
}

fn list_books() {
    let books = db::get_all_books().unwrap_or_else(|e| {
        eprintln!("Error: Failed to fetch books: {}", e);
        vec![]
    });

    if books.is_empty() {
        println!("No books found. Use 'mofish book add <path>' or 'mofish book scan <dir>' to add books.");
        return;
    }

    println!("\n📚 My Book Library\n");
    println!("{:.<40} {:>8} {:>12}", "Title", "Progress", "Percent");
    println!("{}", "-".repeat(65));

    for book in books {
        let progress = calculate_progress(&book);
        let progress_bar = draw_progress_bar(progress);
        let title = if book.title.len() > 36 {
            format!("{}...", &book.title[..33])
        } else {
            book.title.clone()
        };

        println!("📚 {:.<36} [{:>3}%] {}", title, (progress * 100.0) as i32, progress_bar);
    }
    println!();
}

fn search_books(keyword: &str) {
    let books = db::search_books(keyword).unwrap_or_else(|e| {
        eprintln!("Error: Failed to search books: {}", e);
        vec![]
    });

    if books.is_empty() {
        println!("No books found matching '{}'", keyword);
        return;
    }

    println!("\n🔍 Search results for '{}'\n", keyword);

    for book in books {
        let progress = calculate_progress(&book);
        let progress_bar = draw_progress_bar(progress);

        println!("📚 {} [{:>3}%] {}", book.title, (progress * 100.0) as i32, progress_bar);
    }
    println!();
}

fn calculate_progress(book: &Book) -> f64 {
    if book.last_position == 0 {
        0.0
    } else {
        // Approximation: assuming file size of 100000 bytes when unknown.
        (book.last_position as f64 / 100000.0).min(1.0)
    }
}

fn draw_progress_bar(progress: f64) -> String {
    let filled = (progress * 10.0).round() as usize;
    let empty = 10 - filled;
    format!("{}{}", "█".repeat(filled), "░".repeat(empty))
}
