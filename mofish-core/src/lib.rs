//! mofish-core - Core library for mofish
//! 
//! Contains shared functionality: config, database, models

pub mod config;
pub mod db;

pub use config::{CliConfig, ConfigError, load_config, save_config};
pub use db::{Book, Stock, get_all_books, search_books, get_book_by_id, 
             update_book_position, add_book, book_exists_by_path,
             add_stock, get_all_stocks, delete_stock};
