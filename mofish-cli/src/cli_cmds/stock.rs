use mofish_core::db;

/// Stock management commands
#[derive(clap::Subcommand)]
pub enum StockAction {
    /// Add a stock to tracking list
    Add { code: String },
    /// List all tracked stocks
    List,
    /// Delete a stock from tracking list
    Delete { id: String },
}

pub fn handle(action: StockAction) {
    match action {
        StockAction::Add { code } => {
            if let Err(e) = add_stock(&code) {
                println!("Error: {}", e);
            }
        }
        StockAction::List => {
            if let Err(e) = list_stocks() {
                eprintln!("Error: {}", e);
            }
        }
        StockAction::Delete { id } => {
            if let Err(e) = delete_stock(&id) {
                println!("Error: {}", e);
            } else {
                println!("✓ Stock deleted");
            }
        }
    }
}

/// Validates a stock code.
fn validate_stock_code(code: &str) -> Result<(), String> {
    if code.is_empty() {
        return Err("Stock code cannot be empty".to_string());
    }
    if code.len() > 10 {
        return Err("Stock code cannot exceed 10 characters".to_string());
    }
    if !code.chars().all(|c| c.is_alphanumeric()) {
        return Err("Stock code must be alphanumeric".to_string());
    }
    Ok(())
}

/// Adds a stock to the tracking list.
fn add_stock(code: &str) -> Result<(), String> {
    validate_stock_code(code)
        .map_err(|e| e.to_string())?;

    let name = format!("Stock {}", code);

    db::add_stock(code, &name)
        .map_err(|e| format!("Failed to add stock: {}", e))?;
    println!("✓ Added: {} ({})", name, code);
    Ok(())
}

/// Lists all stocks in the tracking list.
fn list_stocks() -> Result<(), String> {
    let stocks = db::get_all_stocks()
        .map_err(|e| format!("Failed to fetch stocks: {}", e))?;

    if stocks.is_empty() {
        println!("No stocks in your list. Add stocks with 'mofish stock add <code>'");
        return Ok(());
    }

    println!("\n📈 My Stock List\n");
    println!("{:.<40} {:>10}", "Name", "Code");
    println!("{}", "-".repeat(55));

    for stock in stocks {
        println!("{:<40} {:>10}", stock.name, stock.code);
    }
    println!();
    Ok(())
}

/// Delete a stock by ID
fn delete_stock(id: &str) -> Result<(), String> {
    db::delete_stock(id)
        .map_err(|e| format!("Failed to delete stock: {}", e))
}
