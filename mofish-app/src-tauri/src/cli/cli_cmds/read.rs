use crate::config::{self, CliConfig};
use crate::db;
use colored::Colorize;
use std::io::{self, BufRead};
use std::fs::File;
use std::path::Path;

pub fn read_book(book_id: &str) {
    let book = match db::get_book_by_id(book_id) {
        Ok(Some(b)) => b,
        Ok(None) => {
            println!("{}", "Book not found".red());
            return;
        }
        Err(e) => {
            println!("{} Error: {}", "✗".red(), e);
            return;
        }
    };

    let path = Path::new(&book.path);
    if !path.exists() {
        println!("{} Book file not found: {}", "✗".red(), book.path);
        return;
    }

    let file = match File::open(path) {
        Ok(f) => f,
        Err(e) => {
            println!("{} Failed to open file: {}", "✗".red(), e);
            return;
        }
    };

    let mut skipped_lines = 0;
    let lines: Vec<String> = io::BufReader::new(file)
        .lines()
        .filter_map(|l| match l {
            Ok(line) => Some(line),
            Err(e) => {
                skipped_lines += 1;
                eprintln!("Warning: Skipping corrupted line: {}", e);
                None
            }
        })
        .collect();
    if skipped_lines > 0 {
        eprintln!("Warning: {} lines skipped due to read errors", skipped_lines);
    }

    let total_lines = lines.len();
    let mut config = config::load_config().unwrap_or_else(|_| CliConfig::default());
    let mut page_size = config.page_size;
    let mut current_page = calculate_start_page(book.last_position, page_size, total_lines);

    loop {
        display_page(&lines, current_page, page_size, total_lines, &book.title);

        let input = get_input();
        match input.as_str() {
            "j" | "↓" | " " | "enter" => {
                if current_page < (total_lines / page_size) {
                    current_page += 1;
                }
            }
            "k" | "↑" => {
                if current_page > 0 {
                    current_page -= 1;
                }
            }
            "h" => {
                if page_size > 20 {
                    page_size -= 5;
                    println!("{}", format!("Page size: {} lines", page_size).dimmed());
                }
            }
            "l" => {
                if page_size < 60 {
                    page_size += 5;
                    println!("{}", format!("Page size: {} lines", page_size).dimmed());
                }
            }
            "q" | "esc" => {
                // 保存阅读位置
                let position = current_page * page_size;
                if let Err(e) = db::update_book_position(book_id, position as i64) {
                    eprintln!("Warning: Failed to save reading position: {}", e);
                }
                println!("{}", "\n👋 Exiting reader. Position saved.\n".dimmed());
                break;
            }
            _ => {}
        }
    }
}

fn calculate_start_page(position: i64, page_size: usize, total_lines: usize) -> usize {
    if total_lines == 0 {
        return 0;
    }
    ((position as usize) / page_size).min(total_lines / page_size)
}

fn display_page(lines: &[String], page: usize, page_size: usize, total_lines: usize, title: &str) {
    clear_screen();
    println!("{}", format!("📖 {}\n", title).bold());
    println!("{}", format!("[Page {}/{}] (j/k: prev/next, h/l: +/-5 lines, q: quit)\n",
        page + 1,
        (total_lines / page_size) + 1
    ).dimmed());

    let start = page * page_size;
    let end = (start + page_size).min(lines.len());

    for (i, line) in lines[start..end].iter().enumerate() {
        println!("{:>4}  {}", start + i + 1, line);
    }

    // 绘制进度条
    let progress = (end as f64 / total_lines as f64).min(1.0);
    let filled = (progress * 40.0).round() as usize;
    println!("\n{}", format!(
        "{}{} {:>3}%",
        "█".repeat(filled).cyan(),
        "░".repeat(40 - filled).black(),
        (progress * 100.0) as i32
    ));
}

fn clear_screen() {
    print!("\x1B[2J\x1B[H");
    io::Write::flush(&mut io::stdout()).ok();
}

fn get_input() -> String {
    let stdin = io::stdin();
    let mut handle = stdin.lock();
    let mut input = String::new();
    if let Err(e) = handle.read_line(&mut input) {
        eprintln!("Warning: Failed to read input: {}", e);
    }
    input.trim().to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::calculate_start_page;

    #[test]
    fn test_calculate_start_page_basic() {
        // position 0, page_size 10, total_lines 100 -> page 0
        assert_eq!(calculate_start_page(0, 10, 100), 0);
    }

    #[test]
    fn test_calculate_start_page_mid_book() {
        // position 50, page_size 10, total_lines 100 -> page 5
        assert_eq!(calculate_start_page(50, 10, 100), 5);
    }

    #[test]
    fn test_calculate_start_page_exceeds_total() {
        // position 150, page_size 10, total_lines 100 -> page 10 (capped at total_lines/page_size)
        assert_eq!(calculate_start_page(150, 10, 100), 10);
    }

    #[test]
    fn test_calculate_start_page_zero_total_lines() {
        // total_lines 0 should return 0 regardless of position
        assert_eq!(calculate_start_page(0, 10, 0), 0);
        assert_eq!(calculate_start_page(100, 10, 0), 0);
    }

    #[test]
    fn test_calculate_start_page_exact_page_boundary() {
        // position 90, page_size 10, total_lines 100 -> page 9
        assert_eq!(calculate_start_page(90, 10, 100), 9);
    }

    #[test]
    fn test_calculate_start_page_small_page_size() {
        // position 5, page_size 2, total_lines 20 -> page 2
        assert_eq!(calculate_start_page(5, 2, 20), 2);
    }

    #[test]
    fn test_calculate_start_page_large_page_size() {
        // position 50, page_size 50, total_lines 200 -> page 1
        assert_eq!(calculate_start_page(50, 50, 200), 1);
    }
}