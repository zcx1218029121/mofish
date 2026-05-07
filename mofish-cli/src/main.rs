use clap::{Parser, Subcommand};

mod cli;
mod tui;
mod cli_cmds;

use cli_cmds::{book, read, stock};

#[derive(Parser)]
#[command(name = "mofish")]
#[command(version = "0.1.0")]
#[command(about = "🐟 摸鱼 - 摸鱼时间管理器", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// 启动交互式 TUI（Claude Code 风格）
    Tui,
    /// 书籍管理
    Book {
        #[command(subcommand)]
        action: book::BookAction,
    },
    /// 股票管理
    Stock {
        #[command(subcommand)]
        action: stock::StockAction,
    },
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Some(Commands::Tui) => {
            tui::run_tui();
        }
        Some(Commands::Book { action }) => {
            book::handle(action);
        }
        Some(Commands::Stock { action }) => {
            stock::handle(action);
        }
        None => {
            // No subcommand - launch TUI by default
            tui::run_tui();
        }
    }
}
