export interface BubbleConfig {
  opacity: number;
  borderRadius: number;
  width: number;
  height: number;
  color: string;
}

export interface BubbleConfigStore {
  load(): Promise<BubbleConfig | null>;
  save(config: BubbleConfig): Promise<void>;
}
