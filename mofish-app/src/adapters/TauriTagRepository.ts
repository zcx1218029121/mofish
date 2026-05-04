import { TagRepository } from "../domain/ports/TagRepository";
import { TagDTO, TagType } from "../domain/models";
import {
  getAllTags,
  addTag,
  deleteTag,
  addTagToBook,
  removeTagFromBook,
} from "../db";

export class TauriTagRepository implements TagRepository {
  async getAll(): Promise<TagDTO[]> {
    return getAllTags();
  }

  async add(name: string, type: TagType): Promise<string> {
    return addTag(name, type);
  }

  async delete(id: string): Promise<void> {
    return deleteTag(id);
  }

  async addTagToBook(bookId: string, tagId: string): Promise<void> {
    return addTagToBook(bookId, tagId);
  }

  async removeTagFromBook(bookId: string, tagId: string): Promise<void> {
    return removeTagFromBook(bookId, tagId);
  }
}
