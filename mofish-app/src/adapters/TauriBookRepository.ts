import { BookRepository } from "../domain/ports/BookRepository";
import { BookDTO } from "../domain/models";
import {
  getAllBooks,
  addBook,
  deleteBook,
  updateBookPosition,
} from "../db";

export class TauriBookRepository implements BookRepository {
  async getAll(): Promise<BookDTO[]> {
    return getAllBooks();
  }

  async getById(id: string): Promise<BookDTO | null> {
    const books = await getAllBooks();
    return books.find((b) => b.id === id) || null;
  }

  async add(title: string, path: string, format: "txt" | "epub" = "txt"): Promise<string> {
    return addBook(title, path, format);
  }

  async delete(id: string): Promise<void> {
    return deleteBook(id);
  }

  async updatePosition(id: string, position: number): Promise<void> {
    return updateBookPosition(id, position);
  }
}
