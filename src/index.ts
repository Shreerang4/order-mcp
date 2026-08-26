import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";


function createServer() {

    const server = new McpServer({
        name: "Order Support Server",
        version: "1.0.0"
    });


    server.registerTool(

        "get_order_status",

        {
            description:
                "Get the current status of an order using its order ID.",

            inputSchema: z.object({
                order_id: z
                    .number()
                    .int()
                    .describe("The numeric order ID")
            })
        },

        async ({ order_id }) => {

            try {

                const response = await fetch(
                    `http://localhost:3000/orders/${order_id}`
                );


                if (!response.ok) {

                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Order ${order_id} was not found.`
                            }
                        ]
                    };
                }


                const order = await response.json() as {
                    order_id: number;
                    status: string;
                };


                return {
                    content: [
                        {
                            type: "text" as const,
                            text:
                                `Order ${order.order_id} status: ${order.status}`
                        }
                    ]
                };

            } catch (error) {

                return {
                    content: [
                        {
                            type: "text" as const,
                            text:
                                "Could not reach the Order Backend."
                        }
                    ],
                    isError: true
                };
            }
        }
    );


    return server;
}


void serveStdio(createServer);


// IMPORTANT:
// MCP stdio uses stdout for protocol messages.
// Debug messages must therefore use stderr.
console.error("Order MCP Server running");