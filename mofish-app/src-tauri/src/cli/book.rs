use crate::db::{self, Book};
use colored::Colorize;

pub fn list_books() {
    let books = db::get_all_books().expect("Failed to fetch books");

    if books.is_empty() {
        println!("{}", "No books found. Add books via Bubble mode.".dimmed());
        return;
    }

    println!("{}", "\n📚 My Book Library\n".bold());
    println!("{}", format!("{:.<40} {:>8} {:>12}  {}",
        "Title", "Progress", "Percent", "Author").dimmed());
    println!("{}", "-".repeat(75).dimmed());

    for book in books {
        let progress = calculate_progress(&book);
        let progress_bar = draw_progress_bar(progress);
        let title = if book.title.len() > 36 {
            format!("{}...", &book.title[..33])
        } else {
            book.title.clone()
        };

        let author = extract_author(&book.tags);

        println!("📚 {:.<36} [{}] {}  {}",
            title.green(),
            format!("{:>3}%", (progress * 100.0) as i32).yellow(),
            progress_bar,
            author.white().dimmed()
        );
    }
    println!();
}

pub fn search_books(keyword: &str) {
    let books = db::search_books(keyword).expect("Failed to search books");

    if books.is_empty() {
        println!("{}", format!("No books found matching '{}'", keyword).dimmed());
        return;
    }

    println!("{}", format!("\n🔍 Search results for '{}'\n", keyword).bold());

    for book in books {
        let progress = calculate_progress(&book);
        let progress_bar = draw_progress_bar(progress);

        println!("📚 {} [{}] {}",
            book.title.green(),
            format!("{:>3}%", (progress * 100.0) as i32).yellow(),
            progress_bar
        );
    }
    println!();
}

fn calculate_progress(book: &Book) -> f64 {
    if book.last_position == 0 {
        0.0
    } else {
        // 简化：假设文件大小未知，用 last_position 代表进度
        (book.last_position as f64 / 100000.0).min(1.0)
    }
}

fn draw_progress_bar(progress: f64) -> String {
    let filled = (progress * 10.0).round() as usize;
    let empty = 10 - filled;
    format!("{}{}",
        "█".repeat(filled).cyan(),
        "░".repeat(empty).black()
    )
}

fn extract_author(tags: &str) -> String {
    // 简化实现
    "Unknown".to_string()
}