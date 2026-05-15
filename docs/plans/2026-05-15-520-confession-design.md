# 520 Confession Frontend Design

## Goal

做一个纯前端表白项目。

第一感受是温柔、安静、像一封信。
读到后半段时，逐渐变得梦幻、有仪式感、像星空。

项目会部署到服务器上。
不依赖后端。

## Core Experience

主线是“一封信变成一片星空”。

用户打开页面后，先看到一张安静的信纸。
页面没有复杂导航。
只有一句短文案和进入按钮。

进入后，正文像读信一样逐段出现。
文字不做夸张打字机效果。
节奏慢一点。
留出停顿。

读到中后段时，信纸边缘出现星光。
暖色背景慢慢过渡到夜色。
最后信纸淡出，星空出现。

终章用星点连线形成 `520`、她名字首字母，或一句短告白。
最后出现明确表达。

## Page Structure

1. Cover
   - 信纸居中。
   - 背景是暖白、浅粉、淡金。
   - 一个低调的进入按钮。

2. Letter
   - 多段正文。
   - 每段短。
   - 滚动或点击推进。
   - 用 `@chenglou/pretext` 做特殊文字排版。
   - 文本可以绕开淡心形、`5.20` 或一张照片轮廓。

3. Memory Moments
   - 3 到 5 个节点。
   - 每个节点只放一个瞬间。
   - 结构是图片或小物件 + 日期 + 一句话。
   - 不做照片墙。

4. Star Transition
   - 信纸上的光点增加。
   - 页面从暖色变成深蓝。
   - 粒子从纸面扩散到全屏。

5. Confession
   - Canvas 星空。
   - 星点连线组成最终图形或文字。
   - 出现最后一句告白。
   - 不做“接受 / 拒绝”二选一按钮。

## Visual Direction

整体要克制。

前半段：

- 暖白
- 浅粉
- 淡金
- 纸张纹理
- 柔和阴影

后半段：

- 深蓝
- 星光白
- 少量微紫
- 细粒子
- 慢速连线

动效原则：

- 慢
- 轻
- 少
- 不抖动
- 不闪屏

避免：

- 满屏爱心雨
- 大红大粉
- 高饱和渐变
- 夸张 3D 翻页
- 大量照片堆叠
- 过重的“表白选择题”

## Technical Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Framer Motion
- `@chenglou/pretext`
- Canvas
- `lucide-react`

构建产物是静态文件。
部署时只需要上传 `dist`。

## Open Source UI Component Sources

可以参考和复制开源组件，但不把页面做成组件展示站。

优先来源：

- Magic UI: 用于粒子、微光按钮、轻量文字入场。
- Animata: 用于低调的 reveal / transition 组件。
- shadcn/ui: 只用于基础结构和可访问性模式，不使用重样式组件。

备选来源：

- React Bits: 视觉效果强，但许可证含 Commons Clause。只在确认用途合适时参考，不作为主依赖。

不优先：

- Aceternity UI: 视觉偏强，容易把页面带成模板感。

## Component Plan

核心组件：

- `AppShell`
- `CoverScene`
- `LetterScene`
- `PretextParagraph`
- `MemoryMoment`
- `StarTransition`
- `StarMapFinale`

状态：

- 当前章节
- 当前段落进度
- 是否进入星空阶段
- 是否展示最终告白

不需要全局状态库。

## Data Shape

内容先用本地 TypeScript 数据。

```ts
type LetterParagraph = {
  id: string
  text: string
  layout?: 'normal' | 'heart-wrap' | 'date-wrap' | 'photo-wrap'
}

type MemoryMoment = {
  id: string
  date: string
  text: string
  image?: string
}
```

这样后续替换文案和图片不会碰页面逻辑。

## Deployment

生产构建：

```bash
npm run build
```

服务器部署：

- Nginx / Caddy 指向 `dist`
- 或者把 `dist` 上传到任意静态站点服务

需要处理 SPA fallback。
如果只有单页入口，Nginx 配置回退到 `index.html`。

## Verification

实现完成后验证：

- `npm run build`
- 桌面端视觉检查
- 移动端视觉检查
- 首屏不空白
- 星空 Canvas 正常渲染
- 文本不溢出
- 图片不存在时页面仍可用
- 部署产物可直接由静态服务器打开

## References

- Pretext: https://github.com/chenglou/pretext
- Magic UI: https://github.com/magicuidesign/magicui
- Animata: https://github.com/codse/animata
- shadcn/ui: https://github.com/shadcn-ui/ui
- React Bits: https://github.com/DavidHDev/react-bits
