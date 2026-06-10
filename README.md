# 文颜 MCP Server（精简版）

当前版本仅保留两个核心能力：

1. **列出支持的内置文章主题**（`list_themes`）
2. **使用内置主题对 Markdown 内容排版**（`format_article`）

> 不再提供：
> - 发布到微信公众号草稿箱
> - 发布到企业微信应用
> - 自动上传本地或网络图片

## 工具说明

### 1) list_themes

返回当前可用的内置主题列表（`id/name/description`）。

### 2) format_article

将 Markdown 渲染为排版后的 HTML 内容。

参数：

- `theme_id`：主题 ID（默认 `default`）
- `content`：Markdown 文本
- `content_url`：Markdown 文件 URL
- `file`：本地 Markdown 路径（stdio 模式）

输入优先级：`content_url > content > file`。

返回内容：

- `title`：解析出的标题（若有）
- `html`：渲染后的 HTML
- `cover`：解析出的封面（若有）
- `theme_id`：实际使用的主题

## 运行

```bash
pnpm build
node dist/index.js            # stdio
node dist/index.js --sse      # SSE
```

SSE 端点：

- `GET /sse`
- `POST /message`
- `GET /health`

## 本地开发

```bash
pnpm build
```
