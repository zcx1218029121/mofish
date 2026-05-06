import { StockDTO } from "../models";

export interface StockRepository {
  getAll(): Promise<StockDTO[]>;
  add(code: string): Promise<StockDTO>;
  remove(code: string): Promise<void>;
  refreshPrices(): Promise<void>;
  startAutoRefresh(intervalMs?: number): void;
  stopAutoRefresh(): void;
}
