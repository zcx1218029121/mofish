import { useState } from "react";
import { BookLibrary } from "./components/BookLibrary";
import { BookReader } from "./components/BookReader";
import { Book } from "./db";

type View = "library" | "reader";

interface ActiveBook {
  path: string;
  id: string;
}

function App() {
  const [view, setView] = useState<View>("library");
  const [activeBook, setActiveBook] = useState<ActiveBook | null>(null);

  const handleSelectBook = (book: Book) => {
    setActiveBook({ path: book.path, id: book.id });
    setView("reader");
  };

  const handleSelectBookPath = (path: string) => {
    // For books not in library yet, create a temp path
    setActiveBook({ path, id: "" });
    setView("reader");
  };

  const handleBack = () => {
    setView("library");
    setActiveBook(null);
  };

  return (
    <div className="app">
      {view === "library" && (
        <BookLibrary onSelectBook={handleSelectBook} onSelectBookPath={handleSelectBookPath} />
      )}
      {view === "reader" && activeBook && (
        <BookReader bookPath={activeBook.path} bookId={activeBook.id} onBack={handleBack} />
      )}
    </div>
  );
}

export default App;
