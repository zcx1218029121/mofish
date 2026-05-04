import { FileSystem, FileEntry } from "../domain/ports/FileSystem";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir, readTextFile } from "@tauri-apps/plugin-fs";

export class TauriFileSystem implements FileSystem {
  async openFolderDialog(): Promise<string | null> {
    const result = await open({
      directory: true,
      multiple: false,
    });
    return result as string | null;
  }

  async openFileDialog(): Promise<string | null> {
    const result = await open({
      multiple: false,
      filters: [{ name: "Text Files", extensions: ["txt"] }],
    });
    return result as string | null;
  }

  async readDir(path: string): Promise<FileEntry[]> {
    const entries = await readDir(path);
    return entries.map((entry) => ({
      name: entry.name || "",
      path: `${path}/${entry.name}`,
      isFile: entry.isFile ?? false,
    }));
  }

  async readTextFile(path: string): Promise<string> {
    return readTextFile(path);
  }
}
