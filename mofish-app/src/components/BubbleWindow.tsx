import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { BubbleConfigStore, BubbleConfig } from "../domain/ports/BubbleConfigStore";

interface BubbleWindowProps {
  configStore: BubbleConfigStore;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
  className?: string;
  children: React.ReactNode;
  transparent?: boolean; // 是否透明（阅读器模式）
}

const DEFAULT_CONFIG: BubbleConfig = {
  opacity: 0.85,
  borderRadius: 0,
  width: 600,
  height: 500,
  color: "rgba(0, 0, 0, 1)",
};

export function BubbleWindow({ configStore, onOpenLibrary, onOpenSettings, className = "", children, transparent = false }: BubbleWindowProps) {
  const [config, setConfig] = useState<BubbleConfig>(DEFAULT_CONFIG);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const load = async () => {
      const stored = await configStore.load();
      if (stored) {
        setConfig(stored);
        const win = getCurrentWindow();
        await win.setAlwaysOnTop(true);
      }
    };
    load();
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const handleClose = async () => {
    try {
      const win = getCurrentWindow();
      await win.hide();
    } catch (err) {
      console.error("Failed to hide window:", err);
    }
  };

  // 透明模式下内容区背景透明，其他模式用配置的实色
  const contentBg = transparent ? "transparent" : config.color;

  return (
    <div
      className={`bubble-window ${className}`}
      onContextMenu={handleContextMenu}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "transparent",
        borderRadius: config.borderRadius,
      }}
    >
      {/* 拖拽手柄区域 - 只有这里可以拖动窗口 */}
      <div
        data-tauri-drag-region
        style={{
          height: "28px",
          flexShrink: 0,
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          cursor: "move",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
        }}
      >
        {/* 左侧装饰图标 */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span aria-hidden="true" style={{ color: "#666", fontSize: "14px", lineHeight: 1 }}>≡</span>
        </div>
        {/* 右侧关闭按钮 */}
        <button
          onClick={handleClose}
          aria-label="关闭"
          style={{
            background: "none",
            border: "none",
            color: "#e05050",
            cursor: "pointer",
            fontSize: "16px",
            padding: "2px 6px",
            borderRadius: "4px",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(224, 80, 80, 0.2)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          ×
        </button>
      </div>

      {/* 内容区域 */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          backgroundColor: contentBg,
          opacity: 1,
          borderRadius: `0 0 ${config.borderRadius}px ${config.borderRadius}px`,
        }}
      >
        {children}
      </div>

      {showMenu && (
        <div
          className="bubble-menu"
          style={{
            position: "fixed",
            left: menuPos.x,
            top: menuPos.y,
            backgroundColor: "rgba(40, 40, 40, 0.95)",
            border: "1px solid #555",
            borderRadius: "8px",
            padding: "8px 0",
            minWidth: "150px",
            zIndex: 10000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          }}
          onClick={() => setShowMenu(false)}
        >
          <button
            onClick={() => { onOpenLibrary(); setShowMenu(false); }}
            style={{
              display: "block",
              width: "100%",
              padding: "8px 16px",
              textAlign: "left",
              background: "none",
              border: "none",
              color: "#ccc",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            书库
          </button>
          <button
            onClick={() => { onOpenSettings(); setShowMenu(false); }}
            style={{
              display: "block",
              width: "100%",
              padding: "8px 16px",
              textAlign: "left",
              background: "none",
              border: "none",
              color: "#ccc",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            气泡设置
          </button>
          <div style={{ borderTop: "1px solid #444", margin: "8px 0" }} />
          <button
            onClick={() => { handleClose(); setShowMenu(false); }}
            style={{
              display: "block",
              width: "100%",
              padding: "8px 16px",
              textAlign: "left",
              background: "none",
              border: "none",
              color: "#e05050",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            关闭
          </button>
        </div>
      )}

      {showMenu && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999 }}
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}
