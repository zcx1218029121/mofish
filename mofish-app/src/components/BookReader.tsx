import { useState, useRef, useEffect, useCallback } from "react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { updateBookPosition } from "../db";

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
      } catch (err) {
        console.error("Failed to load book:", err);
      }
    };
    loadBook();
    return () => {
      hasLoadedRef.current = false;
    };
  }, [bookPath]);

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
        case "Escape":
          e.preventDefault();
          onBack();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [content, onBack]);

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
            <li><kbd>s</kbd> — 显示/隐藏状态栏</li>
            <li><kbd>p</kbd> — 显示/隐藏进度条</li>
            <li><kbd>Esc</kbd> — 返回书库</li>
            <li><kbd>?</kbd> — 显示/隐藏帮助</li>
          </ul>
        </div>
      )}
    </div>
  );
}
