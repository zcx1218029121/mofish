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

    let lines: Vec<String> = io::BufReader::new(file)
        .lines()
        .filter_map(|l| l.ok())
        .collect();

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
                let _ = db::update_book_position(book_id, position as i64);
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
    handle.read_line(&mut input).ok();
    input.trim().to_lowercase()
}