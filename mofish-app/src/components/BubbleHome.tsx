import { BubbleConfigStore } from "../domain/ports/BubbleConfigStore";

interface BubbleHomeProps {
  configStore: BubbleConfigStore;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
  onOpenStock: () => void;
}

export function BubbleHome({ onOpenLibrary, onOpenSettings, onOpenStock }: BubbleHomeProps) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        padding: "20px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: "#666",
          marginBottom: "10px",
        }}
      >
        摸鱼工具
      </div>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={onOpenLibrary}
          style={{
            padding: "16px 24px",
            fontSize: "14px",
            backgroundColor: "rgba(50, 50, 50, 0.9)",
            color: "#fff",
            border: "1px solid #555",
            borderRadius: "8px",
            cursor: "pointer",
            minWidth: "100px",
          }}
        >
          书库
        </button>
        <button
          onClick={onOpenStock}
          style={{
            padding: "16px 24px",
            fontSize: "14px",
            backgroundColor: "rgba(50, 50, 50, 0.9)",
            color: "#fff",
            border: "1px solid #555",
            borderRadius: "8px",
            cursor: "pointer",
            minWidth: "100px",
          }}
        >
          股票
        </button>
        <button
          onClick={onOpenSettings}
          style={{
            padding: "16px 24px",
            fontSize: "14px",
            backgroundColor: "rgba(50, 50, 50, 0.9)",
            color: "#fff",
            border: "1px solid #555",
            borderRadius: "8px",
            cursor: "pointer",
            minWidth: "100px",
          }}
        >
          设置
        </button>
      </div>
    </div>
  );
}
