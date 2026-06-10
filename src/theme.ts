import { getAllGzhThemes } from "@wenyan-md/core";

export const LIST_THEMES_SCHEMA = {
    name: "list_themes",
    description: "List built-in themes that can be used by the 'format_article' tool.",
    inputSchema: {
        type: "object",
        properties: {},
    },
} as const;

export function listThemes() {
    const themes = getAllGzhThemes();
    return {
        content: themes.map((theme) => ({
            type: "text" as const,
            text: JSON.stringify({
                id: theme.meta.id,
                name: theme.meta.name,
                description: theme.meta.description,
            }),
        })),
    };
}
