# 设计词元与版式（Apple 式高冷克制）

> 依据 `SPEC.md` §5.7 与 D-08。`assets/styles.css` 的 `:root` 变量必须与此表一致；`scripts/check-numbering.mjs` 之外由视觉验收逐条核对。

## 颜色

| 变量 | 值 | 用途 |
|---|---|---|
| `--color-bg` | `#ffffff` | 页面底色 |
| `--color-surface` | `#f5f5f7` | 图片瓦片、分区块底 |
| `--color-ink` | `#1d1d1f` | 主文字 |
| `--color-muted` | `#6e6e73` | 次文字、规格 |
| `--color-hairline` | `rgba(0,0,0,0.08)` | 分隔线 |
| `--color-accent` | `#0071e3` | 主 CTA、链接 |
| `--color-danger` | `#b3261e` | 错误 |

只用两级文字颜色（ink / muted）；强调色只用于主 CTA 与链接；禁止渐变、禁止多色促销块。

## 字体与字号

```css
--font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", system-ui, sans-serif;
```

| 级别 | 字号 | 字重 | 用途 |
|---|---:|---:|---|
| display | `clamp(40px, 6vw, 56px)` | 600 | 首屏标题（字距 `-0.01em`） |
| h1 | 28px | 600 | 区块标题 |
| h2 | 21px | 600 | 卡片标题 |
| body | 17px | 400 | 正文 |
| small | 14px | 400 | 规格、辅助 |
| micro | 12px | 400 | 导航、页脚 |

不引入任何外部字体。

## 间距与容器

`--space-1..8`: 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96。
容器最大宽 `1280px`；页边距 24px（≥1024px 时 48px）。首屏上下留白 ≥ 96px；区块间距 ≥ 48px。

## 网格

| 断点 | 列数 |
|---|---:|
| ≥1068px | 4 |
| ≥834px | 3 |
| ≥600px | 2 |
| <600px | 1 |

间距 20–24px。

## 组件

- 商品卡：无边框、无投影；图片瓦片 1:1（`#f5f5f7`），圆角 18px，`object-fit: contain`；标题最多两行；价格 17px/600。
- CTA：胶囊按钮（`border-radius: 980px`），底 `#0071e3`、字白；售罄时灰底禁用。
- 焦点环：`outline: 3px solid #0071e3; outline-offset: 2px`。
- 动效：220ms `cubic-bezier(0.25, 0.1, 0.25, 1)`；`prefers-reduced-motion: reduce` 时关闭。

## 禁止项（视觉验收逐条查）

外部字体、远程图片、渐变横幅、emoji 装饰、促销角标、卡片投影、感叹号文案、超过两级文字色。
