use clap::{Parser, Subcommand};
use colored::Colorize;

pub mod cli_cmds;
pub mod tui;

// Re-export mofish_core for use by cli_cmds

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
    Tui,
    /// 书籍管理
    Book {
        #[command(subcommand)]
        action: BookAction,
    },
    /// 股票管理
    Stock {
        #[command(subcommand)]
        action: StockAction,
    },
}

#[derive(Subcommand)]
enum BookAction {
    /// 列出所有书籍
    List,
    /// 搜索书籍
    Search {
        /// 搜索关键词
        keyword: String,
    },
    /// 添加书籍
    Add {
        /// 书籍文件路径
        path: String,
    },
    /// 扫描目录添加书籍
    Scan {
        /// 目录路径
        path: String,
    },
    /// 阅读书籍
    Read {
        /// 书籍 ID
        book_id: String,
    },
}

#[derive(Subcommand)]
enum StockAction {
    /// 添加自选股
    Add {
        /// 股票代码
        code: String,
    },
    /// 列出自选股
    List,
}

pub fn run_cli() {
    let args: Vec<String> = std::env::args().collect();
    let cli = Cli::parse_from(&args[1..]); // Skip ["mofish"] (cli prefix already checked in main)

    match cli.command {
        Some(Commands::Tui) => {
            tui::run_tui();
        }
        Some(Commands::Book { action }) => match action {
            BookAction::List => {
                cli_cmds::book::list_books();
            }
            BookAction::Search { keyword } => {
                cli_cmds::book::search_books(&keyword);
            }
            BookAction::Add { path } => {
                cli_cmds::book::add_book(&path);
            }
            BookAction::Scan { path } => {
                cli_cmds::book::scan_dir(&path);
            }
            BookAction::Read { book_id } => {
                cli_cmds::read::read_book(&book_id);
            }
        },
        Some(Commands::Stock { action }) => match action {
            StockAction::Add { code } => {
                let _ = cli_cmds::stock::add_stock(&code);
            }
            StockAction::List => {
                let _ = cli_cmds::stock::list_stocks();
            }
        },
        None => {
            println!("{}", "Use 'mofish cli --help' for more information".dimmed());
        }
    }
}
