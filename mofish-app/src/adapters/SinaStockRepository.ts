import { StockDTO } from "../domain/models";
import { StockRepository } from "../domain/ports/StockRepository";

export class SinaStockRepository implements StockRepository {
  private stocks: StockDTO[] = [];
  private refreshInterval: number | null = null;

  async getAll(): Promise<StockDTO[]> {
    return [...this.stocks];
  }

  async add(code: string): Promise<StockDTO> {
    // Normalize code: add prefix if needed
    const normalizedCode = this.normalizeCode(code);

    // Fetch stock info from Sina Finance
    const stock = await this.fetchStockInfo(normalizedCode);

    // Avoid duplicates
    if (this.stocks.find(s => s.code === normalizedCode)) {
      throw new Error("Stock already in watchlist");
    }

    this.stocks.push(stock);
    return stock;
  }

  async remove(code: string): Promise<void> {
    const normalizedCode = this.normalizeCode(code);
    this.stocks = this.stocks.filter(s => s.code !== normalizedCode);
  }

  async refreshPrices(): Promise<void> {
    if (this.stocks.length === 0) return;

    const codes = this.stocks.map(s => s.code).join(",");
    const url = `https://hq.sinajs.cn/list=${codes}`;

    try {
      const response = await fetch(url);
      const text = await response.text();
      const lines = text.split("\n");

      for (const line of lines) {
        if (!line.trim()) continue;

        const match = line.match(/hq_(\w+)_str="([^"]+)"/);
        if (match) {
          const code = match[1];
          const data = match[2].split(",");
          this.updateStockFromSinaData(code, data);
        }
      }
    } catch (err) {
      console.error("Failed to refresh stock prices:", err);
    }
  }

  startAutoRefresh(intervalMs: number = 30000) {
    this.stopAutoRefresh();
    this.refreshInterval = window.setInterval(() => {
      this.refreshPrices();
    }, intervalMs);
  }

  stopAutoRefresh() {
    if (this.refreshInterval !== null) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private normalizeCode(code: string): string {
    // A股: 6开头上海, 0/3开头深圳
    const cleanCode = code.replace(/[^\d]/g, "");
    if (cleanCode.startsWith("6")) {
      return `sh${cleanCode}`;
    } else if (cleanCode.startsWith("0") || cleanCode.startsWith("3")) {
      return `sz${cleanCode}`;
    }
    return cleanCode;
  }

  private async fetchStockInfo(code: string): Promise<StockDTO> {
    const url = `https://hq.sinajs.cn/list=${code}`;

    try {
      const response = await fetch(url);
      const text = await response.text();

      // Parse: hq_str_sh600519="贵州茅台,1680.00,..."
      const match = text.match(/hq_\w+_str="([^"]+)"/);
      if (match) {
        const data = match[1].split(",");
        return this.parseSinaData(code, data);
      }
      throw new Error("Invalid stock code");
    } catch (err) {
      throw new Error(`Failed to fetch stock info: ${code}`);
    }
  }

  private parseSinaData(code: string, data: string[]): StockDTO {
    const name = data[0];
    const price = parseFloat(data[3]) || 0;
    const yesterdayClose = parseFloat(data[2]) || 0;
    const change = price - yesterdayClose;
    const changePercent = yesterdayClose > 0 ? (change / yesterdayClose) * 100 : 0;
    const volume = parseInt(data[8]) || 0;

    return {
      code,
      name,
      price,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      volume,
    };
  }

  private updateStockFromSinaData(code: string, data: string[]) {
    const stock = this.stocks.find(s => s.code === code);
    if (!stock) return;

    stock.name = data[0];
    stock.price = parseFloat(data[3]) || 0;
    const yesterdayClose = parseFloat(data[2]) || 0;
    stock.change = Math.round((stock.price - yesterdayClose) * 100) / 100;
    stock.changePercent = yesterdayClose > 0
      ? Math.round((stock.change / yesterdayClose) * 10000) / 100
      : 0;
    stock.volume = parseInt(data[8]) || 0;
  }
}
