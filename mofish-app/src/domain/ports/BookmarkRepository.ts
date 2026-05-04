import { BookmarkDTO } from "../models";

export interface BookmarkRepository {
  getByBookId(bookId: string): Promise<BookmarkDTO[]>;
  add(bookId: string, position: number, note: string): Promise<string>;
  delete(id: string): Promise<void>;
}
