use clap::{Parser, Subcommand};
use colored::Colorize;

pub mod cli_cmds;
pub mod tui;

// Re-export mofish_core for use by cli_cmds
pub use mofish_core::db;
pub use mofish_core::config;

#[derive(Parser)]
#[command(name = "mofish")]
#[command(about = "上班摸鱼工具 - CLI 模式", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// 启动交互式 TUI 界面
    tui,
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
    /// 添加书籍
    add {
        /// 书籍文件路径
        path: String,
    },
    /// 扫描目录添加书籍
    scan {
        /// 目录路径
        path: String,
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
    let args: Vec<String> = std::env::args().collect();
    let cli = Cli::parse_from(&args[1..]); // Skip ["mofish"] (cli prefix already checked in main)

    match cli.command {
        Some(Commands::tui) => {
            tui::run_tui();
        }
        Some(Commands::book { action }) => match action {
            BookAction::list => {
                cli_cmds::book::list_books();
            }
            BookAction::search { keyword } => {
                cli_cmds::book::search_books(&keyword);
            }
            BookAction::add { path } => {
                cli_cmds::book::add_book(&path);
            }
            BookAction::scan { path } => {
                cli_cmds::book::scan_dir(&path);
            }
            BookAction::read { book_id } => {
                cli_cmds::read::read_book(&book_id);
            }
        },
        Some(Commands::stock { action }) => match action {
            StockAction::add { code } => {
                let _ = cli_cmds::stock::add_stock(&code);
            }
            StockAction::list => {
                let _ = cli_cmds::stock::list_stocks();
            }
        },
        None => {
            println!("{}", "Use 'mofish cli --help' for more information".dimmed());
        }
    }
}