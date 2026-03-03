# 项目复审报告（2026-03）

## 1. 项目定位与总体结构

该仓库是 Wenyan 的 MCP Server 实现，支持两种运行模式：

- `stdio`：本地 MCP 客户端（如 Claude Desktop）通过标准输入输出通信。
- `sse`：通过 HTTP + SSE 对外提供 MCP 服务，并额外提供 `/upload` 文件上传端点。

核心目录：

- `src/index.ts`：启动入口，解析 `--sse` / `--http-port` / `--https` 参数并选择运行模式。
- `src/mcpServer.ts`：MCP Server 初始化，工具注册与调用分发。
- `src/publish.ts`：发布主链路，包含内容来源解析、`asset://` 解析、样式渲染、发布草稿。
- `src/httpServer.ts`：SSE 服务、认证、CORS、上传与健康检查端点。
- `src/upload.ts`：上传文件落盘、TTL 清理、Base64 资产上传。
- `src/theme.ts`：主题枚举、注册、删除。
- `tests/`：脚本化联调用例（以集成/手工验证为主）。

## 2. 主流程复审

### 2.1 启动流程

- 默认进入 `stdio` 模式。
- 传入 `--sse` 时启动 HTTP 服务，默认端口 `3000`，可通过 `--http-port` 覆盖。
- HTTPS 依赖 `--https` + 证书环境变量，未配置证书时会回退到 HTTP。

### 2.2 MCP 工具面

当前工具集：

- `publish_article`
- `list_themes`
- `register_theme`
- `remove_theme`
- `upload_asset`（仅 SSE 模式）

分流逻辑清晰，SSE/stdio 对可用工具的暴露差异明确。

### 2.3 文章发布链路

`publish_article` 支持多源输入（优先级已定义）：

1. `file_id`（SSE 上传文件）
2. `content_url`
3. `content`
4. `file`（仅 stdio）

发布前执行：

- `asset://` 路径转换（SSE）
- 文颜主题渲染
- Frontmatter 关键字段校验（`title` / `cover`）
- 调用核心库发布到微信草稿箱

链路设计符合“远程无状态 + 本地兼容”目标。

## 3. 已确认的优点

1. **模式边界清楚**：SSE 禁止直接读本地路径，降低远程服务越权读取风险。
2. **上传生命周期管理**：临时文件目录 + TTL 定时清理，能控制磁盘膨胀。
3. **工具语义直观**：`upload_asset -> publish_article` 工作流对 Agent 友好。
4. **多租户能力可选**：SSE 支持在参数中动态传入 `wechat_app_id/secret`。
5. **文档完整度较高**：README 覆盖部署、鉴权、调用流程与常见场景。

## 4. 风险与改进建议（按优先级）

### P0（高优先）

1. **缺少自动化测试基线**：当前测试脚本依赖外部环境变量和真实链路，CI 级别可重复验证不足。
   - 建议新增最小化单元测试：路径解析、参数优先级、`asset://` 替换、鉴权中间件。

2. **上传接口缺少内容类型/后缀白名单**：`/upload` 与 `upload_asset` 目前更偏“信任输入”。
   - 建议增加 MIME 与扩展名校验，以及体积限制的统一错误码规范。

### P1（中优先）

1. **HTTP 日志级别配置未真正生效**：虽有 `HTTP_LOG_LEVEL` 配置字段，但缺少日志过滤/分级输出实现。
2. **错误响应格式可进一步统一**：部分分支返回 JSON，部分直接返回纯文本（如 404）。
3. **可观测性可增强**：建议补充请求 ID（trace id）并写入日志，便于问题定位。

### P2（低优先）

1. **类型约束可再收紧**：部分 `arguments` 读取仍是运行时字符串化，建议搭配 schema 校验器做二次校验。
2. **测试脚本命名与 npm scripts 可更一致**：如缺少 `test:http` 统一入口，易产生误用。

## 5. 可执行的近期行动清单（建议）

1. 新增 `pnpm test:unit`（纯本地、零外部依赖）覆盖关键函数。
2. 为 `/upload` 与 `upload_asset` 增加文件类型与大小双重校验。
3. 在 HTTP 层统一错误输出结构：`{ error, code, detail? }`。
4. 引入简易日志门面，真正落地 `HTTP_LOG_LEVEL`。
5. 在 README 增补“最小自测矩阵”（本地无凭证可跑的检查项）。

## 6. 本次复审执行记录

执行命令：

- `pnpm -s build`：通过。
- `pnpm -s test:list`：失败（缺少 `LLM_API_KEY` 环境变量，属环境前置条件未满足）。

结论：

- 项目主干链路设计合理、功能边界清晰，具备可用性。
- 当前短板主要在“自动化可验证性”和“输入安全策略统一化”。
- 若补足测试基线与上传安全策略，整体工程质量可显著提升。
