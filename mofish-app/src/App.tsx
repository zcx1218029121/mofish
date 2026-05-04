import { useState, useEffect } from "react";
import { BookLibrary } from "./components/BookLibrary";
import { BookReader } from "./components/BookReader";
import { BubbleSettings } from "./components/BubbleSettings";
import { Book } from "./db";

type View = "bubble" | "library" | "reader";

interface ActiveBook {
  path: string;
  id: string;
}

function App() {
  const [view, setView] = useState<View>("bubble");
  const [activeBook, setActiveBook] = useState<ActiveBook | null>(null);

  // Handle global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+, opens bubble settings
      if (e.ctrlKey && e.key === ",") {
        e.preventDefault();
        setView("bubble");
        return;
      }

      // Escape handling
      if (e.key === "Escape") {
        if (view === "reader") {
          setView("bubble");
          setActiveBook(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view]);

  const handleSelectBook = (book: Book) => {
    setActiveBook({ path: book.path, id: book.id });
    setView("reader");
  };

  const handleSelectBookPath = (path: string) => {
    setActiveBook({ path, id: "" });
    setView("reader");
  };

  const handleBack = () => {
    setView("bubble");
    setActiveBook(null);
  };

  const handleOpenLibrary = () => {
    setView("library");
  };

  if (view === "bubble") {
    return (
      <>
        <BubbleSettings />
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            zIndex: 9999,
          }}
        >
          <button
            onClick={handleOpenLibrary}
            style={{
              padding: "8px 16px",
              fontSize: "12px",
              backgroundColor: "rgba(50, 50, 50, 0.9)",
              color: "#fff",
              border: "1px solid #555",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            打开书库
          </button>
        </div>
      </>
    );
  }

  if (view === "library") {
    return (
      <BookLibrary
        onSelectBook={handleSelectBook}
        onSelectBookPath={handleSelectBookPath}
      />
    );
  }

  if (view === "reader" && activeBook) {
    return (
      <BookReader
        bookPath={activeBook.path}
        bookId={activeBook.id}
        onBack={handleBack}
      />
    );
  }

  return null;
}

export default App;
