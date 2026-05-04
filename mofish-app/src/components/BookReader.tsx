import { useState, useRef, useEffect, useCallback } from "react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { updateBookPosition, addBookmark, getBookmarks, deleteBookmark, Bookmark } from "../db";

interface BookReaderProps {
  bookPath: string;
  bookId: string;
  onBack: () => void;
  className?: string;
}

export function BookReader({ bookPath, bookId, onBack, className = "" }: BookReaderProps) {
  const [content, setContent] = useState<string>("");
  const [fontSize, setFontSize] = useState(18);
  const [showStatus, setShowStatus] = useState(true);
  const [showProgress, setShowProgress] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [bookmarkNote, setBookmarkNote] = useState("");
  const [showBookmarkInput, setShowBookmarkInput] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);

  const SCROLL_STEP = 100;

  // Load book content
  useEffect(() => {
    const loadBook = async () => {
      try {
        const text = await readTextFile(bookPath);
        setContent(text);
        hasLoadedRef.current = true;
        if (containerRef.current) {
          containerRef.current.scrollTop = 0;
        }
        // Load bookmarks if book has ID
        if (bookId) {
          const loadedBookmarks = await getBookmarks(bookId);
          setBookmarks(loadedBookmarks);
        }
      } catch (err) {
        console.error("Failed to load book:", err);
      }
    };
    loadBook();
    return () => {
      hasLoadedRef.current = false;
    };
  }, [bookPath, bookId]);

  // Save position on unmount or hide
  useEffect(() => {
    return () => {
      if (hasLoadedRef.current && containerRef.current) {
        const position = containerRef.current.scrollTop;
        updateBookPosition(bookId, position);
      }
    };
  }, [bookId]);

  // Save position periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasLoadedRef.current && containerRef.current) {
        const position = containerRef.current.scrollTop;
        updateBookPosition(bookId, position);
      }
    }, 10000); // Save every 10 seconds

    return () => clearInterval(interval);
  }, [bookId]);

  const handleAddBookmark = async () => {
    if (!bookId || !containerRef.current) return;
    const position = containerRef.current.scrollTop;
    await addBookmark(bookId, position, bookmarkNote);
    setBookmarkNote("");
    setShowBookmarkInput(false);
    const loadedBookmarks = await getBookmarks(bookId);
    setBookmarks(loadedBookmarks);
  };

  const handleDeleteBookmark = async (id: string) => {
    await deleteBookmark(id);
    const loadedBookmarks = await getBookmarks(bookId);
    setBookmarks(loadedBookmarks);
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
        case "s":
          e.preventDefault();
          setShowStatus((s) => !s);
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
      <div className={`book-reader ${className}`}>
        <div className="book-empty">
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`book-reader ${className}`}>
      {showStatus && (
        <div className="reader-status">
          <button className="back-btn" onClick={onBack}>
            ← 返回
          </button>
          <span className="book-title">{getBookName()}</span>
          <span className="progress-text">{getProgress()}%</span>
        </div>
      )}

      <div ref={containerRef} className="reader-content">
        <div
          ref={contentRef}
          className="reader-text"
          style={{ fontSize: `${fontSize}px` }}
        >
          {content.split("\n").map((line, i) => (
            <p key={i} className="text-line">
              {line || " "}
            </p>
          ))}
        </div>
      </div>

      {showProgress && (
        <div className="reader-progress">
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
