import fs from "node:fs/promises";
import { fetchContent, getNormalizeFilePath, log } from "./utils.js";
import { configStore, renderStyledContent } from "@wenyan-md/core/wrapper";

export const FORMAT_ARTICLE_SCHEMA = {
    name: "format_article",
    description: "Format Markdown content with a selected built-in theme and return rendered result.",
    inputSchema: {
        type: "object",
        properties: {
            content: {
                type: "string",
                description:
                    "The Markdown text to format. REQUIRED if 'file' or 'content_url' is not provided. Include frontmatter if present.",
            },
            content_url: {
                type: "string",
                description: "A URL to a Markdown file. Preferred over 'content' for large files.",
            },
            file: {
                type: "string",
                description: "The local path (absolute or relative) to a Markdown file (stdio mode).",
            },
            theme_id: {
                type: "string",
                description: "Built-in theme ID. Example: default, orangeheart, rainbow, lapis, pie, maize, purple, phycat.",
            },
        },
    },
} as const;

export async function formatArticle(contentUrl: string, file: string, content: string, themeId: string) {
    let contentFinal: string | undefined;

    // Priority: content_url > content > file
    if (contentUrl) {
        contentFinal = await fetchContent(contentUrl);
    } else if (content) {
        contentFinal = content;
    } else if (file) {
        try {
            const normalizePath = getNormalizeFilePath(file);
            contentFinal = await fs.readFile(normalizePath, "utf-8");
        } catch (e) {
            log("error", `Failed to read local file: ${file}`, e);
            throw new Error(`Cannot read local file '${file}'.`);
        }
    }

    if (!contentFinal) {
        throw new Error("You must provide 'content', 'content_url', or a valid local 'file'.");
    }

    const customTheme = configStore.getThemeById(themeId);
    const rendered = await renderStyledContent(contentFinal, {
        themeId,
        hlThemeId: "solarized-light",
        isMacStyle: true,
        isAddFootnote: true,
        themeCss: customTheme,
    });

    return {
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    title: rendered.title || "",
                    html: rendered.content,
                    cover: rendered.cover || "",
                    theme_id: themeId || "default",
                }),
            },
        ],
    };
}
