# CLI 模式设计Spec

## 概述

摸鱼支持双模式启动：Bubble 模式（图形窗口）和 CLI 模式（终端交互）。两种模式共享同一套业务逻辑，通过 Tauri 二进制子命令区分。

## 双模式架构

| 模式 | 启动命令 | 交互形式 |
|------|----------|----------|
| Bubble 模式 | `mofish` | 透明气泡窗口，React 前端 |
| CLI 模式 | `mofish cli` | 终端交互，Rust 实现 |

### 共享层
- `domain/models.ts` — 数据模型（BookDTO、TagDTO、BookmarkDTO）
- `domain/ports/*Repository.ts` — 仓库接口
- `adapters/*Repository.ts` — Tauri 适配器
- `db.ts` — SQLite 操作

### CLI 模式特点
- Rust 实现，用 `clap` 解析子命令
- 不创建 Tauri 窗口，直接执行命令退出
- 阅读模式为固定高度分页（不滚动）
- 输出带 ANSI 颜色格式化

---

## CLI 命令设计

### 全局结构
```
mofish cli <subcommand> [args]
```

### book 子命令

| 命令 | 说明 |
|------|------|
| `book list` | 列出所有书籍，显示进度条 |
| `book search <关键词>` | 搜索书籍（支持拼音首字母） |
| `book read <book_id>` | 分页阅读书籍 |

### stock 子命令

| 命令 | 说明 |
|------|------|
| `stock add <代码>` | 添加自选股 |
| `stock list` | 查看自选股列表（涨绿跌红） |

---

## 输出格式

### book list 输出
```
📚 全职高手      [35%] ████████░░  蝴蝶蓝
📖 亵渎          [12%] ██░░░░░░░░  烟雨江南
📖 斗破苍穹      [78%] ██████████  天蚕土豆
```

- 📚 图标
- 书名左对齐
- 进度百分比
- ASCII 进度条（10格）
- 作者名

### book search 输出
同 `book list`，过滤显示匹配结果。

### stock list 输出
```
名称       代码      现价    涨跌      涨跌%
贵州茅台  600519   1688.00  +35.20   +2.13%  ▲
宁德时代  300750    198.50  -2.30    -1.14%  ▼
```

- 涨：绿色 `+`
- 跌：红色 `-`

---

## 阅读交互

### 启动
```bash
mofish cli book read <book_id>
```

### 分页显示
- 每页固定 N 行，默认 30 行
- 显示当前页/总页数
- 显示当前书籍标题

### 按键交互

| 按键 | 动作 |
|------|------|
| `j` / `↓` / `Space` / `Enter` | 下一页 |
| `k` / `↑` | 上一页 |
| `q` / `Esc` | 退出阅读 |
| `h` | 减少每页行数（最小 20） |
| `l` | 增加每页行数（最大 60） |

### 分页行数配置
- 默认 30 行
- 通过 `~/.mofish/clirc` 或 `mofish config page-size <n>` 配置
- 运行时 `h/l` 临时调整

### 阅读退出
- 自动保存阅读位置到 SQLite
- 下次阅读从断点继续

---

## 实现要点

### Rust CLI 入口
- `main.rs` 根据参数决定模式
- 使用 `clap` 解析子命令
- CLI 模式直接调用 `lib.rs` 中的业务逻辑

### ANSI 颜色
- 使用 `ansi_term` 或 `colored` crate
- Unix/macOS 原生支持
- Windows 10+ 也支持

### TTY 检测
- 检测 stdin 是否为终端
- 非终端时关闭颜色输出

### 配置文件
- 路径：`~/.mofish/config.json`
- 内容：
```json
{
  "pageSize": 30
}
```

---

## 技术依赖

### Cargo.toml 新增
```toml
[dependencies]
clap = { version = "4", features = ["derive"] }
ansi_term = "0.12"
```

### 文件变更
- `src-tauri/src/main.rs` — CLI 入口，参数路由
- `src-tauri/src/lib.rs` — 保留现有逻辑
- `src-tauri/src/cli.rs` — 新增，CLI 子命令实现（可选）
- `src-tauri/src/commands/` — 新增，CLI 命令模块（可选）

---

## 验证

### 测试场景
1. `mofish cli book list` — 正常输出书籍列表
2. `mofish cli book search 全职` — 输出匹配结果
3. `mofish cli book read <id>` — 进入分页阅读，`j/k` 翻页，`q` 退出
4. `mofish cli stock add 600519` — 添加成功
5. `mofish cli stock list` — 显示自选股，颜色正确
6. `h/l` 在阅读时调整行数
