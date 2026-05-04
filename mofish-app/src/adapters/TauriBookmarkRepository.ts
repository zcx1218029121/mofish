import { BookmarkRepository } from "../domain/ports/BookmarkRepository";
import { BookmarkDTO } from "../domain/models";
import { getBookmarks, addBookmark, deleteBookmark } from "../db";

export class TauriBookmarkRepository implements BookmarkRepository {
  async getByBookId(bookId: string): Promise<BookmarkDTO[]> {
    return getBookmarks(bookId);
  }

  async add(bookId: string, position: number, note: string): Promise<string> {
    return addBookmark(bookId, position, note);
  }

  async delete(id: string): Promise<void> {
    return deleteBookmark(id);
  }
}
