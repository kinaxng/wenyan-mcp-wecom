import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { LIST_THEMES_SCHEMA, listThemes } from "./theme.js";
import { FORMAT_ARTICLE_SCHEMA, formatArticle } from "./publish.js";

/**
 * Create and configure an MCP server instance.
 */
export function createServer(): Server {
    const server = new Server(
        {
            name: "wenyan-mcp",
            version: "2.0.1",
        },
        {
            capabilities: {
                resources: {},
                tools: {},
                prompts: {},
            },
        },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [LIST_THEMES_SCHEMA, FORMAT_ARTICLE_SCHEMA],
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        if (request.params.name === "list_themes") {
            return listThemes();
        }

        if (request.params.name === "format_article") {
            const args = request.params.arguments || {};
            const content = String(args.content || "");
            const contentUrl = String(args.content_url || "");
            const file = String(args.file || "");
            const themeId = String(args.theme_id || "default");
            return await formatArticle(contentUrl, file, content, themeId);
        }

        throw new Error("Unknown tool");
    });

    return server;
}
