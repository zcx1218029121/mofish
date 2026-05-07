use crossterm::event::{KeyCode, KeyEvent};
use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style, Stylize},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, ListState, Paragraph, Tabs},
    Terminal,
};

use mofish_core::{db, config, Book, Stock, CliConfig};

/// 面板层级
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Panel {
    MainList,     // 主列表
    AddBook,      // 添加书籍对话框
    EditPath,     // 编辑路径对话框
    Reader,       // 阅读器
}

impl Default for Panel {
    fn default() -> Self {
        Panel::MainList
    }
}

/// 标签页枚举
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Tab {
    Books,
    Stocks,
    Settings,
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
    reading_book: Option<Book>,
    current_panel: Panel,
    add_book_path: String,
    edit_path_value: String,
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
            current_panel: Panel::MainList,
            add_book_path: String::new(),
            edit_path_value: String::new(),
        }
    }

    fn refresh_data(&mut self) {
        self.books = db::get_all_books().unwrap_or_default();
        self.stocks = db::get_all_stocks().unwrap_or_default();
        
        if !self.books.is_empty() && self.book_list_state.selected().is_none() {
            self.book_list_state.select(Some(0));
        }
        if !self.stocks.is_empty() && self.stock_list_state.selected().is_none() {
            self.stock_list_state.select(Some(0));
        }
    }

    fn next_item(&mut self) {
        if self.current_panel != Panel::MainList {
            return;
        }
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
        if self.current_panel != Panel::MainList {
            return;
        }
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
        if self.current_panel != Panel::MainList {
            return;
        }
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
            Tab::Stocks | Tab::Settings => {}
        }
    }

    /// 关闭当前面板，返回主列表
    fn close_panel(&mut self) {
        match self.current_panel {
            Panel::MainList => {
                // 在主列表按 Esc/q 退出程序
                self.should_quit = true;
            }
            Panel::AddBook | Panel::EditPath => {
                self.current_panel = Panel::MainList;
                self.add_book_path.clear();
                self.edit_path_value.clear();
            }
            Panel::Reader => {}
        }
    }

    /// 打开添加书籍对话框
    fn open_add_book(&mut self) {
        self.current_panel = Panel::AddBook;
        self.add_book_path.clear();
    }

    /// 打开编辑路径对话框
    fn open_edit_path(&mut self, book: &Book) {
        self.current_panel = Panel::EditPath;
        self.edit_path_value = book.path.clone();
    }

    /// 提交添加书籍
    fn submit_add_book(&mut self) {
        if self.add_book_path.trim().is_empty() {
            return;
        }
        let input_path = self.add_book_path.trim();
        
        // 判断是文件还是目录
        let path_obj = std::path::Path::new(input_path);
        
        if path_obj.is_dir() {
            // 扫描目录添加书籍
            if let Ok(entries) = std::fs::read_dir(path_obj) {
                for entry in entries.flatten() {
                    let entry_path = entry.path();
                    if entry_path.is_file() {
                        let ext = entry_path.extension()
                            .and_then(|e| e.to_str())
                            .unwrap_or("")
                            .to_lowercase();
                        if ["txt", "md", "epub"].contains(&ext.as_str()) {
                            let title = entry_path.file_stem()
                                .and_then(|s| s.to_str())
                                .unwrap_or("Unknown")
                                .to_string();
                            if let Err(e) = db::add_book(&title, entry_path.to_str().unwrap_or(""), &ext) {
                                eprintln!("Error adding book: {:?}", e);
                            }
                        }
                    }
                }
            }
        } else if path_obj.is_file() {
            // 添加单个文件
            let title = path_obj.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown")
                .to_string();
            let ext = path_obj.extension()
                .and_then(|e| e.to_str())
                .unwrap_or("txt")
                .to_lowercase();
            if let Err(e) = db::add_book(&title, input_path, &ext) {
                eprintln!("Error adding book: {:?}", e);
            }
        }
        
        self.refresh_data();
        self.current_panel = Panel::MainList;
        self.add_book_path.clear();
    }

    /// 提交编辑路径
    fn submit_edit_path(&mut self) {
        if self.edit_path_value.trim().is_empty() {
            return;
        }
        if let Some(i) = self.book_list_state.selected() {
            if i < self.books.len() {
                let book = &self.books[i];
                if let Err(e) = db::update_book_path(&book.id, self.edit_path_value.trim()) {
                    eprintln!("Error updating path: {:?}", e);
                }
                self.refresh_data();
            }
        }
        self.current_panel = Panel::MainList;
        self.edit_path_value.clear();
    }

    /// 删除当前选中的书籍
    fn delete_selected_book(&mut self) {
        if let Some(i) = self.book_list_state.selected() {
            if i < self.books.len() {
                let book = &self.books[i];
                if let Err(e) = db::delete_book(&book.id) {
                    eprintln!("Error deleting book: {:?}", e);
                }
                self.refresh_data();
            }
        }
    }

    /// 计算书籍的实际阅读进度
    fn calculate_book_progress(book: &Book) -> (f64, usize) {
        let total_size = std::fs::metadata(&book.path)
            .map(|m| m.len() as i64)
            .unwrap_or(100000);
        
        if total_size == 0 || book.last_position == 0 {
            (0.0, 0)
        } else {
            let progress = (book.last_position as f64 / total_size as f64).min(1.0);
            (progress, total_size as usize)
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

    let total_size = file_content.len();
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
            
            // 使用实际字节位置计算进度
            let bytes_read = lines.iter()
                .take(end)
                .map(|l| l.len())
                .sum::<usize>();
            let progress = if total_size > 0 {
                (bytes_read as f64 / total_size as f64).min(1.0)
            } else {
                0.0
            };
            
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
                    Span::raw("  |  j/k: 翻页  h/l: 字体  Esc: 退出到列表"),
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

            // 根据当前面板渲染不同内容
            match app.current_panel {
                Panel::MainList => {
                    app.render_main_list(f, content_area);
                }
                Panel::AddBook => {
                    app.render_add_book_dialog(f, content_area);
                }
                Panel::EditPath => {
                    app.render_edit_path_dialog(f, content_area);
                }
                Panel::Reader => {}
            }

            // 底部状态栏
            let (tab_hint, item_count, panel_hint) = match app.current_panel {
                Panel::MainList => {
                    match app.current_tab {
                        Tab::Books => ("📚", app.books.len(), "j/k: 导航  Enter: 打开  a: 添加  d: 删除  e: 编辑路径  Tab: 切换  Esc: 退出"),
                        Tab::Stocks => ("📈", app.stocks.len(), "j/k: 导航  Tab: 切换  Esc: 退出"),
                        Tab::Settings => ("⚙️", 0, "h/l: 调整PageSize  r: 刷新  Esc: 退出"),
                    }
                }
                Panel::AddBook => ("➕", 0, "输入路径后 Enter 确认  Esc: 取消"),
                Panel::EditPath => ("✏️", 0, "输入路径后 Enter 确认  Esc: 取消"),
                Panel::Reader => ("📖", 0, ""),
            };
            
            let status_text = format!(" {} {} items  |  {}", tab_hint, item_count, panel_hint);
            
            let status = Paragraph::new(Line::from(Span::raw(status_text)))
                .block(Block::default().borders(Borders::ALL).title(" Command "))
                .style(Style::default().fg(Color::White));
            f.render_widget(status, status_area);
        }).ok();

        if let Event::Key(key) = event::read().unwrap() {
            match app.current_panel {
                Panel::MainList => {
                    app.handle_main_list_key(key);
                }
                Panel::AddBook => {
                    app.handle_add_book_key(key);
                }
                Panel::EditPath => {
                    app.handle_edit_path_key(key);
                }
                Panel::Reader => {}
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

/// 渲染主列表
impl App {
    fn render_main_list(&self, f: &mut ratatui::Frame, content_area: Rect) {
        match self.current_tab {
            Tab::Books => {
                if self.books.is_empty() {
                    let empty = Paragraph::new("No books found.\nPress 'a' to add books by path, or 's' to scan a directory.")
                        .block(Block::default().borders(Borders::ALL).title(" Books "))
                        .style(Style::default().fg(Color::Yellow));
                    f.render_widget(empty, content_area);
                } else {
                    let items: Vec<ListItem> = self.books.iter().map(|book| {
                        let (progress, total_size) = Self::calculate_book_progress(book);
                        let progress_bar = format!(
                            "[{}{}]",
                            "█".repeat((progress * 10.0).round() as usize),
                            "░".repeat(10 - (progress * 10.0).round() as usize)
                        );
                        let title = if book.title.len() > 30 {
                            format!("{}...", &book.title[..27])
                        } else {
                            book.title.clone()
                        };
                        // 格式化文件大小
                        let size_str = if total_size > 1024 * 1024 {
                            format!("{:.1}MB", total_size as f64 / (1024.0 * 1024.0))
                        } else if total_size > 1024 {
                            format!("{:.1}KB", total_size as f64 / 1024.0)
                        } else {
                            format!("{}B", total_size)
                        };
                        
                        ListItem::new(Line::from(vec![
                            Span::raw(format!("📚 {} ", title)),
                            Span::raw(size_str).dim(),
                            Span::raw(" "),
                            Span::raw(progress_bar).cyan(),
                            Span::raw(format!(" {:>3}%", (progress * 100.0) as i32)),
                        ]))
                    }).collect();
                    
                    let list = List::new(items)
                        .block(Block::default().borders(Borders::ALL).title(" Books "))
                        .highlight_style(Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD));
                    
                    f.render_stateful_widget(list, content_area, &mut self.book_list_state.clone());
                }
            }
            Tab::Stocks => {
                if self.stocks.is_empty() {
                    let empty = Paragraph::new("No stocks in your list.\nUse 'mofish stock add <code>' to add stocks.")
                        .block(Block::default().borders(Borders::ALL).title(" Stocks "))
                        .style(Style::default().fg(Color::Yellow));
                    f.render_widget(empty, content_area);
                } else {
                    let items: Vec<ListItem> = self.stocks.iter().map(|stock| {
                        ListItem::new(Line::from(vec![
                            Span::raw(format!("📈 {} ", stock.name)),
                            Span::raw(stock.code.as_str()).yellow(),
                        ]))
                    }).collect();
                    
                    let list = List::new(items)
                        .block(Block::default().borders(Borders::ALL).title(" Stocks "))
                        .highlight_style(Style::default().fg(Color::Green).add_modifier(Modifier::BOLD));
                    
                    f.render_stateful_widget(list, content_area, &mut self.stock_list_state.clone());
                }
            }
            Tab::Settings => {
                let settings_content = vec![
                    Line::from(""),
                    Line::from(Span::raw("  ⚙️ Settings Panel").bold()),
                    Line::from(""),
                    Line::from(Span::raw(format!("  📄 Page Size: {} lines", self.config.page_size))),
                    Line::from(""),
                    Line::from(Span::raw("  h: 减少5行  |  l: 增加5行").cyan()),
                    Line::from(Span::raw("  r: 刷新数据").cyan()),
                    Line::from(""),
                    Line::from(Span::raw("  快捷键:").dim()),
                    Line::from(Span::raw("  Tab: 切换标签  Esc: 退出程序").dim()),
                ];
                let settings = Paragraph::new(settings_content)
                    .block(Block::default().borders(Borders::ALL).title(" Settings "));
                f.render_widget(settings, content_area);
            }
        }
    }

    fn render_add_book_dialog(&self, f: &mut ratatui::Frame, content_area: Rect) {
        let dialog_content = vec![
            Line::from(""),
            Line::from(Span::raw("  ➕ Add Book").bold()),
            Line::from(""),
            Line::from(Span::raw("  Enter the file path or directory path:").cyan()),
            Line::from(""),
            Line::from(Span::raw(format!("  > {}", self.add_book_path))),
            Line::from(""),
            Line::from(Span::raw("  支持: 单个文件 (txt/md/epub) 或包含书籍的目录").dim()),
            Line::from(Span::raw("  支持: 目录会自动扫描并添加所有支持的文件").dim()),
            Line::from(""),
            Line::from(Span::raw("  Enter: 确认添加  |  Esc: 取消").yellow()),
        ];
        
        let dialog = Paragraph::new(dialog_content)
            .block(Block::default().borders(Borders::ALL).title(" Add Book "))
            .style(Style::default().fg(Color::White));
        f.render_widget(dialog, content_area);
    }

    fn render_edit_path_dialog(&self, f: &mut ratatui::Frame, content_area: Rect) {
        let selected_title = self.book_list_state.selected()
            .and_then(|i| self.books.get(i))
            .map(|b| b.title.as_str())
            .unwrap_or("Unknown");
            
        let dialog_content = vec![
            Line::from(""),
            Line::from(Span::raw("  ✏️ Edit Book Path").bold()),
            Line::from(""),
            Line::from(Span::raw(format!("  Book: {}", selected_title)).cyan()),
            Line::from(""),
            Line::from(Span::raw("  Enter new path:").yellow()),
            Line::from(""),
            Line::from(Span::raw(format!("  > {}", self.edit_path_value))),
            Line::from(""),
            Line::from(Span::raw("  Enter: 确认修改  |  Esc: 取消").yellow()),
        ];
        
        let dialog = Paragraph::new(dialog_content)
            .block(Block::default().borders(Borders::ALL).title(" Edit Path "))
            .style(Style::default().fg(Color::White));
        f.render_widget(dialog, content_area);
    }

    fn handle_main_list_key(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Tab => {
                self.current_tab = match self.current_tab {
                    Tab::Books => Tab::Stocks,
                    Tab::Stocks => Tab::Settings,
                    Tab::Settings => Tab::Books,
                };
            }
            KeyCode::Char('j') | KeyCode::Down => {
                self.next_item();
            }
            KeyCode::Char('k') | KeyCode::Up => {
                self.prev_item();
            }
            KeyCode::Enter => {
                self.select_item();
                self.refresh_data();
            }
            KeyCode::Char('1') => self.current_tab = Tab::Books,
            KeyCode::Char('2') => self.current_tab = Tab::Stocks,
            KeyCode::Char('3') => self.current_tab = Tab::Settings,
            KeyCode::Char('r') | KeyCode::Char('R') => {
                self.refresh_data();
            }
            // 添加书籍
            KeyCode::Char('a') | KeyCode::Char('A') => {
                if self.current_tab == Tab::Books {
                    self.open_add_book();
                }
            }
            // 删除书籍
            KeyCode::Char('d') | KeyCode::Char('D') => {
                if self.current_tab == Tab::Books {
                    self.delete_selected_book();
                }
            }
            // 编辑路径
            KeyCode::Char('e') | KeyCode::Char('E') => {
                if self.current_tab == Tab::Books {
                    if let Some(i) = self.book_list_state.selected() {
                        if i < self.books.len() {
                            let book = self.books[i].clone();
                            self.open_edit_path(&book);
                        }
                    }
                }
            }
            // 设置页面：调整 page_size
            KeyCode::Char('h') | KeyCode::Left => {
                if self.current_tab == Tab::Settings {
                    if self.config.page_size > 10 {
                        self.config.page_size -= 5;
                        if let Err(e) = config::save_config(&self.config) {
                            eprintln!("Error saving config: {:?}", e);
                        }
                    }
                }
            }
            KeyCode::Char('l') | KeyCode::Right => {
                if self.current_tab == Tab::Settings {
                    if self.config.page_size < 100 {
                        self.config.page_size += 5;
                        if let Err(e) = config::save_config(&self.config) {
                            eprintln!("Error saving config: {:?}", e);
                        }
                    }
                }
            }
            // Esc 或 q 返回上级（主列表 -> 退出程序）
            KeyCode::Esc | KeyCode::Char('q') => {
                self.close_panel();
            }
            _ => {}
        }
    }

    fn handle_add_book_key(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Enter => {
                self.submit_add_book();
            }
            KeyCode::Esc => {
                self.current_panel = Panel::MainList;
                self.add_book_path.clear();
            }
            KeyCode::Char(c) => {
                self.add_book_path.push(c);
            }
            KeyCode::Backspace => {
                self.add_book_path.pop();
            }
            KeyCode::Delete => {
                self.add_book_path.clear();
            }
            _ => {}
        }
    }

    fn handle_edit_path_key(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Enter => {
                self.submit_edit_path();
            }
            KeyCode::Esc => {
                self.current_panel = Panel::MainList;
                self.edit_path_value.clear();
            }
            KeyCode::Char(c) => {
                self.edit_path_value.push(c);
            }
            KeyCode::Backspace => {
                self.edit_path_value.pop();
            }
            KeyCode::Delete => {
                self.edit_path_value.clear();
            }
            _ => {}
        }
    }
}
