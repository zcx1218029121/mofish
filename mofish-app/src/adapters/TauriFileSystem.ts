import { FileSystem, FileEntry } from "../domain/ports/FileSystem";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir, readTextFile, readFile } from "@tauri-apps/plugin-fs";

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
    try {
      // Try UTF-8 first
      const text = await readTextFile(path);
      // Check for garbled Chinese (common replacement character)
      if (text.includes('�')) {
        // Fallback to GBK
        return await this.readWithEncoding(path, 'gbk');
      }
      return text;
    } catch {
      // If UTF-8 fails, try GBK
      return await this.readWithEncoding(path, 'gbk');
    }
  }

  private async readWithEncoding(path: string, encoding: string): Promise<string> {
    const bytes = await readFile(path);
    try {
      const decoder = new TextDecoder(encoding);
      return decoder.decode(new Uint8Array(bytes));
    } catch {
      return new TextDecoder('latin1').decode(new Uint8Array(bytes));
    }
  }
}
