import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

import {
    getCustomer,
    getOrder,
    requestRefund
} from "./integrations.js";

function createServer() {
    const server = new McpServer({
        name: "Order Support Server",
        version: "1.0.0"
    });

    server.registerTool(
        "get_order_details",
        {
            description:
                "Get fresh order details from the live Order API. Use this before answering questions or planning actions for a specific order.",
            inputSchema: z.object({
                order_id: z.number().int().positive().describe("The numeric order ID")
            })
        },
        async ({ order_id }) => jsonResult(await getOrder(order_id))
    );

    server.registerTool(
        "get_customer_profile",
        {
            description:
                "Get a fresh customer profile from the live CRM, including tier, account activity, and fraud flag.",
            inputSchema: z.object({
                customer_id: z
                    .number()
                    .int()
                    .positive()
                    .describe("The numeric customer ID")
            })
        },
        async ({ customer_id }) => jsonResult(await getCustomer(customer_id))
    );

    server.registerTool(
        "request_refund",
        {
            description:
                "Safely request a refund for an order. This is the only tool for refund attempts and returns the authoritative decision, reason, policy version, and whether an external write occurred.",
            inputSchema: z.object({
                order_id: z.number().int().positive().describe("The numeric order ID"),
                reason: z.string().min(1).describe("Why the refund is being requested")
            })
        },
        async ({ order_id, reason }) =>
            jsonResult(await requestRefund(order_id, reason))
    );

    return server;
}

function jsonResult(value: unknown) {
    return {
        content: [
            {
                type: "text" as const,
                text: JSON.stringify(value)
            }
        ]
    };
}

void serveStdio(createServer);

// MCP stdio reserves stdout for protocol messages.
console.error("Order MCP Server running");
