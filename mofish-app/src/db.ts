import Database from "@tauri-apps/plugin-sql";

export interface Book {
  id: string;
  title: string;
  path: string;
  format: "txt" | "epub";
  addedAt: number;
  lastReadAt: number | null;
  lastPosition: number;
  tags: string[];
}

export interface Tag {
  id: string;
  name: string;
  type: "status" | "genre" | "custom";
}

export interface Bookmark {
  id: string;
  bookId: string;
  position: number;
  note: string;
  createdAt: number;
}

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  db = await Database.load("sqlite:mofish.db");

  // Create tables
  await db.execute(`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      path TEXT UNIQUE NOT NULL,
      format TEXT NOT NULL DEFAULT 'txt',
      added_at INTEGER NOT NULL,
      last_read_at INTEGER,
      last_position INTEGER NOT NULL DEFAULT 0
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'custom'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS book_tags (
      book_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (book_id, tag_id),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      note TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `);

  // Create default tags
  const defaultTags = [
    { id: "status-want", name: "想看", type: "status" },
    { id: "status-reading", name: "在看", type: "status" },
    { id: "status-done", name: "已看", type: "status" },
    { id: "status-dropped", name: "弃了", type: "status" },
    { id: "genre-fantasy", name: "玄幻", type: "genre" },
    { id: "genre-urban", name: "都市", type: "genre" },
    { id: "genre-sci-fi", name: "科幻", type: "genre" },
    { id: "genre-romance", name: "言情", type: "genre" },
  ];

  for (const tag of defaultTags) {
    await db.execute(
      `INSERT OR IGNORE INTO tags (id, name, type) VALUES ($1, $2, $3)`,
      [tag.id, tag.name, tag.type]
    );
  }

  return db;
}

export async function getAllBooks(): Promise<Book[]> {
  const database = await initDatabase();
  const books = await database.select<
    Array<{
      id: string;
      title: string;
      path: string;
      format: string;
      added_at: number;
      last_read_at: number | null;
      last_position: number;
    }>
  >(`SELECT * FROM books ORDER BY last_read_at DESC NULLS LAST, added_at DESC`);

  const result: Book[] = [];
  for (const b of books) {
    const tags = await database.select<Array<{ tag_id: string }>>(
      `SELECT tag_id FROM book_tags WHERE book_id = $1`,
      [b.id]
    );
    result.push({
      id: b.id,
      title: b.title,
      path: b.path,
      format: b.format as "txt" | "epub",
      addedAt: b.added_at,
      lastReadAt: b.last_read_at,
      lastPosition: b.last_position,
      tags: tags.map((t) => t.tag_id),
    });
  }
  return result;
}

export async function getAllTags(): Promise<Tag[]> {
  const database = await initDatabase();
  return database.select<Tag[]>(`SELECT * FROM tags ORDER BY type, name`);
}

export async function addBook(title: string, path: string, format: "txt" | "epub" = "txt"): Promise<string> {
  const database = await initDatabase();
  const id = crypto.randomUUID();
  await database.execute(
    `INSERT INTO books (id, title, path, format, added_at, last_position) VALUES ($1, $2, $3, $4, $5, 0)`,
    [id, title, path, format, Date.now()]
  );
  return id;
}

export async function addTag(name: string, type: "custom" | "status" | "genre" = "custom"): Promise<string> {
  const database = await initDatabase();
  const id = `tag-${crypto.randomUUID()}`;
  await database.execute(
    `INSERT INTO tags (id, name, type) VALUES ($1, $2, $3)`,
    [id, name, type]
  );
  return id;
}

export async function deleteTag(id: string): Promise<void> {
  const database = await initDatabase();
  await database.execute(`DELETE FROM book_tags WHERE tag_id = $1`, [id]);
  await database.execute(`DELETE FROM tags WHERE id = $1`, [id]);
}

export async function addTagToBook(bookId: string, tagId: string): Promise<void> {
  const database = await initDatabase();
  await database.execute(
    `INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES ($1, $2)`,
    [bookId, tagId]
  );
}

export async function removeTagFromBook(bookId: string, tagId: string): Promise<void> {
  const database = await initDatabase();
  await database.execute(
    `DELETE FROM book_tags WHERE book_id = $1 AND tag_id = $2`,
    [bookId, tagId]
  );
}

export async function updateBookPosition(bookId: string, position: number): Promise<void> {
  const database = await initDatabase();
  await database.execute(
    `UPDATE books SET last_position = $1, last_read_at = $2 WHERE id = $3`,
    [position, Date.now(), bookId]
  );
}

export async function updateBookTags(bookId: string, tagIds: string[]): Promise<void> {
  const database = await initDatabase();
  await database.execute(`DELETE FROM book_tags WHERE book_id = $1`, [bookId]);
  for (const tagId of tagIds) {
    await database.execute(
      `INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES ($1, $2)`,
      [bookId, tagId]
    );
  }
}

export async function deleteBook(id: string): Promise<void> {
  const database = await initDatabase();
  await database.execute(`DELETE FROM book_tags WHERE book_id = $1`, [id]);
  await database.execute(`DELETE FROM bookmarks WHERE book_id = $1`, [id]);
  await database.execute(`DELETE FROM books WHERE id = $1`, [id]);
}

export async function addBookmark(bookId: string, position: number, note: string = ""): Promise<string> {
  const database = await initDatabase();
  const id = crypto.randomUUID();
  await database.execute(
    `INSERT INTO bookmarks (id, book_id, position, note, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [id, bookId, position, note, Date.now()]
  );
  return id;
}

export async function getBookmarks(bookId: string): Promise<Bookmark[]> {
  const database = await initDatabase();
  return database.select<Bookmark[]>(
    `SELECT id, book_id as bookId, position, note, created_at as createdAt FROM bookmarks WHERE book_id = $1 ORDER BY created_at DESC`,
    [bookId]
  );
}

export async function deleteBookmark(id: string): Promise<void> {
  const database = await initDatabase();
  await database.execute(`DELETE FROM bookmarks WHERE id = $1`, [id]);
}
