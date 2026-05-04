import { BookDTO } from "../models";

export interface BookRepository {
  getAll(): Promise<BookDTO[]>;
  getById(id: string): Promise<BookDTO | null>;
  add(title: string, path: string, format?: "txt" | "epub"): Promise<string>;
  delete(id: string): Promise<void>;
  updatePosition(id: string, position: number): Promise<void>;
}
