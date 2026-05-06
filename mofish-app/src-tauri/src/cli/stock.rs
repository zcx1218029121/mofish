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
        println!("{}", "No stocks in your list. Add stocks with 'mofish cli stock add <code>'".dimmed());
        return;
    }

    println!("{}", "\n📈 My Stock List\n".bold());
    println!("{}", format!("{:.<20} {:>10} {:>12} {:>10}  {}",
        "Name", "Code", "Price", "Change", "Trend").dimmed());
    println!("{}", "-".repeat(65).dimmed());

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
