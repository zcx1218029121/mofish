# BookReader 修复实现计划

**Goal:** 修复阅读器标题栏滚动问题，实现虚拟滚动优化大文件性能

**Architecture:**
1. 修复布局结构：标题栏作为滚动容器的绝对定位兄弟元素，不再随内容滚动
2. 实现虚拟滚动：只渲染可视区域附近的行（上下各500px缓冲），根据滚动位置动态计算可见范围

**Tech Stack:** React, useRef, useState, useCallback, CSS

---

## 文件结构

- 修改: `mofish-app/src/components/BookReader.tsx` — 主组件重写
- 修改: `mofish-app/src/styles.css` — 添加虚拟滚动相关样式

---

## Task 1: 修复布局结构 - 标题栏固定

**Files:**
- Modify: `mofish-app/src/components/BookReader.tsx`

**Steps:**

- [ ] **Step 1: 重构 JSX 布局结构**

将 return 语句中的 JSX 改为以下结构：

```tsx
return (
  <div
    className={`book-reader ${className}`}
    data-tauri-drag-region
    style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      backgroundColor: "transparent",
      position: "relative",
      overflow: "hidden",
    }}
  >
    {/* 固定标题栏 - 独立于滚动容器 */}
    <div
      className="reader-status"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        opacity: showControls ? 1 : 0,
        transition: "opacity 0.2s",
        pointerEvents: showControls ? "auto" : "none",
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      <span className="book-title">{getBookName()}</span>
      <span className="progress-text">{getProgress()}%</span>
    </div>

    {/* 滚动内容区 - 使用 relative 定位 */}
    <div
      ref={containerRef}
      className="reader-content"
      style={{
        flex: 1,
        overflowY: "auto",
        backgroundColor: "transparent",
        position: "relative",
      }}
      onScroll={handleScroll}
      onMouseMove={handleMouseMove}
    >
      <div
        ref={contentRef}
        className="reader-text"
        style={{
          fontSize: `${fontSize}px`,
          backgroundColor: "transparent",
          padding: "20px 40px",
        }}
      >
        {renderVisibleLines()}
      </div>
    </div>

    {/* 进度条 */}
    {showProgress && (
      <div className="reader-progress" style={{ opacity: showControls ? 1 : 0.3 }}>
        <div className="progress-bar" style={{ width: `${getProgress()}%` }} />
      </div>
    )}

    {/* 其他弹窗组件保持不变... */}
  </div>
);
```

- [ ] **Step 2: 添加 handleScroll 和 handleMouseMove 函数**

在组件内添加：

```tsx
const handleScroll = useCallback(() => {
  if (containerRef.current) {
    const { scrollTop } = containerRef.current;
    if (scrollTop > 10) {
      setShowControls(true);
    }
    updateVisibleRange();
  }
}, []);

const handleMouseMove = useCallback((e: React.MouseEvent) => {
  const rect = containerRef.current?.getBoundingClientRect();
  if (rect && e.clientY - rect.top < 50) {
    setShowControls(true);
  }
}, []);
```

- [ ] **Step 3: 验证构建**

Run: `cd mofish-app && npm run build`
Expected: 编译成功，无错误

---

## Task 2: 实现虚拟滚动

**Files:**
- Modify: `mofish-app/src/components/BookReader.tsx`

**Steps:**

- [ ] **Step 1: 添加虚拟滚动相关 state**

在现有 state 声明后添加：

```tsx
const LINE_HEIGHT = 32; // 每行约 32px
const BUFFER_SIZE = 500; // 上下缓冲像素
const [lines, setLines] = useState<string[]>([]);
const [visibleStartIndex, setVisibleStartIndex] = useState(0);
const [visibleEndIndex, setVisibleEndIndex] = useState(100);
```

- [ ] **Step 2: 修改文件加载逻辑**

将 `setContent(text)` 改为：

```tsx
// 加载书籍内容
useEffect(() => {
  const loadBook = async () => {
    try {
      const text = await fileSystem.readTextFile(bookPath);
      const loadedLines = text.split("\n");
      setLines(loadedLines);
      hasLoadedRef.current = true;
      await loadBookmarks();
    } catch (err) {
      console.error("Failed to load book:", err);
    }
  };
  loadBook();
  return () => {
    hasLoadedRef.current = false;
  };
}, [bookPath, bookId, fileSystem]);
```

- [ ] **Step 3: 添加 updateVisibleRange 函数**

```tsx
const updateVisibleRange = useCallback(() => {
  if (!containerRef.current || lines.length === 0) return;

  const { scrollTop, clientHeight } = containerRef.current;
  const startIndex = Math.max(0, Math.floor((scrollTop - BUFFER_SIZE) / LINE_HEIGHT));
  const endIndex = Math.min(
    lines.length - 1,
    Math.ceil((scrollTop + clientHeight + BUFFER_SIZE) / LINE_HEIGHT)
  );

  setVisibleStartIndex(startIndex);
  setVisibleEndIndex(endIndex);
}, [lines.length]);
```

- [ ] **Step 4: 添加 renderVisibleLines 函数**

```tsx
const renderVisibleLines = useCallback(() => {
  if (lines.length === 0) return null;

  return lines.slice(visibleStartIndex, visibleEndIndex + 1).map((line, idx) => {
    const actualIndex = visibleStartIndex + idx;
    return (
      <p key={actualIndex} className="text-line" style={{ margin: 0, minHeight: `${LINE_HEIGHT}px` }}>
        {line || " "}
      </p>
    );
  });
}, [lines, visibleStartIndex, visibleEndIndex]);
```

- [ ] **Step 5: 添加总高度占位元素**

在 `.reader-text` div 内添加 padding-top 来模拟顶部不可见内容：

```tsx
<div
  ref={contentRef}
  className="reader-text"
  style={{
    fontSize: `${fontSize}px`,
    backgroundColor: "transparent",
    padding: "20px 40px",
    paddingTop: visibleStartIndex * LINE_HEIGHT + 20,
  }}
>
  {renderVisibleLines()}
  {/* 底部占位 */}
  <div style={{ height: Math.max(0, (lines.length - visibleEndIndex - 1) * LINE_HEIGHT) }} />
</div>
```

- [ ] **Step 6: 验证构建**

Run: `cd mofish-app && npm run build`
Expected: 编译成功，无错误

---

## Task 3: 移除未使用的 content state

**Files:**
- Modify: `mofish-app/src/components/BookReader.tsx`

**Steps:**

- [ ] **Step 1: 移除 content state 和相关使用**

将 `const [content, setContent] = useState<string>("");` 改为 `const [lines, setLines] = useState<string[]>([]);`

将 `if (!content)` 改为 `if (lines.length === 0)`

移除 `handleKeyDown` 中的 `if (!content) return;` 改为 `if (lines.length === 0) return;`

- [ ] **Step 2: 验证构建**

Run: `cd mofish-app && npm run build`
Expected: 编译成功，无错误

---

## Task 4: 测试验证

- [ ] **Step 1: 启动应用测试**

Run: `cd mofish-app && npm run tauri dev`

验证：
1. 标题栏固定在顶部，滚动内容时标题栏不动
2. 打开一个大型 TXT 文件，滚动流畅不卡顿
3. 鼠标移到顶部区域显示书名和进度

---

## 自检清单

1. **Spec coverage**: 标题栏固定 ✓，虚拟滚动 ✓
2. **Placeholder scan**: 无 TBD/TODO ✓
3. **Type consistency**: 所有函数参数类型一致 ✓
