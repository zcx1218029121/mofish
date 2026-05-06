import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { StockRepository } from "../domain/ports/StockRepository";
import { StockDTO } from "../domain/models";

interface StockViewProps {
  stockRepository: StockRepository;
  onBack: () => void;
  className?: string;
}

export function StockView({ stockRepository, onBack, className = "" }: StockViewProps) {
  const [stocks, setStocks] = useState<StockDTO[]>([]);
  const [newCode, setNewCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load stocks on mount
  useEffect(() => {
    loadStocks();
    stockRepository.startAutoRefresh(30000); // Refresh every 30s

    return () => {
      stockRepository.stopAutoRefresh();
    };
  }, []);

  const loadStocks = async () => {
    const loadedStocks = await stockRepository.getAll();
    setStocks(loadedStocks);
  };

  const handleAddStock = async () => {
    if (!newCode.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await stockRepository.add(newCode.trim());
      setNewCode("");
      await loadStocks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveStock = async (code: string) => {
    await stockRepository.remove(code);
    await loadStocks();
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await stockRepository.refreshPrices();
    await loadStocks();
    setIsLoading(false);
  };

  const handleClose = async () => {
    try {
      const win = getCurrentWindow();
      await win.hide();
    } catch (err) {
      console.error("Failed to hide window:", err);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 100000000) {
      return (num / 100000000).toFixed(2) + "亿";
    }
    if (num >= 10000) {
      return (num / 10000).toFixed(2) + "万";
    }
    return num.toLocaleString();
  };

  return (
    <div className={`stock-view ${className}`}>
      {/* 可拖拽标题栏 */}
      <div
        data-tauri-drag-region
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          borderBottom: "1px solid #333",
          cursor: "move",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <span style={{ fontSize: "12px", color: "#888" }}>股票</span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={onBack}
            style={{
              padding: "2px 8px",
              fontSize: "11px",
              backgroundColor: "rgba(60, 60, 60, 0.9)",
              color: "#aaa",
              border: "1px solid #555",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            返回
          </button>
          <button
            onClick={handleClose}
            style={{
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              backgroundColor: "#e05050",
              border: "none",
              cursor: "pointer",
              fontSize: "10px",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
        </div>
      </div>

      <div className="add-stock">
        <input
          type="text"
          placeholder="输入股票代码（如 600519）"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddStock()}
        />
        <button onClick={handleAddStock} disabled={isLoading || !newCode.trim()}>
          添加
        </button>
        <button className="refresh-btn" onClick={handleRefresh} disabled={isLoading}>
          {isLoading ? "刷新中..." : "刷新"}
        </button>
      </div>

      {error && <div className="stock-error">{error}</div>}

      <div className="stock-list">
        {stocks.length === 0 ? (
          <div className="stock-empty">
            <p>暂无自选股</p>
            <p className="hint">输入股票代码添加</p>
          </div>
        ) : (
          stocks.map((stock) => (
            <div key={stock.code} className="stock-item">
              <div className="stock-info">
                <span className="stock-name">{stock.name}</span>
                <span className="stock-code">{stock.code}</span>
              </div>
              <div className="stock-price">
                <span className="price">{stock.price.toFixed(2)}</span>
                <span className={`change ${stock.change >= 0 ? "up" : "down"}`}>
                  {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)}
                  ({stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%)
                </span>
              </div>
              <div className="stock-volume">
                <span className="volume-label">成交量</span>
                <span className="volume-value">{formatNumber(stock.volume)}</span>
              </div>
              <button
                className="remove-btn"
                onClick={() => handleRemoveStock(stock.code)}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
