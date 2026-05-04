import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir } from "@tauri-apps/plugin-fs";
import {
  initDatabase,
  getAllBooks,
  getAllTags,
  addBook,
  addTag,
  deleteTag,
  addTagToBook,
  removeTagFromBook,
  deleteBook,
  Book,
  Tag,
} from "../db";
import { searchBooks } from "../pinyin";

interface BookLibraryProps {
  onSelectBook: (book: Book) => void;
  onSelectBookPath: (path: string) => void;
  className?: string;
}

export function BookLibrary({ onSelectBook, className = "" }: BookLibraryProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  useEffect(() => {
    initDatabase().then(async () => {
      const [loadedBooks, loadedTags] = await Promise.all([getAllBooks(), getAllTags()]);
      setBooks(loadedBooks);
      setTags(loadedTags);
    });
  }, []);

  // First filter by tags, then by search query
  const tagFilteredBooks = selectedTags.length > 0
    ? books.filter((book) => selectedTags.some((tag) => book.tags.includes(tag)))
    : books;

  const filteredBooks = searchQuery ? searchBooks(tagFilteredBooks, searchQuery) : tagFilteredBooks;

  const handleScanFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected && typeof selected === "string") {
        const entries = await readDir(selected);
        let addedCount = 0;

        for (const entry of entries) {
          if (entry.name && entry.name.endsWith(".txt")) {
            const title = entry.name.replace(".txt", "");
            const fullPath = `${selected}/${entry.name}`;
            try {
              await addBook(title, fullPath, "txt");
              addedCount++;
            } catch (e) {
              // Book already exists, skip
            }
          }
        }

        const [loadedBooks] = await Promise.all([getAllBooks()]);
        setBooks(loadedBooks);
        alert(`已扫描并添加 ${addedCount} 本书`);
      }
    } catch (err) {
      console.error("Failed to scan folder:", err);
    }
  };

  const handleAddSingleBook = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Text Files", extensions: ["txt"] }],
      });

      if (selected && typeof selected === "string") {
        const parts = selected.split("/");
        const title = parts[parts.length - 1].replace(".txt", "");
        await addBook(title, selected, "txt");
        const [loadedBooks] = await Promise.all([getAllBooks()]);
        setBooks(loadedBooks);
      }
    } catch (err) {
      console.error("Failed to add book:", err);
    }
  };

  const handleAddCustomTag = async () => {
    if (!newTagName.trim()) return;
    await addTag(newTagName.trim(), "custom");
    setNewTagName("");
    const [loadedTags] = await Promise.all([getAllTags()]);
    setTags(loadedTags);
  };

  const handleToggleTagFilter = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const handleToggleBookTag = async (book: Book, tagId: string) => {
    if (book.tags.includes(tagId)) {
      await removeTagFromBook(book.id, tagId);
    } else {
      await addTagToBook(book.id, tagId);
    }
    const [loadedBooks] = await Promise.all([getAllBooks()]);
    setBooks(loadedBooks);
  };

  const handleDeleteTag = async (tagId: string) => {
    await deleteTag(tagId);
    const [loadedTags] = await Promise.all([getAllTags()]);
    setTags(loadedTags);
  };

  const handleDeleteBook = async (bookId: string) => {
    await deleteBook(bookId);
    const [loadedBooks] = await Promise.all([getAllBooks()]);
    setBooks(loadedBooks);
    setEditingBook(null);
  };

  const statusTags = tags.filter((t) => t.type === "status");
  const genreTags = tags.filter((t) => t.type === "genre");
  const customTags = tags.filter((t) => t.type === "custom");

  return (
    <div className={`book-library ${className}`}>
      <div className="library-header">
        <h2>书库</h2>
        <div className="header-actions">
          <button onClick={handleAddSingleBook}>添加书籍</button>
          <button onClick={handleScanFolder}>扫描文件夹</button>
          <button onClick={() => setShowTagManager(!showTagManager)}>
            {showTagManager ? "关闭标签管理" : "管理标签"}
          </button>
        </div>
      </div>

      <div className="library-search">
        <input
          type="text"
          placeholder="搜索书名..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {showTagManager && (
        <div className="tag-manager">
          <h3>标签管理</h3>
          <div className="tag-section">
            <span className="tag-type">状态标签:</span>
            {statusTags.map((t) => (
              <span key={t.id} className="tag-chip status">
                {t.name}
              </span>
            ))}
          </div>
          <div className="tag-section">
            <span className="tag-type">类型标签:</span>
            {genreTags.map((t) => (
              <span key={t.id} className="tag-chip genre">
                {t.name}
              </span>
            ))}
          </div>
          <div className="tag-section">
            <span className="tag-type">自定义标签:</span>
            {customTags.map((t) => (
              <span key={t.id} className="tag-chip custom">
                {t.name}
                <button onClick={() => handleDeleteTag(t.id)}>×</button>
              </span>
            ))}
          </div>
          <div className="add-tag">
            <input
              type="text"
              placeholder="新标签名称"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
            />
            <button onClick={handleAddCustomTag}>添加</button>
          </div>
        </div>
      )}

      <div className="tag-filters">
        {statusTags.map((t) => (
          <button
            key={t.id}
            className={`filter-tag ${selectedTags.includes(t.id) ? "active" : ""}`}
            onClick={() => handleToggleTagFilter(t.id)}
          >
            {t.name}
          </button>
        ))}
        {genreTags.map((t) => (
          <button
            key={t.id}
            className={`filter-tag ${selectedTags.includes(t.id) ? "active" : ""}`}
            onClick={() => handleToggleTagFilter(t.id)}
          >
            {t.name}
          </button>
        ))}
        {customTags.map((t) => (
          <button
            key={t.id}
            className={`filter-tag custom ${selectedTags.includes(t.id) ? "active" : ""}`}
            onClick={() => handleToggleTagFilter(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="book-list">
        {filteredBooks.length === 0 ? (
          <div className="empty-state">
            <p>没有找到书籍</p>
            <p className="hint">点击"扫描文件夹"导入TXT文件</p>
          </div>
        ) : (
          filteredBooks.map((book) => (
            <div
              key={book.id}
              className={`book-item ${editingBook?.id === book.id ? "editing" : ""}`}
              onClick={() => onSelectBook(book)}
            >
              <div className="book-info">
                <span className="book-title">{book.title}</span>
                <div className="book-tags">
                  {book.tags.map((tagId) => {
                    const tag = tags.find((t) => t.id === tagId);
                    return tag ? (
                      <span key={tagId} className={`book-tag ${tag.type}`}>
                        {tag.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
              <div className="book-actions">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingBook(editingBook?.id === book.id ? null : book);
                  }}
                >
                  编辑
                </button>
              </div>

              {editingBook?.id === book.id && (
                <div className="book-edit-panel" onClick={(e) => e.stopPropagation()}>
                  <div className="edit-tags">
                    <span className="edit-label">标签:</span>
                    {tags.map((t) => (
                      <button
                        key={t.id}
                        className={`tag-toggle ${book.tags.includes(t.id) ? "active" : ""}`}
                        onClick={() => handleToggleBookTag(book, t.id)}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                  <button className="delete-book" onClick={() => handleDeleteBook(book.id)}>
                    删除书籍
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
