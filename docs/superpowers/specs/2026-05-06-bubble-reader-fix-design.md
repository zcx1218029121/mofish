# 气泡模式阅读器修复设计

## 问题概述

1. **标题栏消失问题**：气泡模式下阅读详情页，标题栏在鼠标靠近后显示，但显示后无法隐藏，导致标题栏一直可见
2. **无法拖动气泡**：气泡窗口整体无法通过拖拽移动

## 问题 1：标题栏消失

### 根本原因

BookReader 组件中：
- `handleMouseMove` 仅在 `reader-content` 区域检测鼠标位置（line 259）
- 标题栏 `reader-status` 使用 `position: absolute` + `z-index: 10` 覆盖在内容区上方
- 当 `showControls` 为 true 时，标题栏 `opacity: 1` 变为可见
- 此时鼠标移动到标题栏上，触发的是标题栏的 hover，而非 `reader-content` 的 `onMouseMove`
- 由于 `reader-content` 的 `onMouseMove` 不触发，`showControls` 无法变回 false

### 修复方案

在 `reader-status`（标题栏）上添加 `onMouseMove` 监听器，当鼠标移动到标题栏时：
- 如果鼠标继续在标题栏范围内，保持 `showControls: true`
- 如果鼠标离开标题栏区域到下方内容区，则保持 `showControls: true`（不需要变回 false，因为内容区会处理）

**关键修改点**：`BookReader.tsx` 的 225-246 行标题栏区域，添加 `onMouseMove` 和 `onMouseLeave` 处理。

## 问题 2：添加可见拖拽手柄

### 根本原因

- BubbleWindow 的 `data-tauri-drag-region` 在最外层 div 上
- 但内容区 `reader-content` 使用 `overflow: hidden`，可能导致事件捕获问题
- 用户无法明确知道拖拽区域在哪里

### 修复方案

在 BubbleWindow 顶部标题区域添加可见的拖拽手柄：

```
┌─────────────────────────────────────────┐
│ ≡                          [−] [□] [×]  │  ← 拖拽手柄区域 (28px 高)
├─────────────────────────────────────────┤
│ 标题：xxx                    进度：50%  │  ← 标题栏（控制项）
├─────────────────────────────────────────┤
│                                         │
│              内容区域                    │
│                                         │
└─────────────────────────────────────────┘
```

**视觉设计**：
- 高度：28px
- 背景色：`rgba(0, 0, 0, 0.3)`
- 左侧装饰：三条横线图标（≡），颜色 `#666`
- 右侧按钮：关闭按钮（×），颜色 `#e05050`
- `cursor: move`
- `data-tauri-drag-region` 属性

**关键修改点**：`BubbleWindow.tsx` 在 72-73 行的占位区域替换为完整的拖拽手柄组件。

## 实施顺序

1. 修复 BubbleWindow：添加拖拽手柄
2. 修复 BookReader：标题栏鼠标事件处理
3. 测试气泡拖拽功能
4. 测试标题栏显示/隐藏逻辑
