import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { FileSystem } from "../domain/ports/FileSystem";
import { BookRepository } from "../domain/ports/BookRepository";
import { TagRepository } from "../domain/ports/TagRepository";
import { BookDTO, TagDTO } from "../domain/models";
import { searchBooks } from "../pinyin";

interface BookLibraryProps {
  bookRepository: BookRepository;
  tagRepository: TagRepository;
  fileSystem: FileSystem;
  onSelectBook: (book: BookDTO) => void;
  onSelectBookPath: (path: string) => void;
  onBack?: () => void;
  className?: string;
}

export function BookLibrary({
  bookRepository,
  tagRepository,
  fileSystem,
  onSelectBook,
  onBack,
  className = "",
}: BookLibraryProps) {
  const [books, setBooks] = useState<BookDTO[]>([]);
  const [tags, setTags] = useState<TagDTO[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [editingBook, setEditingBook] = useState<BookDTO | null>(null);

  const loadData = async () => {
    const [loadedBooks, loadedTags] = await Promise.all([
      bookRepository.getAll(),
      tagRepository.getAll(),
    ]);
    setBooks(loadedBooks);
    setTags(loadedTags);
  };

  useEffect(() => {
    loadData();
  }, []);

  // First filter by tags, then by search query
  const tagFilteredBooks =
    selectedTags.length > 0
      ? books.filter((book) =>
          selectedTags.some((tag) => book.tags.includes(tag))
        )
      : books;

  const filteredBooks = searchQuery
    ? searchBooks(tagFilteredBooks, searchQuery)
    : tagFilteredBooks;

  const handleScanFolder = async () => {
    try {
      const selected = await fileSystem.openFolderDialog();

      if (selected) {
        const entries = await fileSystem.readDir(selected);
        let addedCount = 0;

        for (const entry of entries) {
          if (entry.isFile && entry.name.endsWith(".txt")) {
            const title = entry.name.replace(".txt", "");
            try {
              await bookRepository.add(title, entry.path, "txt");
              addedCount++;
            } catch (e) {
              // Book already exists, skip
            }
          }
        }

        await loadData();
        alert(`已扫描并添加 ${addedCount} 本书`);
      }
    } catch (err) {
      console.error("Failed to scan folder:", err);
    }
  };

  const handleAddSingleBook = async () => {
    try {
      const selected = await fileSystem.openFileDialog();

      if (selected) {
        const parts = selected.split("/");
        const title = parts[parts.length - 1].replace(".txt", "");
        await bookRepository.add(title, selected, "txt");
        await loadData();
      }
    } catch (err) {
      console.error("Failed to add book:", err);
    }
  };

  const handleAddCustomTag = async () => {
    if (!newTagName.trim()) return;
    await tagRepository.add(newTagName.trim(), "custom");
    setNewTagName("");
    await loadData();
  };

  const handleToggleTagFilter = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const handleToggleBookTag = async (book: BookDTO, tagId: string) => {
    if (book.tags.includes(tagId)) {
      await tagRepository.removeTagFromBook(book.id, tagId);
    } else {
      await tagRepository.addTagToBook(book.id, tagId);
    }
    await loadData();
  };

  const handleDeleteTag = async (tagId: string) => {
    await tagRepository.delete(tagId);
    await loadData();
  };

  const handleDeleteBook = async (bookId: string) => {
    await bookRepository.delete(bookId);
    await loadData();
    setEditingBook(null);
  };

  const handleClose = async () => {
    try {
      const win = getCurrentWindow();
      await win.hide();
    } catch (err) {
      console.error("Failed to hide window:", err);
    }
  };

  const statusTags = tags.filter((t) => t.type === "status");
  const genreTags = tags.filter((t) => t.type === "genre");
  const customTags = tags.filter((t) => t.type === "custom");

  return (
    <div className={`book-library ${className}`}>
      {/* 可拖拽标题栏 */}
      <div
        data-tauri-drag-region
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          borderBottom: "1px solid #333",
          cursor: "move",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <span style={{ fontSize: "12px", color: "#888" }}>书库</span>
        <div style={{ display: "flex", gap: "8px" }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                padding: "2px 8px",
                fontSize: "11px",
                backgroundColor: "rgba(60, 60, 60, 0.9)",
                color: "#aaa",
                border: "1px solid #555",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              返回
            </button>
          )}
          <button
            onClick={handleClose}
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              backgroundColor: "#e05050",
              border: "none",
              cursor: "pointer",
              fontSize: "10px",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
        </div>
      </div>

      <div className="library-header" style={{ padding: "8px 12px" }}>
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
