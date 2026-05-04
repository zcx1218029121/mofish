import { useState, useEffect } from "react";
import { getCurrentWindow, PhysicalPosition, PhysicalSize } from "@tauri-apps/api/window";

interface BubbleSettingsProps {
  className?: string;
}

interface BubbleConfig {
  opacity: number;
  borderRadius: number;
  width: number;
  height: number;
  color: string;
}

const STORAGE_KEY = "mofish-bubble-config";

const DEFAULT_CONFIG: BubbleConfig = {
  opacity: 0.85,
  borderRadius: 0,
  width: 600,
  height: 500,
  color: "rgba(0, 0, 0, 1)",
};

export function BubbleSettings({ className = "" }: BubbleSettingsProps) {
  const [config, setConfig] = useState<BubbleConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch {}
    return DEFAULT_CONFIG;
  });

  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    applyConfig(config);
  }, [config]);

  useEffect(() => {
    const applyInitial = async () => {
      try {
        const win = getCurrentWindow();
        await win.setAlwaysOnTop(true);
        await win.setSize(new PhysicalSize(config.width, config.height));
        await win.setPosition(new PhysicalPosition(position.x, position.y));
      } catch (err) {
        console.error("Failed to apply initial config:", err);
      }
    };
    applyInitial();
  }, []);

  const applyConfig = async (cfg: BubbleConfig) => {
    try {
      const win = getCurrentWindow();
      await win.setAlwaysOnTop(true);
      await win.setSize(new PhysicalSize(cfg.width, cfg.height));
    } catch (err) {
      console.error("Failed to apply window config:", err);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".window-controls")) return;
    if ((e.target as HTMLElement).closest(".settings-panel")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = Math.max(0, e.clientX - dragStart.x);
    const newY = Math.max(0, e.clientY - dragStart.y);
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = async () => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      const win = getCurrentWindow();
      await win.setPosition(new PhysicalPosition(position.x, position.y));
    } catch {}
  };

  const handleClose = async () => {
    try {
      const win = getCurrentWindow();
      await win.hide();
    } catch (err) {
      console.error("Failed to hide window:", err);
    }
  };

  const updateConfig = (updates: Partial<BubbleConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  return (
    <div
      className={`bubble-settings ${className}`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        backgroundColor: config.color,
        opacity: config.opacity,
        borderRadius: config.borderRadius,
        width: config.width,
        height: config.height,
        cursor: isDragging ? "grabbing" : "default",
      }}
    >
      <div
        className="window-titlebar"
        onMouseDown={handleMouseDown}
        style={{
          height: "32px",
          backgroundColor: "rgba(255,255,255,0.05)",
          cursor: "grab",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          borderTopLeftRadius: config.borderRadius,
          borderTopRightRadius: config.borderRadius,
        }}
      >
        <span style={{ fontSize: "12px", color: "#666" }}>摸鱼</span>
        <div className="window-controls" style={{ display: "flex", gap: "8px" }}>
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
          >
            ×
          </button>
        </div>
      </div>

      <div className="settings-panel" style={{ padding: "16px", overflow: "auto", height: "calc(100% - 32px)" }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "normal", color: "#888" }}>
          气泡设置
        </h3>

        <div className="setting-item" style={{ marginBottom: "16px" }}>
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

        <div className="setting-item" style={{ marginBottom: "16px" }}>
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

        <div className="setting-item" style={{ marginBottom: "16px" }}>
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

        <div className="setting-item" style={{ marginBottom: "16px" }}>
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

        <div className="setting-item" style={{ marginBottom: "16px" }}>
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

        <div style={{ fontSize: "11px", color: "#444", marginTop: "16px" }}>
          <p>快捷键:</p>
          <ul style={{ margin: "4px 0", paddingLeft: "16px" }}>
            <li><kbd>Ctrl+Shift+H</kbd> - 全局隐藏（任何界面）</li>
            <li>Esc - 隐藏窗口</li>
            <li>Ctrl+, - 打开设置</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
