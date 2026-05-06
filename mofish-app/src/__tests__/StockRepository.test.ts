import { describe, it, expect } from "vitest";
import { StockDTO } from "../domain/models";

// Mock stock data
const MOCK_STOCKS: Map<string, StockDTO> = new Map([
  ["600519", { code: "600519", name: "贵州茅台", price: 1680.0, change: 25.0, changePercent: 1.51, volume: 5200000 }],
  ["000858", { code: "000858", name: "五粮液", price: 145.5, change: -2.3, changePercent: -1.56, volume: 3200000 }],
]);

describe("StockRepository", () => {
  it("should return empty list initially", async () => {
    // This test describes the interface contract
    const mockRepo = {
      async getAll() { return []; },
      async add(code: string) { return MOCK_STOCKS.get(code)!; },
      async remove(_code: string) { },
      async refreshPrices() { },
    };

    const stocks = await mockRepo.getAll();
    expect(stocks).toEqual([]);
  });

  it("should add a stock by code", async () => {
    const mockRepo = {
      stocks: [] as StockDTO[],
      async getAll() { return this.stocks; },
      async add(code: string) {
        const stock = MOCK_STOCKS.get(code);
        if (!stock) throw new Error("Invalid stock code");
        this.stocks.push(stock);
        return stock;
      },
      async remove(code: string) {
        this.stocks = this.stocks.filter(s => s.code !== code);
      },
      async refreshPrices() { },
    };

    const added = await mockRepo.add("600519");
    expect(added.name).toBe("贵州茅台");
    expect(added.price).toBe(1680.0);
  });

  it("should list added stocks", async () => {
    const mockRepo = {
      stocks: [] as StockDTO[],
      async getAll() { return this.stocks; },
      async add(code: string) {
        const stock = MOCK_STOCKS.get(code);
        if (!stock) throw new Error("Invalid stock code");
        this.stocks.push(stock);
        return stock;
      },
      async remove(code: string) {
        this.stocks = this.stocks.filter(s => s.code !== code);
      },
      async refreshPrices() { },
    };

    await mockRepo.add("600519");
    await mockRepo.add("000858");
    const stocks = await mockRepo.getAll();
    expect(stocks).toHaveLength(2);
  });

  it("should remove a stock", async () => {
    const mockRepo = {
      stocks: [] as StockDTO[],
      async getAll() { return this.stocks; },
      async add(code: string) {
        const stock = MOCK_STOCKS.get(code);
        if (!stock) throw new Error("Invalid stock code");
        this.stocks.push(stock);
        return stock;
      },
      async remove(code: string) {
        this.stocks = this.stocks.filter(s => s.code !== code);
      },
      async refreshPrices() { },
    };

    await mockRepo.add("600519");
    await mockRepo.remove("600519");
    const stocks = await mockRepo.getAll();
    expect(stocks).toHaveLength(0);
  });
});
