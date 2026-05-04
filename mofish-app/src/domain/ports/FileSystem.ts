export interface FileEntry {
  name: string;
  path: string;
  isFile: boolean;
}

export interface FileSystem {
  openFolderDialog(): Promise<string | null>;
  openFileDialog(): Promise<string | null>;
  readDir(path: string): Promise<FileEntry[]>;
  readTextFile(path: string): Promise<string>;
}
