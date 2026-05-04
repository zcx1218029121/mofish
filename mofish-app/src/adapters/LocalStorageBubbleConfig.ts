import { BubbleConfigStore, BubbleConfig } from "../domain/ports/BubbleConfigStore";

const STORAGE_KEY = "mofish-bubble-config";

export class LocalStorageBubbleConfig implements BubbleConfigStore {
  async load(): Promise<BubbleConfig | null> {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  async save(config: BubbleConfig): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
}
