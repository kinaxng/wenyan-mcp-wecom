# 文颜 MCP：企业微信应用 mpnews 自动发布使用文档

本文档说明如何把 Markdown 文章通过 `publish_article` 工具，自动发布为**企业微信应用消息（mpnews）**。

## 1. 能力说明

当前 `publish_article` 的发布目标已调整为：

- 企业微信应用消息 `mpnews`
- 支持主题排版（沿用 Wenyan 主题）
- 支持 SSE 模式上传 Markdown 文件与图片资产（`asset://`）

> 注意：企业微信 `mpnews` 不是“公众号草稿箱”，而是直接向企业微信应用可见范围发送图文消息。

## 2. 凭证配置

### 2.1 环境变量（推荐）

```bash
WECOM_CORP_ID=wwxxxx
WECOM_CORP_SECRET=xxxx
WECOM_AGENT_ID=1000002
```

### 2.2 SSE 动态参数（无状态）

调用 `publish_article` 时可传：

- `wecom_corp_id`
- `wecom_corp_secret`
- `wecom_agent_id`

优先级：**工具参数 > 环境变量**。

## 3. publish_article 参数

通用参数：

- `theme_id`：排版主题 ID
- `content`：Markdown 文本
- `content_url`：远程 Markdown 地址
- `file`：本地 Markdown 路径（仅 stdio）
- `file_id`：上传接口返回 ID（仅 SSE）

企业微信投递范围参数（可选）：

- `to_user`：用户 ID，多个使用 `|` 分隔，默认 `@all`
- `to_party`：部门 ID，多个使用 `|` 分隔
- `to_tag`：标签 ID，多个使用 `|` 分隔

## 4. Frontmatter 要求

示例：

```md
---
title: 企业微信自动发布示例
cover: ./cover.jpg
---

正文内容...
```

- `title`：必填
- `cover`：必填（会自动上传为 mpnews 的 `thumb_media_id`）

## 5. SSE 模式发布流程（含本地图片）

1. 调用 `upload_asset` 上传本地图片，拿到 `file_id`
2. 在 Markdown 中把本地图片改为 `asset://{file_id}`
3. 调用 `publish_article`（传 `content` 或 `file_id`）

## 6. 返回结果

成功时会返回：

- `message ID (msgid)`，表示企业微信消息发送成功。

## 7. 常见错误

- `Missing WeCom credentials...`：缺少 `corp_id/corp_secret/agent_id`
- `Can't extract a valid title...`：缺少 frontmatter `title`
- `Can't extract a valid cover...`：缺少封面
- `Invalid or expired file_id...`：上传文件过期或不存在
