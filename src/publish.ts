import fs from "node:fs/promises";
import path from "node:path";
import { fetchContent, getNormalizeFilePath, globalStates, log } from "./utils.js";
import { configStore, renderStyledContent } from "@wenyan-md/core/wrapper";
import { publishMpnews } from "./wecom.js";
import { UPLOAD_DIR } from "./upload.js";

export const PUBLISH_ARTICLE_SCHEMA = {
    name: "publish_article",
    description: "Format a Markdown article using a selected theme and publish it to Enterprise WeCom app as 'mpnews'.",
    inputSchema: {
        type: "object",
        properties: {
            content: {
                type: "string",
                description:
                    "The Markdown text to publish. REQUIRED if 'file' or 'content_url' is not provided. DO INCLUDE frontmatter if present.",
            },
            content_url: {
                type: "string",
                description:
                    "A URL (e.g. GitHub raw link) to a Markdown file. Preferred over 'content' for large files to save tokens.",
            },
            file: {
                type: "string",
                description:
                    "The local path (absolute or relative) to a Markdown file. Preferred over 'content' for large files to save tokens.",
            },
            theme_id: {
                type: "string",
                description:
                    "ID of the theme to use (e.g., default, orangeheart, rainbow, lapis, pie, maize, purple, phycat).",
            },
        },
    },
} as const;

export const PUBLISH_ARTICLE_SSE_SCHEMA = {
    name: "publish_article",
    description: "Format a Markdown article using a selected theme and publish it to Enterprise WeCom app as 'mpnews'.",
    inputSchema: {
        type: "object",
        properties: {
            file_id: {
                type: "string",
                description:
                    "ID of a previously uploaded file (via /upload endpoint). Use this for large files to save tokens.",
            },
            content: {
                type: "string",
                description:
                    "The Markdown text to publish. REQUIRED if 'content_url', or 'file_id' is not provided. DO INCLUDE frontmatter if present.",
            },
            content_url: {
                type: "string",
                description:
                    "A URL (e.g. GitHub raw link) to a Markdown file. Preferred over 'content' for large files to save tokens.",
            },
            theme_id: {
                type: "string",
                description:
                    "ID of the theme to use (e.g., default, orangeheart, rainbow, lapis, pie, maize, purple, phycat).",
            },
            wecom_corp_id: {
                type: "string",
                description: "Enterprise WeCom CorpID. Required in SSE stateless mode if env is not set.",
            },
            wecom_corp_secret: {
                type: "string",
                description: "Enterprise WeCom app Secret. Required in SSE stateless mode if env is not set.",
            },
            wecom_agent_id: {
                type: "string",
                description: "Enterprise WeCom agent id. Required in SSE stateless mode if env is not set.",
            },
            to_user: {
                type: "string",
                description: "WeCom receiver user IDs. Use '|'-separated values, default '@all'.",
            },
            to_party: {
                type: "string",
                description: "WeCom receiver party IDs. Use '|'-separated values.",
            },
            to_tag: {
                type: "string",
                description: "WeCom receiver tag IDs. Use '|'-separated values.",
            },
        },
    },
} as const;

export async function publishArticle(
    fileId: string,
    contentUrl: string,
    file: string,
    content: string,
    themeId: string,
    corpId?: string,
    corpSecret?: string,
    agentIdRaw?: string,
    toUser?: string,
    toParty?: string,
    toTag?: string,
) {
    let workingDir: string | undefined;
    let contentFinal: string | undefined;

    // Priority: file_id > content_url > content > file
    if (fileId) {
        if (!globalStates.isSSE) {
            throw new Error("file_id is only supported in SSE mode.");
        }
        // Handle temporary uploaded file
        const uploadPath = path.join(UPLOAD_DIR, fileId);
        try {
            contentFinal = await fs.readFile(uploadPath, "utf-8");
        } catch (e) {
            log("error", `Failed to read uploaded file with ID: ${fileId}`, e);
            throw new Error(`Invalid or expired file_id: ${fileId}`);
        }
    } else if (contentUrl) {
        contentFinal = await fetchContent(contentUrl);
    } else if (!content && file) {
        // Legacy file path support
        if (globalStates.isSSE) {
            throw new Error("Local file paths are not supported in SSE mode. Please upload the file and use file_id.");
        }
        try {
            const normalizePath = getNormalizeFilePath(file);
            contentFinal = await fs.readFile(normalizePath, "utf-8");
            workingDir = path.dirname(normalizePath);
        } catch (e) {
            log("error", `Failed to read local file: ${file}`, e);
            throw new Error(`Cannot read local file '${file}'.`);
        }
    } else if (content) {
        contentFinal = content;
    }

    if (!contentFinal) {
        throw new Error("You must provide 'content', 'content_url', 'file_id', or a valid local 'file'.");
    }

    const processedContent = resolveAssetPaths(contentFinal);

    // Render and Publish to WeCom mpnews
    const customTheme = configStore.getThemeById(themeId);

    const gzhContent = await renderStyledContent(processedContent, {
        themeId,
        hlThemeId: "solarized-light",
        isMacStyle: true,
        isAddFootnote: true,
        themeCss: customTheme,
    });

    if (!gzhContent.title) {
        throw new Error("Can't extract a valid title from the frontmatter.");
    }
    if (!gzhContent.cover) {
        throw new Error("Can't extract a valid cover from the frontmatter or article.");
    }

    const resolvedCorpId = corpId || process.env.WECOM_CORP_ID || "";
    const resolvedCorpSecret = corpSecret || process.env.WECOM_CORP_SECRET || "";
    const resolvedAgentId = Number(agentIdRaw || process.env.WECOM_AGENT_ID || "");

    if (!resolvedCorpId || !resolvedCorpSecret || !resolvedAgentId) {
        throw new Error(
            "Missing WeCom credentials. Please provide wecom_corp_id, wecom_corp_secret, wecom_agent_id (or set WECOM_CORP_ID/WECOM_CORP_SECRET/WECOM_AGENT_ID).",
        );
    }

    const response = await publishMpnews(
        {
            title: gzhContent.title,
            content: gzhContent.content,
            cover: gzhContent.cover,
            workingDir,
        },
        {
            corpId: resolvedCorpId,
            corpSecret: resolvedCorpSecret,
            agentId: resolvedAgentId,
            toUser,
            toParty,
            toTag,
        },
    );

    return {
        content: [
            {
                type: "text",
                text: `Your article was successfully sent to WeCom app as mpnews. The message ID is ${response.msgid}.`,
            },
        ],
    };
}

/**
 * 解析并替换 Markdown 内容中的 asset:// 协议路径
 * 1. 处理 Markdown 正文图片: ![alt](asset://id)
 * 2. 处理 Frontmatter 封面: cover: asset://id
 */
export function resolveAssetPaths(markdown: string): string {
    if (!globalStates.isSSE) {
        return markdown; // 仅在 SSE 模式下处理 asset:// 路径
    }
    let processed = markdown;

    // --- 第一步：处理 Frontmatter 中的 cover 字段 ---
    // 匹配规则说明：
    // (^cover:\s*)   -> 捕获组1：以 cover: 开头，允许后面有空格
    // (["']?)        -> 捕获组2：允许有可选的引号 (" 或 ')
    // asset:\/\/     -> 匹配协议头
    // ([^"'\n\r]+)   -> 捕获组3：文件名 (直到遇到引号或换行符)
    // (["']?)        -> 捕获组4：可选的闭合引号
    // m 标志         -> 多行模式，确保 ^ 能匹配每一行的行首
    processed = processed.replace(
        /(^cover:\s*)(["']?)asset:\/\/([^"'\n\r]+)(["']?)/gm,
        (match, prefix, quoteOpen, fileId, quoteClose) => {
            const absolutePath = path.join(UPLOAD_DIR, fileId);
            // 保持原有的格式（包括引号和缩进）
            return `${prefix}${quoteOpen}${absolutePath}${quoteClose}`;
        },
    );

    // --- 第二步：处理 Markdown 正文中的图片链接 ---
    // 匹配规则：](asset://xxxxx)
    processed = processed.replace(/\]\(asset:\/\/([^\)]+)\)/g, (match, fileId) => {
        const absolutePath = path.join(UPLOAD_DIR, fileId);
        return `](${absolutePath})`;
    });

    return processed;
}
