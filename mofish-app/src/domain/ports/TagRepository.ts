import { TagDTO, TagType } from "../models";

export interface TagRepository {
  getAll(): Promise<TagDTO[]>;
  add(name: string, type: TagType): Promise<string>;
  delete(id: string): Promise<void>;
  addTagToBook(bookId: string, tagId: string): Promise<void>;
  removeTagFromBook(bookId: string, tagId: string): Promise<void>;
}
