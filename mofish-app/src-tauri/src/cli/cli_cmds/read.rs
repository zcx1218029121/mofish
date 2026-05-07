use mofish_core::config::{self, CliConfig};
use mofish_core::db;
use colored::Colorize;
use std::io::{self, Read};
use std::fs::File;
use std::path::Path;
use encoding_rs::*;
use termios::{Termios, TCSANOW, TCSAFLUSH, tcsetattr};

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

    // Read file bytes
    let mut file_content = Vec::new();
    let mut reader = io::BufReader::new(file);
    if let Err(e) = reader.read_to_end(&mut file_content) {
        println!("{} Failed to read file: {}", "✗".red(), e);
        return;
    }

    // Try UTF-8 first, fall back to GBK/Legacy for Chinese files
    let text = if let Ok(s) = std::str::from_utf8(&file_content) {
        s.to_string()
    } else {
        // Try GBK (common for Chinese TXT files)
        let (decoded, _, had_errors) = GBK.decode(&file_content);
        if had_errors {
            // Last resort: lossily decode as Latin1, replacing invalid bytes
            let (fallback, _, _) = WINDOWS_1252.decode(&file_content);
            fallback.into_owned()
        } else {
            decoded.into_owned()
        }
    };

    // Normalize line endings (CRLF -> LF, CR -> LF)
    let normalized = text.replace("\r\n", "\n").replace('\r', "\n");

    // Remove BOM if present
    let text = if normalized.starts_with('\u{feff}') {
        &normalized[3..]
    } else {
        &normalized
    };

    let lines: Vec<&str> = text.lines().collect();
    let total_lines = lines.len();

    if total_lines == 0 {
        println!("{}", "Book is empty".yellow());
        return;
    }

    let config = config::load_config().unwrap_or_else(|_| CliConfig::default());
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

fn display_page(lines: &[&str], page: usize, page_size: usize, total_lines: usize, title: &str) {
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
    let stdin_fd = 0; // stdin

    // Save original terminal attributes
    let orig_termios = Termios::from_fd(stdin_fd).ok();

    // Set raw mode
    if let Ok(mut termios) = Termios::from_fd(stdin_fd) {
        termios.c_lflag &= !(termios::ICANON | termios::ECHO); // Disable canonical mode and echo
        termios.c_cc[termios::VMIN] = 1;
        termios.c_cc[termios::VTIME] = 0;
        let _ = tcsetattr(stdin_fd, TCSANOW, &termios);
    }

    // Read single character
    let mut buf = [0u8; 1];
    let input = if io::stdin().read(&mut buf).is_ok() {
        // Handle escape sequences (arrow keys)
        match buf[0] {
            27 => { // ESC
                // Peek next char to detect arrow keys
                let mut next_buf = [0u8; 1];
                if io::stdin().read(&mut next_buf).is_ok() {
                    match next_buf[0] {
                        91 => { // '['
                            let mut third_buf = [0u8; 1];
                            if io::stdin().read(&mut third_buf).is_ok() {
                                match third_buf[0] {
                                    65 => "k".to_string(), // Up arrow
                                    66 => "j".to_string(), // Down arrow
                                    _ => "esc".to_string(),
                                }
                            } else {
                                "esc".to_string()
                            }
                        }
                        _ => "esc".to_string(),
                    }
                } else {
                    "esc".to_string()
                }
            }
            b'j' | b'J' => "j".to_string(),
            b'k' | b'K' => "k".to_string(),
            b'h' | b'H' => "h".to_string(),
            b'l' | b'L' => "l".to_string(),
            b'q' | b'Q' => "q".to_string(),
            b' ' => " ".to_string(),
            10 => "enter".to_string(),
            _ => format!("{}", buf[0] as char),
        }
    } else {
        String::new()
    };

    // Restore original terminal attributes
    if let Some(orig) = orig_termios {
        let _ = tcsetattr(stdin_fd, TCSAFLUSH, &orig);
    }

    input.to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::calculate_start_page;

    #[test]
    fn test_calculate_start_page_basic() {
        assert_eq!(calculate_start_page(0, 10, 100), 0);
    }

    #[test]
    fn test_calculate_start_page_mid_book() {
        assert_eq!(calculate_start_page(50, 10, 100), 5);
    }

    #[test]
    fn test_calculate_start_page_exceeds_total() {
        assert_eq!(calculate_start_page(150, 10, 100), 10);
    }

    #[test]
    fn test_calculate_start_page_zero_total_lines() {
        assert_eq!(calculate_start_page(0, 10, 0), 0);
        assert_eq!(calculate_start_page(100, 10, 0), 0);
    }
}
