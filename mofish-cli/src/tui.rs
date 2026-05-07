use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style, Stylize},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, ListState, Paragraph, Tabs},
    Terminal,
};

use mofish_core::{db, config, Book, Stock, CliConfig};

/// 标签页枚举
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Tab {
    Books,
    Stocks,
    Settings,
}

impl Tab {
    #[allow(dead_code)]
    fn title(&self) -> &'static str {
        match self {
            Tab::Books => "📚 Books",
            Tab::Stocks => "📈 Stocks",
            Tab::Settings => "⚙️ Settings",
        }
    }
}

/// TUI 应用状态
pub struct App {
    current_tab: Tab,
    book_list_state: ListState,
    stock_list_state: ListState,
    books: Vec<Book>,
    stocks: Vec<Stock>,
    config: CliConfig,
    should_quit: bool,
    #[allow(dead_code)]
    reading_book: Option<Book>,
}

impl App {
    fn new() -> Self {
        let books = db::get_all_books().unwrap_or_default();
        let stocks = db::get_all_stocks().unwrap_or_default();
        let config = config::load_config().unwrap_or_default();

        let mut book_list_state = ListState::default();
        if !books.is_empty() {
            book_list_state.select(Some(0));
        }

        let mut stock_list_state = ListState::default();
        if !stocks.is_empty() {
            stock_list_state.select(Some(0));
        }

        Self {
            current_tab: Tab::Books,
            book_list_state,
            stock_list_state,
            books,
            stocks,
            config,
            should_quit: false,
            reading_book: None,
        }
    }

    fn refresh_data(&mut self) {
        self.books = db::get_all_books().unwrap_or_default();
        self.stocks = db::get_all_stocks().unwrap_or_default();
        
        if !self.books.is_empty() {
            self.book_list_state.select(Some(0));
        }
        if !self.stocks.is_empty() {
            self.stock_list_state.select(Some(0));
        }
    }

    fn next_item(&mut self) {
        match self.current_tab {
            Tab::Books => {
                if let Some(i) = self.book_list_state.selected() {
                    let len = self.books.len();
                    if len > 0 {
                        self.book_list_state.select(Some((i + 1) % len));
                    }
                }
            }
            Tab::Stocks => {
                if let Some(i) = self.stock_list_state.selected() {
                    let len = self.stocks.len();
                    if len > 0 {
                        self.stock_list_state.select(Some((i + 1) % len));
                    }
                }
            }
            Tab::Settings => {}
        }
    }

    fn prev_item(&mut self) {
        match self.current_tab {
            Tab::Books => {
                if let Some(i) = self.book_list_state.selected() {
                    let len = self.books.len();
                    if len > 0 {
                        self.book_list_state.select(Some((i + len - 1) % len));
                    }
                }
            }
            Tab::Stocks => {
                if let Some(i) = self.stock_list_state.selected() {
                    let len = self.stocks.len();
                    if len > 0 {
                        self.stock_list_state.select(Some((i + len - 1) % len));
                    }
                }
            }
            Tab::Settings => {}
        }
    }

    fn select_item(&mut self) {
        match self.current_tab {
            Tab::Books => {
                if let Some(i) = self.book_list_state.selected() {
                    if i < self.books.len() {
                        let book = &self.books[i];
                        drop_down_to_reader(book.clone());
                        self.refresh_data();
                    }
                }
            }
            Tab::Stocks => {}
            Tab::Settings => {}
        }
    }
}

/// 下沉到阅读器模式
fn drop_down_to_reader(book: Book) {
    use ratatui::backend::CrosstermBackend;
    use ratatui::Terminal;
    use std::io::{self, Read, stdout};
    use crossterm::{
        event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode},
        execute,
        terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
    };
    use encoding_rs::*;
    use std::fs::File;

    let path = std::path::Path::new(&book.path);
    if !path.exists() {
        return;
    }

    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return,
    };

    let mut file_content = Vec::new();
    let mut reader = io::BufReader::new(file);
    if reader.read_to_end(&mut file_content).is_err() {
        return;
    }

    let text = if let Ok(s) = std::str::from_utf8(&file_content) {
        s.to_string()
    } else {
        let (decoded, _, had_errors) = GBK.decode(&file_content);
        if had_errors {
            let (fallback, _, _) = WINDOWS_1252.decode(&file_content);
            fallback.into_owned()
        } else {
            decoded.into_owned()
        }
    };

    let normalized = text.replace("\r\n", "\n").replace('\r', "\n");
    let text = if normalized.starts_with('\u{feff}') {
        &normalized[3..]
    } else {
        &normalized
    };

    let lines: Vec<&str> = text.lines().collect::<Vec<_>>();
    let total_lines = lines.len();
    if total_lines == 0 {
        return;
    }

    let config = config::load_config().unwrap_or_default();
    let mut page_size = config.page_size;
    let mut current_page = (book.last_position as usize / page_size).min(total_lines / page_size);

    enable_raw_mode().ok();
    let mut stdout = stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture).ok();

    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend).unwrap();

    loop {
        terminal.draw(|f| {
            let size = f.size();
            
            let title_area = Rect::new(0, 0, size.width, 3);
            let content_area = Rect::new(0, 3, size.width, size.height - 6);
            let status_area = Rect::new(0, size.height - 3, size.width, 3);

            let title = Paragraph::new(format!("📖 {} ", book.title.as_str()))
                .block(Block::default().borders(Borders::ALL).title(" Reading "));
            f.render_widget(title, title_area);

            let start = current_page * page_size;
            let end = (start + page_size).min(lines.len());
            let display_lines: Vec<Line> = lines[start..end]
                .iter()
                .enumerate()
                .map(|(i, l)| {
                    Line::from(vec![
                        Span::raw(format!("{:>4}  ", start + i + 1)),
                        Span::raw(*l),
                    ])
                })
                .collect();
            
            let content = Paragraph::new(display_lines).scroll((0, 0));
            f.render_widget(content, content_area);

            let total_pages = (total_lines / page_size) + if total_lines % page_size > 0 { 1 } else { 0 };
            let progress = end as f64 / total_lines as f64;
            let filled = (progress * 40.0).round() as usize;
            let progress_bar = format!(
                "{}{} {:>3}%  Page {}/{}",
                "█".repeat(filled),
                "░".repeat(40 - filled),
                (progress * 100.0) as i32,
                current_page + 1,
                total_pages
            );
            
            let status = Paragraph::new(
                Line::from(vec![
                    Span::raw(progress_bar),
                    Span::raw("  |  j/k: 翻页  h/l: 字体  q: 退出"),
                ])
            )
            .block(Block::default().borders(Borders::ALL).title(" Status "));
            f.render_widget(status, status_area);
        }).ok();

        if let Event::Key(key) = event::read().unwrap() {
            match key.code {
                KeyCode::Char('j') | KeyCode::Down | KeyCode::Char(' ') => {
                    if current_page < (total_lines / page_size) {
                        current_page += 1;
                    }
                }
                KeyCode::Char('k') | KeyCode::Up => {
                    if current_page > 0 {
                        current_page -= 1;
                    }
                }
                KeyCode::Char('h') => {
                    if page_size > 20 {
                        page_size -= 5;
                    }
                }
                KeyCode::Char('l') => {
                    if page_size < 80 {
                        page_size += 5;
                    }
                }
                KeyCode::Char('q') | KeyCode::Esc => {
                    let position = current_page * page_size;
                    db::update_book_position(&book.id, position as i64).ok();
                    break;
                }
                _ => {}
            }
        }
    }

    disable_raw_mode().ok();
    execute!(terminal.backend_mut(), LeaveAlternateScreen, DisableMouseCapture).ok();
}

/// 启动 TUI
pub fn run_tui() {
    use ratatui::backend::CrosstermBackend;
    use std::io::stdout;
    use crossterm::{
        event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode},
        execute,
        terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
    };

    enable_raw_mode().ok();
    let mut stdout = stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture).ok();
    
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend).unwrap();

    let mut app = App::new();

    execute!(terminal.backend_mut(), crossterm::cursor::Hide).ok();

    loop {
        if app.should_quit {
            break;
        }

        terminal.draw(|f| {
            let size = f.size();
            
            let main_chunks = Layout::default()
                .direction(Direction::Vertical)
                .constraints([
                    Constraint::Length(3),
                    Constraint::Min(0),
                    Constraint::Length(3),
                ])
                .split(size);

            let header_area = main_chunks[0];
            let content_area = main_chunks[1];
            let status_area = main_chunks[2];

            let titles: Vec<&str> = vec!["📚 Books", "📈 Stocks", "⚙️ Settings"];
            let selected = match app.current_tab {
                Tab::Books => 0,
                Tab::Stocks => 1,
                Tab::Settings => 2,
            };
            
            let tabs_widget = Tabs::new(titles.into_iter().map(|t| Line::from(Span::raw(t))).collect::<Vec<_>>())
                .block(Block::default().borders(Borders::ALL).title(" 摸鱼 TUI "))
                .select(selected)
                .style(Style::default().fg(Color::White))
                .highlight_style(Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD));
            
            f.render_widget(tabs_widget, header_area);

            match app.current_tab {
                Tab::Books => {
                    if app.books.is_empty() {
                        let empty = Paragraph::new("No books found.\nUse 'mofish add <path>' or 'mofish scan <dir>' to add books.")
                            .block(Block::default().borders(Borders::ALL).title(" Books "))
                            .style(Style::default().fg(Color::Yellow));
                        f.render_widget(empty, content_area);
                    } else {
                        let items: Vec<ListItem> = app.books.iter().map(|book| {
                            let progress = if book.last_position == 0 {
                                0.0
                            } else {
                                (book.last_position as f64 / 100000.0).min(1.0)
                            };
                            let progress_bar = format!(
                                "[{}{}]",
                                "█".repeat((progress * 10.0).round() as usize),
                                "░".repeat(10 - (progress * 10.0).round() as usize)
                            );
                            let title = if book.title.len() > 40 {
                                format!("{}...", &book.title[..37])
                            } else {
                                book.title.clone()
                            };
                            ListItem::new(Line::from(vec![
                                Span::raw(format!("📚 {} ", title)),
                                Span::raw(progress_bar).cyan(),
                                Span::raw(format!(" {:>3}%", (progress * 100.0) as i32)),
                            ]))
                        }).collect();
                        
                        let list = List::new(items)
                            .block(Block::default().borders(Borders::ALL).title(" Books "))
                            .highlight_style(Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD));
                        
                        f.render_stateful_widget(list, content_area, &mut app.book_list_state);
                    }
                }
                Tab::Stocks => {
                    if app.stocks.is_empty() {
                        let empty = Paragraph::new("No stocks in your list.\nUse 'mofish stock add <code>' to add stocks.")
                            .block(Block::default().borders(Borders::ALL).title(" Stocks "))
                            .style(Style::default().fg(Color::Yellow));
                        f.render_widget(empty, content_area);
                    } else {
                        let items: Vec<ListItem> = app.stocks.iter().map(|stock| {
                            ListItem::new(Line::from(vec![
                                Span::raw(format!("📈 {} ", stock.name)),
                                Span::raw(stock.code.as_str()).yellow(),
                            ]))
                        }).collect();
                        
                        let list = List::new(items)
                            .block(Block::default().borders(Borders::ALL).title(" Stocks "))
                            .highlight_style(Style::default().fg(Color::Green).add_modifier(Modifier::BOLD));
                        
                        f.render_stateful_widget(list, content_area, &mut app.stock_list_state);
                    }
                }
                Tab::Settings => {
                    let settings_content = vec![
                        Line::from(""),
                        Line::from(Span::raw("  ⚙️ Settings Panel")),
                        Line::from(""),
                        Line::from(Span::raw(format!("  Page Size: {} lines", app.config.page_size))),
                        Line::from(""),
                        Line::from(Span::raw("  (Settings editing coming soon...)")).gray(),
                    ];
                    let settings = Paragraph::new(settings_content)
                        .block(Block::default().borders(Borders::ALL).title(" Settings "));
                    f.render_widget(settings, content_area);
                }
            }

            let (tab_hint, item_count) = match app.current_tab {
                Tab::Books => ("📚", app.books.len()),
                Tab::Stocks => ("📈", app.stocks.len()),
                Tab::Settings => ("⚙️", 0),
            };
            
            let status_text = format!(
                " {} {} items  |  j/k: 导航  Enter: 打开  Tab: 切换标签  q: 退出",
                tab_hint,
                item_count
            );
            
            let status = Paragraph::new(Line::from(Span::raw(status_text)))
                .block(Block::default().borders(Borders::ALL).title(" Command "))
                .style(Style::default().fg(Color::White));
            f.render_widget(status, status_area);
        }).ok();

        if let Event::Key(key) = event::read().unwrap() {
            match key.code {
                KeyCode::Tab => {
                    app.current_tab = match app.current_tab {
                        Tab::Books => Tab::Stocks,
                        Tab::Stocks => Tab::Settings,
                        Tab::Settings => Tab::Books,
                    };
                }
                KeyCode::Char('j') | KeyCode::Down => {
                    app.next_item();
                }
                KeyCode::Char('k') | KeyCode::Up => {
                    app.prev_item();
                }
                KeyCode::Enter => {
                    app.select_item();
                    app.refresh_data();
                }
                KeyCode::Char('1') => app.current_tab = Tab::Books,
                KeyCode::Char('2') => app.current_tab = Tab::Stocks,
                KeyCode::Char('3') => app.current_tab = Tab::Settings,
                KeyCode::Char('r') | KeyCode::Char('R') => {
                    app.refresh_data();
                }
                KeyCode::Char('q') | KeyCode::Esc => {
                    app.should_quit = true;
                }
                _ => {}
            }
        }
    }

    disable_raw_mode().ok();
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    ).ok();
    execute!(terminal.backend_mut(), crossterm::cursor::Show).ok();
}
