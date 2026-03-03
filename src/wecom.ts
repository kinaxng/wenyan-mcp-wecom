import fs from "node:fs/promises";
import path from "node:path";
import { getNormalizeFilePath } from "./utils.js";

interface WecomConfig {
    corpId: string;
    corpSecret: string;
    agentId: number;
    toUser?: string;
    toParty?: string;
    toTag?: string;
}

interface MpnewsPayload {
    workingDir?: string;
    title: string;
    content: string;
    cover: string;
    digest?: string;
    author?: string;
    contentSourceUrl?: string;
}

function ensureHttpUrl(input: string): boolean {
    return /^https?:\/\//i.test(input);
}

function resolveResourcePath(resourcePath: string, workingDir?: string): string {
    if (ensureHttpUrl(resourcePath)) return resourcePath;
    if (path.isAbsolute(resourcePath)) return resourcePath;
    return workingDir ? path.resolve(workingDir, resourcePath) : resourcePath;
}

async function readResourceAsBuffer(resourcePath: string, workingDir?: string): Promise<Buffer> {
    const resolvedPath = resolveResourcePath(resourcePath, workingDir);
    if (ensureHttpUrl(resolvedPath)) {
        const response = await fetch(resolvedPath);
        if (!response.ok) {
            throw new Error(`Failed to download cover image: ${response.status} ${response.statusText}`);
        }
        const ab = await response.arrayBuffer();
        return Buffer.from(ab);
    }

    const normalizePath = getNormalizeFilePath(resolvedPath);
    return fs.readFile(normalizePath);
}

async function getAccessToken(corpId: string, corpSecret: string): Promise<string> {
    const response = await fetch(
        `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(corpSecret)}`,
    );
    const data = (await response.json()) as { errcode?: number; errmsg?: string; access_token?: string };
    if (!response.ok || data.errcode !== 0 || !data.access_token) {
        throw new Error(`Failed to get WeCom access token: ${data.errmsg ?? response.statusText}`);
    }
    return data.access_token;
}

async function uploadCoverMedia(accessToken: string, coverPath: string, workingDir?: string): Promise<string> {
    const binary = await readResourceAsBuffer(coverPath, workingDir);
    const ext = path.extname(coverPath).toLowerCase() || ".jpg";
    const filename = `cover${ext}`;

    const form = new FormData();
    form.append("media", new Blob([new Uint8Array(binary)]), filename);

    const response = await fetch(
        `https://qyapi.weixin.qq.com/cgi-bin/media/upload?access_token=${encodeURIComponent(accessToken)}&type=image`,
        {
            method: "POST",
            body: form,
        },
    );

    const data = (await response.json()) as { errcode?: number; errmsg?: string; media_id?: string };
    if (!response.ok || data.errcode !== 0 || !data.media_id) {
        throw new Error(`Failed to upload cover media to WeCom: ${data.errmsg ?? response.statusText}`);
    }
    return data.media_id;
}

export async function publishMpnews(payload: MpnewsPayload, config: WecomConfig): Promise<{ msgid: string }> {
    const accessToken = await getAccessToken(config.corpId, config.corpSecret);
    const thumbMediaId = await uploadCoverMedia(accessToken, payload.cover, payload.workingDir);

    const response = await fetch(
        `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(accessToken)}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                touser: config.toUser || "@all",
                toparty: config.toParty,
                totag: config.toTag,
                msgtype: "mpnews",
                agentid: config.agentId,
                mpnews: {
                    articles: [
                        {
                            title: payload.title,
                            thumb_media_id: thumbMediaId,
                            author: payload.author || "Wenyan MCP",
                            content_source_url: payload.contentSourceUrl || "",
                            content: payload.content,
                            digest: payload.digest || payload.title,
                        },
                    ],
                },
                safe: 0,
            }),
        },
    );

    const data = (await response.json()) as { errcode?: number; errmsg?: string; msgid?: string };
    if (!response.ok || data.errcode !== 0 || !data.msgid) {
        throw new Error(`Failed to send WeCom mpnews: ${data.errmsg ?? response.statusText}`);
    }

    return { msgid: data.msgid };
}
