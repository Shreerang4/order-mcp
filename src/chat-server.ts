import { readFile } from "node:fs/promises";
import http from "node:http";

import {
    runAgent,
    type ChatMessage
} from "./ai-client.js";

const PORT = 8080;
const sessions = new Map<string, ChatMessage[]>();
const indexHtml = await readFile(
    new URL("../public/index.html", import.meta.url)
);

const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(indexHtml);
        return;
    }

    if (req.method === "GET" && req.url === "/health") {
        sendJson(res, 200, { status: "ok" });
        return;
    }

    if (req.method === "POST" && req.url === "/chat") {
        try {
            const body = await readJsonBody(req);

            if (
                typeof body !== "object" ||
                body === null ||
                !("session_id" in body) ||
                !("message" in body) ||
                typeof body.session_id !== "string" ||
                typeof body.message !== "string" ||
                body.session_id.trim() === "" ||
                body.message.trim() === ""
            ) {
                sendJson(res, 400, {
                    error: "session_id and message must be non-empty strings"
                });
                return;
            }

            const sessionId = body.session_id;
            const message = body.message.trim();
            const history = sessions.get(sessionId) ?? [];
            const result = await runAgent(message, history);

            sessions.set(sessionId, [
                ...history,
                { role: "user", content: message },
                { role: "assistant", content: result.reply }
            ]);

            sendJson(res, 200, {
                session_id: sessionId,
                reply: result.reply,
                tool_trace: result.toolTrace
            });
        } catch (error) {
            sendJson(res, 500, {
                error: error instanceof Error ? error.message : String(error)
            });
        }

        return;
    }

    sendJson(res, 404, { error: "Route not found" });
});

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];

    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(
    res: http.ServerResponse,
    statusCode: number,
    body: unknown
): void {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
}

server.listen(PORT, () => {
    console.log(`Chat server running on http://localhost:${PORT}`);
});
