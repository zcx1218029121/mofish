import { useState, useRef, useEffect, useCallback } from "react";
import { FileSystem } from "../domain/ports/FileSystem";
import { BookmarkRepository } from "../domain/ports/BookmarkRepository";
import { BookRepository } from "../domain/ports/BookRepository";
import { BookmarkDTO } from "../domain/models";

interface BookReaderProps {
  bookPath: string;
  bookId: string;
  bookmarkRepository: BookmarkRepository;
  bookRepository: BookRepository;
  fileSystem: FileSystem;
  onBack: () => void;
  className?: string;
}

export function BookReader({
  bookPath,
  bookId,
  bookmarkRepository,
  bookRepository,
  fileSystem,
  onBack,
  className = "",
}: BookReaderProps) {
  const [content, setContent] = useState<string>("");
  const [fontSize, setFontSize] = useState(18);
  const [showProgress, setShowProgress] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkDTO[]>([]);
  const [bookmarkNote, setBookmarkNote] = useState("");
  const [showBookmarkInput, setShowBookmarkInput] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);

  const SCROLL_STEP = 100;

  const loadBookmarks = async () => {
    if (bookId) {
      const loadedBookmarks = await bookmarkRepository.getByBookId(bookId);
      setBookmarks(loadedBookmarks);
    }
  };

  // Load book content
  useEffect(() => {
    const loadBook = async () => {
      try {
        console.log("Loading book from path:", bookPath);
        const text = await fileSystem.readTextFile(bookPath);
        console.log("Book loaded, length:", text.length);
        setContent(text);
        hasLoadedRef.current = true;
        if (containerRef.current) {
          containerRef.current.scrollTop = 0;
        }
        await loadBookmarks();
      } catch (err) {
        console.error("Failed to load book:", err);
      }
    };
    loadBook();
    return () => {
      hasLoadedRef.current = false;
    };
  }, [bookPath, bookId, fileSystem]);

  // Save position on unmount or hide
  useEffect(() => {
    return () => {
      if (hasLoadedRef.current && containerRef.current && bookId) {
        const position = containerRef.current.scrollTop;
        bookRepository.updatePosition(bookId, position);
      }
    };
  }, [bookId, bookRepository]);

  // Save position periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasLoadedRef.current && containerRef.current && bookId) {
        const position = containerRef.current.scrollTop;
        bookRepository.updatePosition(bookId, position);
      }
    }, 10000); // Save every 10 seconds

    return () => clearInterval(interval);
  }, [bookId, bookRepository]);

  const handleAddBookmark = async () => {
    if (!bookId || !containerRef.current) return;
    const position = containerRef.current.scrollTop;
    await bookmarkRepository.add(bookId, position, bookmarkNote);
    setBookmarkNote("");
    setShowBookmarkInput(false);
    await loadBookmarks();
  };

  const handleDeleteBookmark = async (id: string) => {
    await bookmarkRepository.delete(id);
    await loadBookmarks();
  };

  const handleJumpToBookmark = (position: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTop = position;
    }
    setShowBookmarks(false);
  };

  // Handle j/k scrolling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!content) return;

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "j":
          e.preventDefault();
          scrollBy(SCROLL_STEP);
          break;
        case "k":
          e.preventDefault();
          scrollBy(-SCROLL_STEP);
          break;
        case "J":
        case " ":
        case "ArrowDown":
          e.preventDefault();
          scrollBy(SCROLL_STEP * 3);
          break;
        case "K":
        case "ArrowUp":
          e.preventDefault();
          scrollBy(-SCROLL_STEP * 3);
          break;
        case "+":
        case "=":
          e.preventDefault();
          setFontSize((s) => Math.min(s + 2, 48));
          break;
        case "-":
          e.preventDefault();
          setFontSize((s) => Math.max(s - 2, 12));
          break;
        case "?":
          e.preventDefault();
          setShowHelp((h) => !h);
          break;
        case "p":
          e.preventDefault();
          setShowProgress((p) => !p);
          break;
        case "m":
          e.preventDefault();
          if (bookId) {
            setShowBookmarkInput(true);
          }
          break;
        case "b":
          e.preventDefault();
          setShowBookmarks((s) => !s);
          break;
        case "Escape":
          e.preventDefault();
          if (showBookmarkInput) {
            setShowBookmarkInput(false);
            setBookmarkNote("");
          } else if (showBookmarks) {
            setShowBookmarks(false);
          } else {
            onBack();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [content, onBack, bookId, showBookmarkInput, showBookmarks]);

  const scrollBy = useCallback((delta: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTop += delta;
    }
  }, []);

  const updateVisibleRange = useCallback(() => {
    // Will be implemented in Task 2
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop } = containerRef.current;
      if (scrollTop > 10) {
        setShowControls(true);
      }
      updateVisibleRange();
    }
  }, [updateVisibleRange]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && e.clientY - rect.top < 50) {
      setShowControls(true);
    }
  }, []);

  const getProgress = () => {
    if (!containerRef.current) return 0;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    if (scrollHeight === 0) return 0;
    return Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
  };

  const getBookName = () => {
    const parts = bookPath.split("/");
    return parts[parts.length - 1].replace(".txt", "");
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  if (!content) {
    return (
      <div className={`book-reader ${className}`} data-tauri-drag-region>
        <div className="book-empty">
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`book-reader ${className}`}
      data-tauri-drag-region
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "transparent",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 固定标题栏 - 独立于滚动容器 */}
      <div
        className="reader-status"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          opacity: showControls ? 1 : 0,
          transition: "opacity 0.2s",
          pointerEvents: showControls ? "auto" : "none",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <span className="book-title">{getBookName()}</span>
        <span className="progress-text">{getProgress()}%</span>
      </div>

      {/* 滚动内容区 - 使用 relative 定位 */}
      <div
        ref={containerRef}
        className="reader-content"
        style={{
          flex: 1,
          overflowY: "auto",
          backgroundColor: "transparent",
          position: "relative",
        }}
        onScroll={handleScroll}
        onMouseMove={handleMouseMove}
      >
        <div
          ref={contentRef}
          className="reader-text"
          style={{
            fontSize: `${fontSize}px`,
            backgroundColor: "transparent",
            padding: "20px 40px",
          }}
        >
          {content.split("\n").map((line, i) => (
            <p key={i} className="text-line">
              {line || " "}
            </p>
          ))}
        </div>
      </div>

      {showProgress && (
        <div className="reader-progress" style={{ opacity: showControls ? 1 : 0.3, transition: "opacity 0.2s" }}>
          <div className="progress-bar" style={{ width: `${getProgress()}%` }} />
        </div>
      )}

      {showHelp && (
        <div className="reader-help">
          <h3>快捷键</h3>
          <ul>
            <li><kbd>j</kbd> / <kbd>k</kbd> — 上/下滚动</li>
            <li><kbd>J</kbd> / <kbd>K</kbd> 或 <kbd>空格</kbd> — 快速滚动</li>
            <li><kbd>+</kbd> / <kbd>-</kbd> — 增大/减小字体</li>
            <li><kbd>m</kbd> — 添加书签</li>
            <li><kbd>b</kbd> — 显示/隐藏书签列表</li>
            <li><kbd>s</kbd> — 显示/隐藏状态栏</li>
            <li><kbd>p</kbd> — 显示/隐藏进度条</li>
            <li><kbd>Esc</kbd> — 返回书库</li>
            <li><kbd>?</kbd> — 显示/隐藏帮助</li>
          </ul>
        </div>
      )}

      {showBookmarkInput && (
        <div className="bookmark-input-overlay">
          <div className="bookmark-input-panel">
            <h3>添加书签</h3>
            <input
              type="text"
              placeholder="书签备注（可选）"
              value={bookmarkNote}
              onChange={(e) => setBookmarkNote(e.target.value)}
              autoFocus
            />
            <div className="bookmark-actions">
              <button onClick={handleAddBookmark}>保存</button>
              <button onClick={() => { setShowBookmarkInput(false); setBookmarkNote(""); }}>取消</button>
            </div>
          </div>
        </div>
      )}

      {showBookmarks && (
        <div className="bookmarks-panel">
          <h3>书签列表</h3>
          {bookmarks.length === 0 ? (
            <p className="no-bookmarks">暂无书签，按 m 添加</p>
          ) : (
            <ul className="bookmarks-list">
              {bookmarks.map((bm) => (
                <li key={bm.id}>
                  <div className="bookmark-item" onClick={() => handleJumpToBookmark(bm.position)}>
                    <span className="bookmark-pos">{Math.round((bm.position / (containerRef.current?.scrollHeight || 1)) * 100)}%</span>
                    <span className="bookmark-note">{bm.note || "无备注"}</span>
                    <span className="bookmark-time">{formatTime(bm.createdAt)}</span>
                  </div>
                  <button className="delete-bookmark" onClick={() => handleDeleteBookmark(bm.id)}>×</button>
                </li>
              ))}
            </ul>
          )}
          <button className="close-bookmarks" onClick={() => setShowBookmarks(false)}>关闭</button>
        </div>
      )}
    </div>
  );
}
