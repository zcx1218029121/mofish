use crate::db;
use colored::Colorize;

/// Validates a stock code.
/// Returns Ok(()) if valid, or an error message if invalid.
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
///
/// # Arguments
/// * `code` - The stock code (e.g., "600000" for Shanghai, "000001" for Shenzhen)
///
/// # Errors
/// Returns an error message if:
/// - The stock code is empty
/// - The stock code exceeds 10 characters
/// - The stock code contains non-alphanumeric characters
pub fn add_stock(code: &str) -> Result<(), String> {
    validate_stock_code(code)
        .map_err(|e| e.to_string())?;

    // Simplified: only add to database, name is placeholder
    // In production, should fetch stock name from Sina Finance API
    let name = format!("Stock {}", code);

    db::add_stock(code, &name)
        .map_err(|e| format!("Failed to add stock: {}", e))?;
    Ok(())
}

/// Lists all stocks in the tracking list.
pub fn list_stocks() -> Result<(), String> {
    let stocks = db::get_all_stocks()
        .map_err(|e| format!("Failed to fetch stocks: {}", e))?;

    if stocks.is_empty() {
        println!("{}", "No stocks in your list. Add stocks with 'mofish cli stock add <code>'".dimmed());
        return Ok(());
    }

    println!("{}", "\n📈 My Stock List\n".bold());
    println!("{}", format!("{:.<20} {:>10} {:>12} {:>10}  {}",
        "Name", "Code", "Price", "Change", "Trend").dimmed());
    println!("{}", "-".repeat(65).dimmed());

    for stock in stocks {
        // Simplified: mock price/change data
        // In production, should fetch real data from Sina Finance API
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
    Ok(())
}

/// Gets a stock quote (price, change, change percent).
///
/// # Arguments
/// * `code` - The stock code
///
/// # Returns
/// A tuple of (price, change, change_percent)
///
/// # Notes
/// Currently returns mock data. In production, this should call the
/// Sina Finance API to get real-time quotes.
///
/// Magic numbers:
/// - 100.0: Mock base price (reasonable for Chinese stocks)
/// - 1.5: Mock absolute change value
/// - 1.52: Mock change percentage (1.52%)
fn get_stock_quote(code: &str) -> (f64, f64, f64) {
    // TODO: Fetch real data from Sina Finance API
    // For now, return mock data with realistic values
    (100.0, 1.5, 1.52)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_stock_code_valid() {
        assert!(validate_stock_code("600000").is_ok());
        assert!(validate_stock_code("000001").is_ok());
        assert!(validate_stock_code("aapl").is_ok());
        assert!(validate_stock_code("12345").is_ok());
    }

    #[test]
    fn test_validate_stock_code_empty() {
        let result = validate_stock_code("");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Stock code cannot be empty");
    }

    #[test]
    fn test_validate_stock_code_too_long() {
        let result = validate_stock_code("12345678901"); // 11 chars
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Stock code cannot exceed 10 characters");
    }

    #[test]
    fn test_validate_stock_code_invalid_chars() {
        let result = validate_stock_code("600-000");
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Stock code must be alphanumeric");

        let result2 = validate_stock_code("600 000");
        assert!(result2.is_err());

        let result3 = validate_stock_code("ABC@123");
        assert!(result3.is_err());
    }

    #[test]
    fn test_get_stock_quote() {
        let (price, change, change_pct) = get_stock_quote("600000");
        assert_eq!(price, 100.0);
        assert_eq!(change, 1.5);
        assert_eq!(change_pct, 1.52);
    }
}
