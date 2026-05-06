# CLI 模式实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 CLI 模式，支持 `mofish cli book list/search/read` 和 `mofish cli stock add/list` 命令

**Architecture:**
- `main.rs` 根据参数决定启动 Tauri（Bubble 模式）或 CLI 模式
- CLI 模式使用 `clap` 解析子命令，直接调用 Rust 业务逻辑
- 数据库访问使用 `rusqlite`，与前端 `db.ts` 共享同一个 SQLite 文件
- 输出使用 `colored` crate 实现 ANSI 颜色

**Tech Stack:** Rust, clap, rusqlite, colored

---

## 文件结构

```
src-tauri/
├── Cargo.toml              # 新增: clap, rusqlite, colored 依赖
├── src/
│   ├── main.rs             # 修改: CLI 参数路由
│   ├── lib.rs              # 保留: Tauri 逻辑
│   ├── cli.rs              # 新增: CLI 命令定义 (clap)
│   ├── db.rs               # 新增: Rust SQLite 操作
│   ├── cli/
│   │   ├── mod.rs          # 新增: CLI 子模块入口
│   │   ├── book.rs         # 新增: book 子命令
│   │   ├── stock.rs        # 新增: stock 子命令
│   │   └── read.rs         # 新增: 分页阅读
│   └── config.rs           # 新增: CLI 配置管理
```

---

## Task 1: 添加 Cargo 依赖

**Files:**
- Modify: `mofish-app/src-tauri/Cargo.toml`

- [ ] **Step 1: 添加依赖**

```toml
[dependencies]
# 现有依赖保留...
tauri = { version = "2", features = ["macos-private-api", "tray-icon"] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-global-shortcut = "2"
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# 新增依赖
clap = { version = "4", features = ["derive"] }
colored = "2"
rusqlite = { version = "0.31", features = ["bundled"] }
dirs = "5"
```

- [ ] **Step 2: 验证依赖**

Run: `cd mofish-app/src-tauri && cargo check`
Expected: 无错误（下载和编译依赖）

- [ ] **Step 3: 提交**

```bash
git add mofish-app/src-tauri/Cargo.toml
git commit -m "deps: 添加 CLI 依赖 (clap, colored, rusqlite, dirs)"
```

---

## Task 2: 创建 Rust 数据库模块

**Files:**
- Create: `mofish-app/src-tauri/src/db.rs`

- [ ] **Step 1: 实现 db.rs**

```rust
use rusqlite::{Connection, Result, params};
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
pub struct Tag {
    pub id: String,
    pub name: String,
    pub tag_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bookmark {
    pub id: String,
    pub book_id: String,
    pub position: i64,
    pub note: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stock {
    pub id: String,
    pub code: String,
    pub name: String,
}

fn get_db_path() -> PathBuf {
    let mut path = dirs::home_dir().unwrap_or_default();
    path.push(".mofish");
    std::fs::create_dir_all(&path).ok();
    path.push("mofish.db");
    path
}

pub fn init_db() -> Result<Connection> {
    let conn = Connection::open(get_db_path())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS books (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            path TEXT UNIQUE NOT NULL,
            format TEXT NOT NULL DEFAULT 'txt',
            added_at INTEGER NOT NULL,
            last_read_at INTEGER,
            last_position INTEGER NOT NULL DEFAULT 0,
            tags TEXT DEFAULT '[]'
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            tag_type TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS bookmarks (
            id TEXT PRIMARY KEY,
            book_id TEXT NOT NULL,
            position INTEGER NOT NULL,
            note TEXT DEFAULT '',
            created_at INTEGER NOT NULL,
            FOREIGN KEY(book_id) REFERENCES books(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS stocks (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL
        )",
        [],
    )?;

    Ok(conn)
}

pub fn get_all_books() -> Result<Vec<Book>> {
    let conn = init_db()?;
    let mut stmt = conn.prepare(
        "SELECT id, title, path, format, added_at, last_read_at, last_position, tags FROM books ORDER BY last_read_at DESC NULLS LAST, title"
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

pub fn search_books(keyword: &str) -> Result<Vec<Book>> {
    let conn = init_db()?;
    let pattern = format!("%{}%", keyword);

    // 支持拼音首字母搜索（简化：只搜索标题）
    let mut stmt = conn.prepare(
        "SELECT id, title, path, format, added_at, last_read_at, last_position, tags
         FROM books
         WHERE title LIKE ?1 OR tags LIKE ?1
         ORDER BY last_read_at DESC NULLS LAST, title"
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

pub fn get_book_by_id(id: &str) -> Result<Option<Book>> {
    let conn = init_db()?;
    let mut stmt = conn.prepare(
        "SELECT id, title, path, format, added_at, last_read_at, last_position, tags FROM books WHERE id = ?1"
    )?;

    let mut rows = stmt.query([id])?;
    if let Some(row) = rows.next()? {
        Ok(Some(Book {
            id: row.get(0)?,
            title: row.get(1)?,
            path: row.get(2)?,
            format: row.get(3)?,
            added_at: row.get(4)?,
            last_read_at: row.get(5)?,
            last_position: row.get(6)?,
            tags: row.get(7)?,
        }))
    } else {
        Ok(None)
    }
}

pub fn update_book_position(id: &str, position: i64) -> Result<()> {
    let conn = init_db()?;
    conn.execute(
        "UPDATE books SET last_position = ?1, last_read_at = ?2 WHERE id = ?3",
        params![position, chrono::Utc::now().timestamp(), id],
    )?;
    Ok(())
}

pub fn add_stock(code: &str, name: &str) -> Result<()> {
    let conn = init_db()?;
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT OR IGNORE INTO stocks (id, code, name) VALUES (?1, ?2, ?3)",
        params![id, code, name],
    )?;
    Ok(())
}

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

pub fn delete_stock(id: &str) -> Result<()> {
    let conn = init_db()?;
    conn.execute("DELETE FROM stocks WHERE id = ?1", [id])?;
    Ok(())
}
```

- [ ] **Step 2: 添加 uuid 和 chrono 依赖**

Run: `cargo add uuid chrono` in src-tauri directory

- [ ] **Step 3: 验证编译**

Run: `cd mofish-app/src-tauri && cargo check --lib`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add mofish-app/src-tauri/src/db.rs mofish-app/src-tauri/Cargo.lock
git commit -m "feat(cli): 添加 Rust SQLite 数据库模块"
```

---

## Task 3: 创建配置管理模块

**Files:**
- Create: `mofish-app/src-tauri/src/config.rs`

- [ ] **Step 1: 实现 config.rs**

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliConfig {
    pub page_size: usize,
}

impl Default for CliConfig {
    fn default() -> Self {
        CliConfig {
            page_size: 30,
        }
    }
}

fn get_config_path() -> PathBuf {
    let mut path = dirs::home_dir().unwrap_or_default();
    path.push(".mofish");
    fs::create_dir_all(&path).ok();
    path.push("config.json");
    path
}

pub fn load_config() -> CliConfig {
    let path = get_config_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str(&content) {
                return config;
            }
        }
    }
    CliConfig::default()
}

pub fn save_config(config: &CliConfig) -> std::io::Result<()> {
    let path = get_config_path();
    let content = serde_json::to_string_pretty(config)?;
    fs::write(path, content)
}
```

- [ ] **Step 2: 验证编译**

Run: `cd mofish-app/src-tauri && cargo check --lib`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add mofish-app/src-tauri/src/config.rs
git commit -m "feat(cli): 添加 CLI 配置管理模块"
```

---

## Task 4: 创建 CLI book 子命令

**Files:**
- Create: `mofish-app/src-tauri/src/cli/mod.rs`
- Create: `mofish-app/src-tauri/src/cli/book.rs`

- [ ] **Step 1: 创建 cli/mod.rs**

```rust
pub mod book;
pub mod stock;
pub mod read;
```

- [ ] **Step 2: 创建 cli/book.rs**

```rust
use crate::db::{self, Book};
use colored::{Color, Colorize};

pub fn list_books() {
    let books = db::get_all_books().expect("Failed to fetch books");

    if books.is_empty() {
        println!("{}", "No books found. Add books via Bubble mode.".dim());
        return;
    }

    println!("{}", "\n📚 My Book Library\n".bold());
    println!("{}", format!("{:.<40} {:>8} {:>12}  {}",
        "Title", "Progress", "Percent", "Author").dim());
    println!("{}", "-".repeat(75).dim());

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
            author.white().dim()
        );
    }
    println!();
}

pub fn search_books(keyword: &str) {
    let books = db::search_books(keyword).expect("Failed to search books");

    if books.is_empty() {
        println!("{}", format!("No books found matching '{}'", keyword).dim());
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
        // 实际应该读取文件计算
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
    // 简化实现，实际应该从标签中提取或从文件读取
    // 这里返回 tags 中非 status/genre 的标签作为作者/分类
    "Unknown".to_string()
}
```

- [ ] **Step 3: 验证编译**

Run: `cd mofish-app/src-tauri && cargo check --lib`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add mofish-app/src-tauri/src/cli/mod.rs mofish-app/src-tauri/src/cli/book.rs
git commit -m "feat(cli): 添加 book list 和 search 命令"
```

---

## Task 5: 创建 CLI stock 子命令

**Files:**
- Create: `mofish-app/src-tauri/src/cli/stock.rs`

- [ ] **Step 1: 创建 cli/stock.rs**

```rust
use crate::db;
use colored::Colorize;

pub fn add_stock(code: &str) {
    // 简化实现：只添加到数据库，名字留空
    // 实际应该调用新浪财经 API 获取股票名称
    let name = format!("Stock {}", code);

    match db::add_stock(code, &name) {
        Ok(_) => println!("{} Added: {} ({})", "✓".green(), name, code),
        Err(e) => println!("{} Failed to add stock: {}", "✗".red(), e),
    }
}

pub fn list_stocks() {
    let stocks = db::get_all_stocks().expect("Failed to fetch stocks");

    if stocks.is_empty() {
        println!("{}", "No stocks in your list. Add stocks with 'mofish cli stock add <code>'".dim());
        return;
    }

    println!("{}", "\n📈 My Stock List\n".bold());
    println!("{}", format!("{:.<20} {:>10} {:>12} {:>10}  {}",
        "Name", "Code", "Price", "Change", "Trend").dim());
    println!("{}", "-".repeat(65).dim());

    for stock in stocks {
        // 简化：模拟涨跌幅数据
        // 实际应该调用新浪财经 API
        let (price, change, change_pct) = get_stock_quote(&stock.code);

        let trend = if change >= 0.0 {
            format!("▲ +{} (+{}%)", change, change_pct).green()
        } else {
            format!("▼ {} ({}%)", change, change_pct).red()
        };

        println!("{:<20} {:>10} {:>12.2} {:>12.2}  {}",
            stock.name.white(),
            stock.code.yellow(),
            price,
            change.abs(),
            trend
        );
    }
    println!();
}

fn get_stock_quote(code: &str) -> (f64, f64, f64) {
    // TODO: 调用新浪财经 API 获取真实数据
    // 暂时返回模拟数据
    (100.0, 1.5, 1.52)
}
```

- [ ] **Step 2: 验证编译**

Run: `cd mofish-app/src-tauri && cargo check --lib`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add mofish-app/src-tauri/src/cli/stock.rs
git commit -m "feat(cli): 添加 stock add 和 list 命令"
```

---

## Task 6: 创建分页阅读模块

**Files:**
- Create: `mofish-app/src-tauri/src/cli/read.rs`

- [ ] **Step 1: 创建 cli/read.rs**

```rust
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
    let mut config = config::load_config();
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
                    println!("{}", format!("Page size: {} lines", page_size).dim());
                }
            }
            "l" => {
                if page_size < 60 {
                    page_size += 5;
                    println!("{}", format!("Page size: {} lines", page_size).dim());
                }
            }
            "q" | "esc" => {
                // 保存阅读位置
                let position = current_page * page_size;
                let _ = db::update_book_position(book_id, position as i64);
                println!("{}", "\n👋 Exiting reader. Position saved.\n".dim());
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
    ).dim());

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

    // 设置非阻塞模式或等待输入
    // 简化：使用同步读取
    handle.read_line(&mut input).ok();
    input.trim().to_lowercase()
}
```

- [ ] **Step 2: 验证编译**

Run: `cd mofish-app/src-tauri && cargo check --lib`
Expected: 无错误（可能有未使用函数警告）

- [ ] **Step 3: 提交**

```bash
git add mofish-app/src-tauri/src/cli/read.rs
git commit -m "feat(cli): 添加分页阅读模块"
```

---

## Task 7: 创建 CLI 命令入口 (clap)

**Files:**
- Create: `mofish-app/src-tauri/src/cli.rs`

- [ ] **Step 1: 创建 cli.rs**

```rust
mod cli;
mod db;
mod config;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "mofish")]
#[command(about = "上班摸鱼工具 - CLI 模式", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// 书籍管理
    book {
        #[command(subcommand)]
        action: BookAction,
    },
    /// 股票管理
    stock {
        #[command(subcommand)]
        action: StockAction,
    },
}

#[derive(Subcommand)]
enum BookAction {
    /// 列出所有书籍
    list,
    /// 搜索书籍
    search {
        /// 搜索关键词
        keyword: String,
    },
    /// 阅读书籍
    read {
        /// 书籍 ID
        book_id: String,
    },
}

#[derive(Subcommand)]
enum StockAction {
    /// 添加自选股
    add {
        /// 股票代码
        code: String,
    },
    /// 列出自选股
    list,
}

pub fn run_cli() {
    let cli = Cli::parse();

    match cli.command {
        Some(Commands::book { action }) => match action {
            BookAction::list => {
                cli::book::list_books();
            }
            BookAction::search { keyword } => {
                cli::book::search_books(&keyword);
            }
            BookAction::read { book_id } => {
                cli::read::read_book(&book_id);
            }
        },
        Some(Commands::stock { action }) => match action {
            StockAction::add { code } => {
                cli::stock::add_stock(&code);
            }
            StockAction::list => {
                cli::stock::list_stocks();
            }
        },
        None => {
            println!("{}", "Use 'mofish cli --help' for more information".dim());
        }
    }
}
```

- [ ] **Step 2: 验证编译**

Run: `cd mofish-app/src-tauri && cargo check`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add mofish-app/src-tauri/src/cli.rs
git commit -m "feat(cli): 添加 CLI 命令入口 (clap)"
```

---

## Task 8: 修改 main.rs 实现双模式路由

**Files:**
- Modify: `mofish-app/src-tauri/src/main.rs`

- [ ] **Step 1: 修改 main.rs**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();

    // 检查是否是 CLI 模式
    if args.len() >= 2 && args[1] == "cli" {
        // CLI 模式：直接运行 CLI 命令
        mofish_lib::run_cli();
    } else {
        // Bubble 模式：启动 Tauri 窗口
        mofish_lib::run();
    }
}
```

- [ ] **Step 2: 在 lib.rs 中添加 run_cli 导出**

修改 `mofish-app/src-tauri/src/lib.rs`，在文件末尾添加：

```rust
pub use crate::cli::run_cli;
```

- [ ] **Step 3: 验证编译**

Run: `cd mofish-app/src-tauri && cargo check`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add mofish-app/src-tauri/src/main.rs mofish-app/src-tauri/src/lib.rs
git commit -m "feat(cli): 实现 main.rs 双模式路由"
```

---

## Task 9: 测试 CLI 模式

- [ ] **Step 1: 构建并测试**

Run: `cd mofish-app && npm run tauri build 2>&1 | tail -20`
Expected: 构建成功，生成二进制文件

- [ ] **Step 2: 测试 help**

Run: `./mofish-app/target/release/mofish cli --help`
Expected: 显示帮助信息

- [ ] **Step 3: 测试 book list**

Run: `./mofish-app/target/release/mofish cli book list`
Expected: 显示书籍列表（空或已有书籍）

- [ ] **Step 4: 测试 stock list**

Run: `./mofish-app/target/release/mofish cli stock list`
Expected: 显示股票列表（空或已有股票）

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: 完成 CLI 模式实现"
```

---

## 验证清单

| 功能 | 测试命令 | 预期结果 |
|------|----------|----------|
| 帮助 | `mofish cli --help` | 显示帮助信息 |
| book list | `mofish cli book list` | 显示书籍列表，带进度条 |
| book search | `mofish cli book search 全职` | 显示搜索结果 |
| stock add | `mofish cli stock add 600519` | 添加成功提示 |
| stock list | `mofish cli stock list` | 显示股票列表，涨绿跌红 |
| book read | `mofish cli book read <id>` | 进入分页阅读 |

---

## 已知限制

1. **股票数据**：当前使用模拟数据，需要接入新浪财经 API 获取真实报价
2. **作者提取**：书籍作者信息从 tags 提取逻辑未完整实现
3. **文件大小**：阅读进度计算使用模拟值，实际应该读取文件计算总行数
4. **Windows 支持**：ANSI 颜色在旧版 Windows 可能不支持
