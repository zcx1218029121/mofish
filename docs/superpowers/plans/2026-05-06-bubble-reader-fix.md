# 气泡阅读器修复实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复气泡模式下阅读器的两个问题：1) 标题栏显示后无法隐藏 2) 气泡窗口无法拖动

**Architecture:** 在 BubbleWindow 顶部添加可见的拖拽手柄，在 BookReader 标题栏添加鼠标事件监听器解决显示/隐藏逻辑

**Tech Stack:** React + TypeScript + Tauri v2

---

## 文件结构

- Modify: `mofish-app/src/components/BubbleWindow.tsx` - 添加拖拽手柄
- Modify: `mofish-app/src/components/BookReader.tsx` - 修复标题栏鼠标事件

---

## Task 1: BubbleWindow 添加拖拽手柄

**Files:**
- Modify: `mofish-app/src/components/BubbleWindow.tsx:72-73`

- [ ] **Step 1: 查看当前占位区域代码**

```tsx
// 当前代码 (line 72-73)
{/* 占位区域 - 使整个窗口可拖拽 */}
<div style={{ height: "4px", flexShrink: 0 }} />
```

- [ ] **Step 2: 替换为拖拽手柄组件**

将占位区域替换为：

```tsx
{/* 拖拽手柄区域 */}
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
    <span style={{ color: "#666", fontSize: "14px", lineHeight: 1 }}>≡</span>
  </div>
  {/* 右侧关闭按钮 */}
  <button
    onClick={handleClose}
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
```

- [ ] **Step 3: 验证代码结构**

确认 BubbleWindow.tsx 中：
- handleClose 函数在 line 45-52 已定义
- 手柄组件位于内容区域 (line 76-86) 之前

---

## Task 2: BookReader 修复标题栏鼠标事件

**Files:**
- Modify: `mofish-app/src/components/BookReader.tsx:103-108` (handleMouseMove)
- Modify: `mofish-app/src/components/BookReader.tsx:225-246` (reader-status div)

- [ ] **Step 1: 查看当前 handleMouseMove 代码**

```tsx
const handleMouseMove = useCallback((e: React.MouseEvent) => {
  const rect = containerRef.current?.getBoundingClientRect();
  if (rect && e.clientY - rect.top < 50) {
    setShowControls(true);
  }
}, []);
```

- [ ] **Step 2: 修改 handleMouseMove 函数**

将 handleMouseMove 修改为：当鼠标在顶部区域时显示 controls，鼠标离开后延迟隐藏。

```tsx
const hideTimerRef = useRef<number | null>(null);

const handleMouseMove = useCallback((e: React.MouseEvent) => {
  // 清除隐藏定时器
  if (hideTimerRef.current) {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }
  const rect = containerRef.current?.getBoundingClientRect();
  if (rect && e.clientY - rect.top < 50) {
    setShowControls(true);
  }
}, []);

const handleMouseLeave = useCallback(() => {
  // 延迟隐藏 controls，等待鼠标进入内容区
  hideTimerRef.current = window.setTimeout(() => {
    setShowControls(false);
  }, 100);
}, []);

const handleContentMouseEnter = useCallback(() => {
  // 鼠标进入内容区，取消隐藏
  if (hideTimerRef.current) {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }
}, []);
```

- [ ] **Step 3: 更新 reader-status div 添加鼠标事件**

将 `reader-status` div (line 225-246) 添加 `onMouseMove` 和 `onMouseLeave`：

```tsx
<div
  className="reader-status"
  onMouseMove={() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setShowControls(true);
  }}
  onMouseLeave={handleMouseLeave}
  style={{
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    opacity: showControls ? 1 : 0,
    transition: "opacity 0.2s",
    pointerEvents: showControls ? "auto" : "none",
    height: "36px",
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px",
  }}
>
  <span className="book-title">{getBookName()}</span>
  <span className="progress-text">{getProgress()}%</span>
</div>
```

- [ ] **Step 4: 更新 content div 添加 onMouseEnter**

在 `reader-content` div (line 248-259) 添加 `onMouseEnter`：

```tsx
<div
  ref={containerRef}
  className="reader-content"
  onMouseEnter={handleContentMouseEnter}
  onMouseMove={handleMouseMove}
  style={{
    flex: 1,
    overflow: "hidden",
    backgroundColor: "transparent",
    marginTop: "36px",
    marginBottom: "3px",
  }}
>
```

---

## Task 3: 验证与测试

- [ ] **Step 1: 启动开发服务器**

```bash
cd mofish-app && npm run dev
```

- [ ] **Step 2: 测试气泡拖拽**

1. 打开气泡窗口
2. 拖拽顶部手柄区域，确认窗口可以移动

- [ ] **Step 3: 测试标题栏显示/隐藏**

1. 进入阅读器模式
2. 鼠标靠近顶部，确认标题栏显示
3. 鼠标移开，确认标题栏隐藏

- [ ] **Step 4: 测试关闭按钮**

1. 点击手柄右侧 × 按钮
2. 确认气泡窗口隐藏

---

## 实施顺序

1. Task 1: BubbleWindow 添加拖拽手柄
2. Task 2: BookReader 修复标题栏鼠标事件
3. Task 3: 验证与测试
