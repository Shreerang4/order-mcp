import { pathToFileURL } from "node:url";

import Groq from "groq-sdk";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

import { getRefundPolicySummary } from "./policy.js";

const MAX_AGENT_ITERATIONS = 8;

export type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

export type AgentResult = {
    reply: string;
    toolTrace: string[];
};

async function createAgentRuntime() {
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!groqApiKey) {
        throw new Error("GROQ_API_KEY must be set in the environment.");
    }

    const mcpClient = new Client({
        name: "Order AI Client",
        version: "1.0.0"
    });

    const transport = new StdioClientTransport({
        command: "npx",
        args: ["tsx", "src/index.ts"]
    });

    try {
        await mcpClient.connect(transport);

        const { tools: mcpTools } = await mcpClient.listTools();
        const groqTools = mcpTools.map(tool => ({
            type: "function" as const,
            function: {
                name: tool.name,
                description: tool.description ?? "",
                parameters: tool.inputSchema
            }
        }));

        console.log(
            "Discovered MCP tools:",
            mcpTools.map(tool => tool.name)
        );

        return {
            groq: new Groq({ apiKey: groqApiKey }),
            groqTools,
            mcpClient
        };
    } catch (error) {
        await mcpClient.close();
        throw error;
    }
}

type AgentRuntime = Awaited<ReturnType<typeof createAgentRuntime>>;
let runtimePromise: Promise<AgentRuntime> | undefined;

function getAgentRuntime(): Promise<AgentRuntime> {
    runtimePromise ??= createAgentRuntime().catch(error => {
        runtimePromise = undefined;
        throw error;
    });

    return runtimePromise;
}

export async function runAgent(
    userMessage: string,
    conversationHistory: ChatMessage[] = []
): Promise<AgentResult> {
    const policySummary = await getRefundPolicySummary();
    const { groq, groqTools, mcpClient } = await getAgentRuntime();
    const toolTrace: string[] = [];
    const workingMessages: any[] = [
        {
            role: "system",
            content: [
                "You are a controlled operations assistant.",
                "Use tools for live order and customer information.",
                "Never invent operational data or claim an action occurred without a tool result.",
                "Never state customer attributes unless get_customer_profile returned them in the current turn.",
                "For every refund request, obtain live order and customer details, then call request_refund for the authoritative decision.",
                "Do not predict a refund decision from the policy summary instead of calling request_refund.",
                "Use the current refund policy to plan sensible actions.",
                "MANUAL_REVIEW and BLOCK must never be bypassed.",
                "request_refund is the only tool for attempting refunds.",
                "Report the tool's decision, reason, policy version, and external-write status.",
                "",
                policySummary
            ].join("\n")
        },
        ...conversationHistory.map(message => ({ ...message })),
        {
            role: "user",
            content: userMessage
        }
    ];

    for (let iteration = 1; iteration <= MAX_AGENT_ITERATIONS; iteration += 1) {
        const response = await groq.chat.completions.create({
            model: "openai/gpt-oss-20b",
            messages: workingMessages,
            tools: groqTools,
            tool_choice: "auto"
        });

        const assistantMessage = response.choices[0].message;
        workingMessages.push(assistantMessage);

        const toolCalls = assistantMessage.tool_calls;

        if (!toolCalls || toolCalls.length === 0) {
            return {
                reply: assistantMessage.content ?? "The agent returned no text response.",
                toolTrace
            };
        }

        for (const toolCall of toolCalls) {
            const toolName = toolCall.function.name;
            let toolResult: string;

            toolTrace.push(toolName);

            try {
                const toolArguments = JSON.parse(toolCall.function.arguments) as Record<
                    string,
                    unknown
                >;

                console.log(
                    `Tool call ${iteration}:`,
                    toolName,
                    toolArguments
                );

                const mcpResult = await mcpClient.callTool({
                    name: toolName,
                    arguments: toolArguments
                });

                toolResult = getToolResultText(mcpResult);
            } catch (error) {
                toolResult = JSON.stringify({
                    error: error instanceof Error ? error.message : String(error)
                });
            }

            console.log("Tool result:", toolResult);

            workingMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: toolName,
                content: toolResult
            });
        }
    }

    throw new Error(`Agent exceeded ${MAX_AGENT_ITERATIONS} iterations.`);
}

export async function closeAgent(): Promise<void> {
    if (!runtimePromise) {
        return;
    }

    try {
        const { mcpClient } = await runtimePromise;
        await mcpClient.close();
    } catch {
        // Initialization failed before an MCP connection was available.
    } finally {
        runtimePromise = undefined;
    }
}

function getToolResultText(result: { content: unknown[] }): string {
    const textParts = result.content.flatMap(item => {
        if (
            typeof item === "object" &&
            item !== null &&
            "type" in item &&
            "text" in item &&
            item.type === "text" &&
            typeof item.text === "string"
        ) {
            return [item.text];
        }

        return [];
    });

    return textParts.length > 0
        ? textParts.join("\n")
        : JSON.stringify(result.content);
}

const isDirectRun = Boolean(
    process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
);

if (isDirectRun) {
    const userMessage =
        process.argv.slice(2).join(" ") || "What is the status of order 101?";

    try {
        const result = await runAgent(userMessage);
        console.log("Final response:", result.reply);
        console.log("Tool trace:", result.toolTrace);
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    } finally {
        await closeAgent();
    }
}
