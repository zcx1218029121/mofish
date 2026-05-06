# 架构改进设计计划

## 目标

将浅层模块重构为深层模块，提高可测试性和AI可导航性。

## 当前问题

### 1. 数据类型跨 Seam 泄漏

**问题**：`db.ts` 中的 `Book`、`Bookmark`、`Tag` 类型直接泄漏到 UI 组件。

**当前依赖方向**：
```
App.tsx → db.ts (导入 Book 类型)
BookLibrary.tsx → db.ts (导入 Book, Tag 类型)
BookReader.tsx → db.ts (导入 Bookmark, updateBookPosition)
```

**目标**：UI 组件只接收原始类型（ID、字符串、数字），不接收数据库领域对象。

### 2. Tauri API 耦合

**问题**：`BookLibrary` 直接调用 `open()`、`readDir()` 等 Tauri API。

**目标**：文件操作抽象到接口后，测试时可用 Mock 实现。

### 3. BubbleSettings localStorage 隐式持久化

**问题**：直接调用 `localStorage.setItem`，持久化机制未抽象。

**目标**：提取 `BubbleConfigStore` 接口，可切换到 Tauri store plugin。

---

## 重构方案

### 阶段一：数据层解耦

#### 1.1 创建 Domain Objects（保持现状）

```typescript
// src/domain/models.ts
// 保持 db.ts 中的类型定义不变
```

#### 1.2 创建 Repository 接口

```typescript
// src/domain/ports/BookRepository.ts
export interface BookRepository {
  getAll(): Promise<BookDTO[]>;
  getById(id: string): Promise<BookDTO | null>;
  add(title: string, path: string): Promise<string>;
  delete(id: string): Promise<void>;
}

export interface BookmarkRepository {
  getByBookId(bookId: string): Promise<BookmarkDTO[]>;
  add(bookId: string, position: number, note: string): Promise<string>;
  delete(id: string): Promise<void>;
}

// src/domain/ports/TagRepository.ts
export interface TagRepository {
  getAll(): Promise<TagDTO[]>;
  add(name: string, type: TagType): Promise<string>;
  delete(id: string): Promise<void>;
}
```

#### 1.3 创建 Tauri Adapter 实现

```typescript
// src/adapters/TauriBookRepository.ts
export class TauriBookRepository implements BookRepository { ... }
export class TauriBookmarkRepository implements BookmarkRepository { ... }
export class TauriTagRepository implements TagRepository { ... }
```

#### 1.4 组件通过接口注入依赖

```typescript
// BookLibrary 接收 Repository 作为 props
interface BookLibraryProps {
  bookRepository: BookRepository;
  tagRepository: TagRepository;
}
```

---

### 阶段二：文件系统抽象

#### 2.1 创建 FileSystem 接口

```typescript
// src/domain/ports/FileSystem.ts
export interface FileSystem {
  openFolder(): Promise<string | null>;
  readDir(path: string): Promise<FileEntry[]>;
  readTextFile(path: string): Promise<string>;
}

export interface FileEntry {
  name: string;
  path: string;
}
```

#### 2.2 Tauri FileSystem Adapter

```typescript
// src/adapters/TauriFileSystem.ts
export class TauriFileSystem implements FileSystem { ... }
```

---

### 阶段三：Bubble 配置存储抽象

```typescript
// src/domain/ports/BubbleConfigStore.ts
export interface BubbleConfigStore {
  load(): Promise<BubbleConfig | null>;
  save(config: BubbleConfig): Promise<void>;
}

// src/adapters/LocalStorageBubbleConfig.ts
export class LocalStorageBubbleConfig implements BubbleConfigStore { ... }
```

---

## 文件结构变化

```
src/
├── domain/
│   ├── models.ts          # Book, Bookmark, Tag DTOs
│   └── ports/             # Repository 接口定义
│       ├── BookRepository.ts
│       ├── BookmarkRepository.ts
│       ├── TagRepository.ts
│       └── FileSystem.ts
├── adapters/              # 接口实现
│   ├── TauriBookRepository.ts
│   ├── TauriBookmarkRepository.ts
│   ├── TauriTagRepository.ts
│   └── TauriFileSystem.ts
├── components/
│   ├── BookLibrary.tsx     # 接收 Repository props
│   ├── BookReader.tsx      # 接收 Repository props
│   └── BubbleSettings.tsx  # 接收 BubbleConfigStore props
├── db.ts                  # 保留，SQLite 操作
└── pinyin.ts              # 可选择合并到 BookLibrary
```

---

## 测试策略

| 模块 | 测试方式 |
|------|----------|
| Repository 接口 | Mock adapter，单元测试业务逻辑 |
| BookLibrary | 注入 Mock Repository，测试筛选/搜索逻辑 |
| BookReader | 注入 Mock BookmarkRepository，测试书签CRUD |
| BubbleSettings | 注入 Mock BubbleConfigStore，测试配置更新 |
| pinyin | 纯函数，直接 Jest 测试 |

---

## 双模式架构

### Bubble 模式 vs CLI 模式

| 模式 | 启动方式 | 交互界面 |
|------|----------|----------|
| Bubble 模式 | `mofish` | 透明气泡窗口，React 前端 |
| CLI 模式 | `mofish cli` | 终端交互，Rust CLI |

### 共享层

两种模式共享同一套 domain/adapters：
- `domain/models.ts` — 数据模型
- `domain/ports/*Repository.ts` — 仓库接口
- `adapters/*Repository.ts` — Tauri 适配器
- `db.ts` — SQLite 操作

### CLI 模式特点

- Rust 实现，用 `clap` 解析子命令
- 不创建 Tauri 窗口，直接执行命令退出
- 阅读模式为固定高度分页（每页 N 行）
- 输出带颜色格式化

### CLI 命令设计

```
mofish cli book search <keyword>   # 搜索书籍
mofish cli book list               # 列出书籍
mofish cli book read <book_id>     # 阅读（分页）
mofish cli stock add <code>        # 添加自选股
mofish cli stock list              # 查看自选股
```

---

## 实施顺序

1. **阶段一（数据层解耦）** — 创建接口 + Adapter，修改组件 props
2. **阶段二（文件系统抽象）** — 接口 + Adapter 分离
3. **阶段三（Bubble存储）** — 最后处理，可选
4. **CLI 模式** — 新增阶段，实现双模式架构

每个阶段完成后可独立测试。
