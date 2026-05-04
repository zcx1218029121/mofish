export interface BookDTO {
  id: string;
  title: string;
  path: string;
  format: "txt" | "epub";
  addedAt: number;
  lastReadAt: number | null;
  lastPosition: number;
  tags: string[];
}

export interface TagDTO {
  id: string;
  name: string;
  type: TagType;
}

export interface BookmarkDTO {
  id: string;
  bookId: string;
  position: number;
  note: string;
  createdAt: number;
}

export type TagType = "status" | "genre" | "custom";
