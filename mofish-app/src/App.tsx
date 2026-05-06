import { useState, useEffect } from "react";
import { BookLibrary } from "./components/BookLibrary";
import { BookReader } from "./components/BookReader";
import { StockView } from "./components/StockView";
import { BubbleSettings } from "./components/BubbleSettings";
import { BubbleWindow } from "./components/BubbleWindow";
import { BubbleHome } from "./components/BubbleHome";
import { TauriBookRepository } from "./adapters/TauriBookRepository";
import { TauriTagRepository } from "./adapters/TauriTagRepository";
import { TauriBookmarkRepository } from "./adapters/TauriBookmarkRepository";
import { TauriFileSystem } from "./adapters/TauriFileSystem";
import { SinaStockRepository } from "./adapters/SinaStockRepository";
import { LocalStorageBubbleConfig } from "./adapters/LocalStorageBubbleConfig";
import { BookDTO } from "./domain/models";

type View = "home" | "library" | "reader" | "stock" | "settings";

interface ActiveBook {
  path: string;
  id: string;
}

// Create repository instances
const bookRepository = new TauriBookRepository();
const tagRepository = new TauriTagRepository();
const bookmarkRepository = new TauriBookmarkRepository();
const fileSystem = new TauriFileSystem();
const stockRepository = new SinaStockRepository();
const configStore = new LocalStorageBubbleConfig();

function App() {
  const [view, setView] = useState<View>("home");
  const [activeBook, setActiveBook] = useState<ActiveBook | null>(null);

  // Handle global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+, opens bubble settings
      if (e.ctrlKey && e.key === ",") {
        e.preventDefault();
        setView("settings");
        return;
      }

      // Escape handling
      if (e.key === "Escape") {
        if (view === "library" || view === "stock" || view === "settings") {
          setView("home");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view]);

  const handleSelectBook = (book: BookDTO) => {
    setActiveBook({ path: book.path, id: book.id });
    setView("reader");
  };

  const handleSelectBookPath = (path: string) => {
    setActiveBook({ path, id: "" });
    setView("reader");
  };

  const handleBack = () => {
    setView("home");
    setActiveBook(null);
  };

  const handleOpenLibrary = () => {
    setView("library");
  };

  const handleOpenStock = () => {
    setView("stock");
  };

  const handleOpenSettings = () => {
    setView("settings");
  };

  // 首页：显示导航入口
  if (view === "home") {
    return (
      <BubbleWindow configStore={configStore} onOpenLibrary={handleOpenLibrary} onOpenSettings={handleOpenSettings}>
        <BubbleHome configStore={configStore} onOpenLibrary={handleOpenLibrary} onOpenSettings={handleOpenSettings} onOpenStock={handleOpenStock} />
      </BubbleWindow>
    );
  }

  // 阅读器在气泡窗口中显示（透明模式）
  if (view === "reader" && activeBook) {
    return (
      <BubbleWindow configStore={configStore} onOpenLibrary={handleOpenLibrary} onOpenSettings={handleOpenSettings} transparent={true}>
        <BookReader
          bookPath={activeBook.path}
          bookId={activeBook.id}
          bookmarkRepository={bookmarkRepository}
          bookRepository={bookRepository}
          fileSystem={fileSystem}
          onBack={handleBack}
        />
      </BubbleWindow>
    );
  }

  // 书库全屏显示（不带标题栏）
  if (view === "library") {
    return (
      <BookLibrary
        bookRepository={bookRepository}
        tagRepository={tagRepository}
        fileSystem={fileSystem}
        onSelectBook={handleSelectBook}
        onSelectBookPath={handleSelectBookPath}
      />
    );
  }

  // 股票全屏显示（不带标题栏）
  if (view === "stock") {
    return <StockView stockRepository={stockRepository} onBack={handleBack} />;
  }

  // 设置在气泡窗口中显示
  if (view === "settings") {
    return (
      <BubbleWindow configStore={configStore} onOpenLibrary={handleOpenLibrary} onOpenSettings={handleOpenSettings}>
        <BubbleSettings configStore={configStore} onOpenLibrary={handleOpenLibrary} onOpenStock={handleOpenStock} />
      </BubbleWindow>
    );
  }

  return null;
}

export default App;
