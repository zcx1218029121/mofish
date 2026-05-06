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
  const [lines, setLines] = useState<string[]>([]);
  const [fontSize, setFontSize] = useState(18);
  const [showProgress, setShowProgress] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkDTO[]>([]);
  const [bookmarkNote, setBookmarkNote] = useState("");
  const [showBookmarkInput, setShowBookmarkInput] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);
  const hideTimerRef = useRef<number | null>(null);

  const SCROLL_STEP = 100;
  const LINE_HEIGHT = 32;

  const loadBookmarks = useCallback(async () => {
    if (bookId) {
      const loadedBookmarks = await bookmarkRepository.getByBookId(bookId);
      setBookmarks(loadedBookmarks);
    }
  }, [bookId, bookmarkRepository]);

  // Load book content
  useEffect(() => {
    const loadBook = async () => {
      try {
        const text = await fileSystem.readTextFile(bookPath);
        setLines(text.split("\n"));
        hasLoadedRef.current = true;
        await loadBookmarks();

        // Restore last reading position if bookId exists
        if (bookId && containerRef.current) {
          const book = await bookRepository.getById(bookId);
          if (book && book.lastPosition > 0) {
            // Delay to ensure DOM is rendered
            setTimeout(() => {
              if (containerRef.current) {
                containerRef.current.scrollTop = book.lastPosition;
              }
            }, 100);
          }
        }
      } catch (err) {
        console.error("Failed to load book:", err);
      }
    };
    loadBook();
    return () => {
      hasLoadedRef.current = false;
    };
  }, [bookPath, bookId, fileSystem, loadBookmarks, bookRepository]);

  // Save position periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasLoadedRef.current && bookId && containerRef.current) {
        const currentPosition = containerRef.current.scrollTop;
        bookRepository.updatePosition(bookId, currentPosition);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [bookId, bookRepository]);

  // Cleanup hide timer on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, []);

  const handleAddBookmark = useCallback(async () => {
    if (!bookId) return;
    await bookmarkRepository.add(bookId, scrollTop, bookmarkNote);
    setBookmarkNote("");
    setShowBookmarkInput(false);
    await loadBookmarks();
  }, [bookId, bookmarkRepository, bookmarkNote, scrollTop, loadBookmarks]);

  const handleDeleteBookmark = useCallback(async (id: string) => {
    await bookmarkRepository.delete(id);
    await loadBookmarks();
  }, [bookRepository, loadBookmarks]);

  const handleJumpToBookmark = useCallback((position: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTop = position;
    }
    setShowBookmarks(false);
  }, []);

  const scrollBy = useCallback((pageDelta: number) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    // 使用容器可视高度的一定比例作为一页的滚动量
    const pageHeight = container.clientHeight * 0.8;
    const delta = pageHeight * pageDelta;
    const newScrollTop = Math.max(0, container.scrollTop + delta);
    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    container.scrollTop = Math.min(newScrollTop, maxScrollTop);
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && e.clientY - rect.top < 50) {
      setShowControls(true);
    }
    // Clear any pending hide timer
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Delay hide controls after 100ms
    hideTimerRef.current = window.setTimeout(() => {
      setShowControls(false);
      hideTimerRef.current = null;
    }, 100);
  }, []);

  const handleContentMouseEnter = useCallback(() => {
    // Cancel pending hide timer when mouse enters content area
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  // Handle j/k scrolling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lines.length === 0) return;

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "j":
          e.preventDefault();
          scrollBy(0.5); // 半页
          break;
        case "k":
          e.preventDefault();
          scrollBy(-0.5); // 半页
          break;
        case "J":
        case " ":
        case "ArrowDown":
          e.preventDefault();
          scrollBy(1); // 一页
          break;
        case "K":
        case "ArrowUp":
          e.preventDefault();
          scrollBy(-1); // 一页
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
  }, [lines.length, onBack, bookId, showBookmarkInput, showBookmarks, scrollBy]);

  const getProgress = () => {
    if (lines.length === 0) return 0;
    const container = containerRef.current;
    if (!container) return 0;
    const currentScrollTop = container.scrollTop;
    const maxScroll = container.scrollHeight - container.clientHeight;
    if (maxScroll <= 0) return 100;
    return Math.round((currentScrollTop / maxScroll) * 100);
  };

  const getBookName = () => {
    const parts = bookPath.split("/");
    return parts[parts.length - 1].replace(".txt", "");
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  if (lines.length === 0) {
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
        minHeight: 0,
        backgroundColor: "transparent",
      }}
    >
      {/* 标题栏 - 固定在顶部 */}
      <div
        className="reader-status"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          opacity: showControls ? 1 : 0,
          transition: "opacity 0.2s",
          pointerEvents: showControls ? "auto" : "none",
          height: "36px",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <span className="book-title">{getBookName()}</span>
        <span className="progress-text">{getProgress()}%</span>
      </div>

      {/* 正文区 - 使用原生滚动 */}
      <div
        ref={containerRef}
        className="reader-content"
        style={{
          flex: 1,
          overflowY: "auto",
          backgroundColor: "transparent",
          marginTop: "36px",
          marginBottom: "3px",
        }}
        onScroll={handleScroll}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleContentMouseEnter}
      >
        <div
          style={{
            fontSize: `${fontSize}px`,
            backgroundColor: "transparent",
            padding: "20px 40px",
          }}
        >
          {lines.map((line, idx) => (
            <p key={idx} style={{ margin: 0, minHeight: `${LINE_HEIGHT}px`, lineHeight: 1.8 }}>
              {line || " "}
            </p>
          ))}
        </div>
      </div>

      {/* 进度条 - 固定在底部 */}
      {showProgress && (
        <div
          className="reader-progress"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            opacity: showControls ? 1 : 0.3,
            transition: "opacity 0.2s",
            height: "3px",
            zIndex: 10,
          }}
        >
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
                    <span className="bookmark-pos">{Math.round((bm.position / (lines.length * LINE_HEIGHT)) * 100)}%</span>
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
