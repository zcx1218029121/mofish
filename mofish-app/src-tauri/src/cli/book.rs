use crate::db::{self, Book};
use colored::Colorize;

pub fn list_books() {
    let books = db::get_all_books().unwrap_or_else(|e| {
        eprintln!("Error: Failed to fetch books: {}", e);
        vec![]
    });

    if books.is_empty() {
        println!("{}", "No books found. Add books via Bubble mode.".dimmed());
        return;
    }

    println!("{}", "\n📚 My Book Library\n".bold());
    println!("{}", format!("{:.<40} {:>8} {:>12}",
        "Title", "Progress", "Percent").dimmed());
    println!("{}", "-".repeat(65).dimmed());

    for book in books {
        let progress = calculate_progress(&book);
        let progress_bar = draw_progress_bar(progress);
        let title = if book.title.len() > 36 {
            format!("{}...", &book.title[..33])
        } else {
            book.title.clone()
        };

        println!("📚 {:.<36} [{}] {}",
            title.green(),
            format!("{:>3}%", (progress * 100.0) as i32).yellow(),
            progress_bar
        );
    }
    println!();
}

pub fn search_books(keyword: &str) {
    let books = db::search_books(keyword).unwrap_or_else(|e| {
        eprintln!("Error: Failed to search books: {}", e);
        vec![]
    });

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
        // Approximation: assuming file size of 100000 bytes when unknown.
        // This gives a rough progress estimate based on last read position.
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Book;

    fn create_test_book(last_position: i64) -> Book {
        Book {
            id: "test-id".to_string(),
            title: "Test Book".to_string(),
            path: "/test/path".to_string(),
            format: "epub".to_string(),
            added_at: 0,
            last_read_at: None,
            last_position,
            tags: "[]".to_string(),
        }
    }

    #[test]
    fn test_calculate_progress_zero_position() {
        let book = create_test_book(0);
        assert_eq!(calculate_progress(&book), 0.0);
    }

    #[test]
    fn test_calculate_progress_partial_position() {
        let book = create_test_book(50000);
        assert_eq!(calculate_progress(&book), 0.5);
    }

    #[test]
    fn test_calculate_progress_full_position() {
        let book = create_test_book(100000);
        assert_eq!(calculate_progress(&book), 1.0);
    }

    #[test]
    fn test_calculate_progress_clamps_above_max() {
        // Position above the assumed max should be clamped to 1.0
        let book = create_test_book(150000);
        assert_eq!(calculate_progress(&book), 1.0);
    }

    #[test]
    fn test_draw_progress_bar_empty() {
        let bar = draw_progress_bar(0.0);
        assert_eq!(bar, "░░░░░░░░░░");
    }

    #[test]
    fn test_draw_progress_bar_full() {
        let bar = draw_progress_bar(1.0);
        assert_eq!(bar, "██████████");
    }

    #[test]
    fn test_draw_progress_bar_half() {
        let bar = draw_progress_bar(0.5);
        // 5 filled, 5 empty
        assert!(bar.contains("█████"));
        assert!(bar.contains("░░░░░"));
    }

    #[test]
    fn test_draw_progress_bar_partial_filled() {
        let bar = draw_progress_bar(0.3);
        // Should have 3 filled blocks (0.3 * 10 = 3)
        assert!(bar.starts_with("███"));
    }
}
