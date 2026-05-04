# 实施计划

## 概述

按照 ARCHITECTURE.md 的设计，分三个阶段实施重构。

---

## 阶段一：数据层解耦

### 目标

组件通过 Repository 接口操作数据，不直接依赖 `db.ts` 的具体实现。

### 步骤

#### 1.1 创建 Domain Models

**文件**: `src/domain/models.ts`

```typescript
export interface BookDTO {
  id: string;
  title: string;
  path: string;
  format: "txt" | "epub";
  addedAt: number;
  lastReadAt: number | null;
  lastPosition: number;
  tags: string[];
}

export interface TagDTO {
  id: string;
  name: string;
  type: "status" | "genre" | "custom";
}

export interface BookmarkDTO {
  id: string;
  bookId: string;
  position: number;
  note: string;
  createdAt: number;
}

export type TagType = "status" | "genre" | "custom";
```

#### 1.2 创建 Repository 接口

**文件**: `src/domain/ports/BookRepository.ts`

```typescript
import { BookDTO } from "../models";

export interface BookRepository {
  getAll(): Promise<BookDTO[]>;
  getById(id: string): Promise<BookDTO | null>;
  add(title: string, path: string): Promise<string>;
  delete(id: string): Promise<void>;
  updatePosition(id: string, position: number): Promise<void>;
}
```

**文件**: `src/domain/ports/TagRepository.ts`

```typescript
import { TagDTO, TagType } from "../models";

export interface TagRepository {
  getAll(): Promise<TagDTO[]>;
  add(name: string, type: TagType): Promise<string>;
  delete(id: string): Promise<void>;
  addTagToBook(bookId: string, tagId: string): Promise<void>;
  removeTagFromBook(bookId: string, tagId: string): Promise<void>;
  getBookTags(bookId: string): Promise<string[]>;
}
```

**文件**: `src/domain/ports/BookmarkRepository.ts`

```typescript
import { BookmarkDTO } from "../models";

export interface BookmarkRepository {
  getByBookId(bookId: string): Promise<BookmarkDTO[]>;
  add(bookId: string, position: number, note: string): Promise<string>;
  delete(id: string): Promise<void>;
}
```

#### 1.3 创建 Tauri Adapter 实现

**文件**: `src/adapters/TauriBookRepository.ts`

```typescript
import { BookRepository } from "../domain/ports/BookRepository";
import { BookDTO } from "../domain/models";
import { getAllBooks, addBook, deleteBook, updateBookPosition } from "../db";

export class TauriBookRepository implements BookRepository {
  async getAll(): Promise<BookDTO[]> {
    return getAllBooks();
  }

  async getById(id: string): Promise<BookDTO | null> {
    const books = await getAllBooks();
    return books.find(b => b.id === id) || null;
  }

  async add(title: string, path: string): Promise<string> {
    return addBook(title, path, "txt");
  }

  async delete(id: string): Promise<void> {
    return deleteBook(id);
  }

  async updatePosition(id: string, position: number): Promise<void> {
    return updateBookPosition(id, position);
  }
}
```

类似创建:
- `src/adapters/TauriTagRepository.ts`
- `src/adapters/TauriBookmarkRepository.ts`

#### 1.4 修改组件接收 Repository Props

**BookLibrary.tsx**

```typescript
interface BookLibraryProps {
  bookRepository: BookRepository;
  tagRepository: TagRepository;
}
```

**BookReader.tsx**

```typescript
interface BookReaderProps {
  bookPath: string;
  bookId: string;
  bookmarkRepository: BookmarkRepository;
  onBack: () => void;
}
```

#### 1.5 App.tsx 组装 Adapter

```typescript
const bookRepo = new TauriBookRepository();
const tagRepo = new TauriTagRepository();
const bookmarkRepo = new TauriBookmarkRepository();

<BookLibrary bookRepository={bookRepo} tagRepository={tagRepo} />
<BookReader bookmarkRepository={bookmarkRepo} ... />
```

### 验证

- `npm run build` 通过
- 手动测试：添加书籍、标签、书签流程正常

---

## 阶段二：文件系统抽象

### 目标

`BookLibrary` 不直接调用 Tauri 文件 API，通过 `FileSystem` 接口操作。

### 步骤

#### 2.1 创建 FileSystem 接口

**文件**: `src/domain/ports/FileSystem.ts`

```typescript
export interface FileEntry {
  name: string;
  path: string;
}

export interface FileSystem {
  openFolderDialog(): Promise<string | null>;
  readDir(path: string): Promise<FileEntry[]>;
  readTextFile(path: string): Promise<string>;
}
```

#### 2.2 创建 Tauri FileSystem Adapter

**文件**: `src/adapters/TauriFileSystem.ts`

```typescript
import { FileSystem, FileEntry } from "../domain/ports/FileSystem";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir, readTextFile } from "@tauri-apps/plugin-fs";

export class TauriFileSystem implements FileSystem {
  async openFolderDialog(): Promise<string | null> {
    return open({ directory: true, multiple: false }) as Promise<string | null>;
  }

  async readDir(path: string): Promise<FileEntry[]> {
    const entries = await readDir(path);
    return entries
      .filter(e => e.isFile && e.name?.endsWith(".txt"))
      .map(e => ({ name: e.name!, path: `${path}/${e.name}` }));
  }

  async readTextFile(path: string): Promise<string> {
    return readTextFile(path);
  }
}
```

#### 2.3 修改 BookLibrary Props

```typescript
interface BookLibraryProps {
  bookRepository: BookRepository;
  tagRepository: TagRepository;
  fileSystem: FileSystem;  // 新增
}
```

### 验证

- `npm run build` 通过
- 手动测试：扫描文件夹功能正常

---

## 阶段三：Bubble 配置存储抽象

### 目标

`BubbleSettings` 通过 `BubbleConfigStore` 接口持久化配置。

### 步骤

#### 3.1 创建 BubbleConfigStore 接口

**文件**: `src/domain/ports/BubbleConfigStore.ts`

```typescript
export interface BubbleConfig {
  opacity: number;
  borderRadius: number;
  width: number;
  height: number;
  color: string;
}

export interface BubbleConfigStore {
  load(): Promise<BubbleConfig | null>;
  save(config: BubbleConfig): Promise<void>;
}
```

#### 3.2 创建 LocalStorage Adapter

**文件**: `src/adapters/LocalStorageBubbleConfig.ts`

```typescript
import { BubbleConfigStore, BubbleConfig } from "../domain/ports/BubbleConfigStore";

const STORAGE_KEY = "mofish-bubble-config";

export class LocalStorageBubbleConfig implements BubbleConfigStore {
  async load(): Promise<BubbleConfig | null> {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  async save(config: BubbleConfig): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
}
```

#### 3.3 修改 BubbleSettings Props

```typescript
interface BubbleSettingsProps {
  configStore: BubbleConfigStore;  // 新增
}
```

### 验证

- `npm run build` 通过
- 手动测试：调整透明度/圆角后刷新页面，配置保持

---

## 完成后预期结构

```
src/
├── domain/
│   ├── models.ts
│   └── ports/
│       ├── BookRepository.ts
│       ├── TagRepository.ts
│       ├── BookmarkRepository.ts
│       ├── FileSystem.ts
│       └── BubbleConfigStore.ts
├── adapters/
│   ├── TauriBookRepository.ts
│   ├── TauriTagRepository.ts
│   ├── TauriBookmarkRepository.ts
│   ├── TauriFileSystem.ts
│   └── LocalStorageBubbleConfig.ts
├── components/
│   ├── BookLibrary.tsx
│   ├── BookReader.tsx
│   └── BubbleSettings.tsx
├── db.ts          # 保留，SQLite 操作
└── pinyin.ts
```

---

## 回滚计划

如遇问题：
- 每个阶段完成前不删除原有代码
- 保留 `db.ts` 作为 Adapter 的底层实现
- 可随时切回直接调用 `db.ts` 的版本
