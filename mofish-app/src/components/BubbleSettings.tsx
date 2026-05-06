import { useState, useEffect } from "react";
import { BubbleConfigStore, BubbleConfig } from "../domain/ports/BubbleConfigStore";

interface BubbleSettingsProps {
  configStore: BubbleConfigStore;
  onOpenLibrary: () => void;
  onOpenStock: () => void;
  className?: string;
}

const DEFAULT_CONFIG: BubbleConfig = {
  opacity: 0.85,
  borderRadius: 0,
  width: 600,
  height: 500,
  color: "rgba(0, 0, 0, 1)",
};

export function BubbleSettings({ configStore, onOpenLibrary, onOpenStock, className = "" }: BubbleSettingsProps) {
  const [config, setConfig] = useState<BubbleConfig>(DEFAULT_CONFIG);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load config on mount
  useEffect(() => {
    const load = async () => {
      const stored = await configStore.load();
      if (stored) {
        setConfig(stored);
      }
      setIsLoaded(true);
    };
    load();
  }, []);

  // Save config when changed
  useEffect(() => {
    if (!isLoaded) return;
    configStore.save(config);
  }, [config, isLoaded]);

  const updateConfig = (updates: Partial<BubbleConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  // 预览缩放比例
  const previewScale = 0.25;
  const previewWidth = config.width * previewScale;
  const previewHeight = config.height * previewScale;

  return (
    <div
      className={`bubble-settings ${className}`}
      style={{
        padding: "16px",
        height: "100%",
        overflowY: "auto",
        boxSizing: "border-box",
        backgroundColor: "transparent",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* 预览区域 */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            display: "inline-block",
            padding: "8px",
            backgroundColor: "rgba(128, 128, 128, 0.2)",
            borderRadius: "8px",
          }}
        >
          {/* 模拟窗口拖拽区 */}
          <div
            style={{
              width: previewWidth,
              height: 16 * previewScale + 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              padding: "2px 4px",
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              borderRadius: `${config.borderRadius * previewScale}px ${config.borderRadius * previewScale}px 0 0`,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                width: 10 * previewScale,
                height: 10 * previewScale,
                borderRadius: "50%",
                backgroundColor: "#e05050",
              }}
            />
          </div>
          {/* 模拟内容区 */}
          <div
            style={{
              width: previewWidth,
              height: previewHeight,
              backgroundColor: config.color,
              opacity: config.opacity,
              borderRadius: `0 0 ${config.borderRadius * previewScale}px ${config.borderRadius * previewScale}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10 * previewScale,
              color: "#888",
            }}
          >
            预览
          </div>
        </div>
      </div>

      <div className="setting-item">
        <label style={{ display: "block", fontSize: "12px", color: "#666", marginBottom: "6px" }}>
          透明度: {Math.round(config.opacity * 100)}%
        </label>
        <input
          type="range"
          min="10"
          max="100"
          value={config.opacity * 100}
          onChange={(e) => updateConfig({ opacity: parseInt(e.target.value) / 100 })}
          style={{ width: "100%" }}
        />
      </div>

      <div className="setting-item">
        <label style={{ display: "block", fontSize: "12px", color: "#666", marginBottom: "6px" }}>
          圆角: {config.borderRadius}px
        </label>
        <input
          type="range"
          min="0"
          max="32"
          value={config.borderRadius}
          onChange={(e) => updateConfig({ borderRadius: parseInt(e.target.value) })}
          style={{ width: "100%" }}
        />
      </div>

      <div className="setting-item">
        <label style={{ display: "block", fontSize: "12px", color: "#666", marginBottom: "6px" }}>
          宽度: {config.width}px
        </label>
        <input
          type="range"
          min="200"
          max="1200"
          step="50"
          value={config.width}
          onChange={(e) => updateConfig({ width: parseInt(e.target.value) })}
          style={{ width: "100%" }}
        />
      </div>

      <div className="setting-item">
        <label style={{ display: "block", fontSize: "12px", color: "#666", marginBottom: "6px" }}>
          高度: {config.height}px
        </label>
        <input
          type="range"
          min="200"
          max="800"
          step="50"
          value={config.height}
          onChange={(e) => updateConfig({ height: parseInt(e.target.value) })}
          style={{ width: "100%" }}
        />
      </div>

      <div className="setting-item">
        <label style={{ display: "block", fontSize: "12px", color: "#666", marginBottom: "6px" }}>
          背景色
        </label>
        <div style={{ display: "flex", gap: "8px" }}>
          {[
            { color: "rgba(0, 0, 0, 1)", name: "纯黑" },
            { color: "rgba(30, 30, 30, 1)", name: "深灰" },
            { color: "rgba(20, 20, 30, 1)", name: "蓝黑" },
          ].map((c) => (
            <button
              key={c.color}
              onClick={() => updateConfig({ color: c.color })}
              style={{
                flex: 1,
                padding: "6px",
                fontSize: "11px",
                backgroundColor: config.color === c.color ? "#4a9eff" : "#333",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: "11px", color: "#444" }}>
        <p>快捷键:</p>
        <ul style={{ margin: "4px 0", paddingLeft: "16px" }}>
          <li><kbd>Ctrl+Shift+H</kbd> - 全局隐藏</li>
          <li>Esc - 隐藏窗口</li>
          <li>Ctrl+, - 打开设置</li>
        </ul>
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={onOpenLibrary}
          style={{
            flex: 1,
            padding: "8px 16px",
            fontSize: "12px",
            backgroundColor: "rgba(50, 50, 50, 0.9)",
            color: "#fff",
            border: "1px solid #555",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          书库
        </button>
        <button
          onClick={onOpenStock}
          style={{
            flex: 1,
            padding: "8px 16px",
            fontSize: "12px",
            backgroundColor: "rgba(50, 50, 50, 0.9)",
            color: "#fff",
            border: "1px solid #555",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          股票
        </button>
      </div>
    </div>
  );
}
