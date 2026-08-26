import Groq from "groq-sdk";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport }
    from "@modelcontextprotocol/client/stdio";


// ======================================================
// 1. CREATE MCP CLIENT
// ======================================================

const mcpClient = new Client({
    name: "Order AI Client",
    version: "1.0.0"
});


// ======================================================
// 2. TELL MCP CLIENT HOW TO START OUR MCP SERVER
// ======================================================

const transport = new StdioClientTransport({
    command: "npx",
    args: [
        "tsx",
        "src/index.ts"
    ]
});


// ======================================================
// 3. CONNECT TO MCP SERVER
// ======================================================

await mcpClient.connect(transport);


// ======================================================
// 4. DISCOVER TOOLS FROM MCP SERVER
// ======================================================

const { tools: mcpTools } =
    await mcpClient.listTools();


console.log(
    "Discovered MCP tools:",
    mcpTools.map(tool => tool.name)
);


// ======================================================
// 5. CONVERT MCP TOOL DEFINITIONS
//    INTO GROQ FUNCTION-TOOL DEFINITIONS
// ======================================================

const groqTools = mcpTools.map(tool => ({

    type: "function" as const,

    function: {

        name: tool.name,

        description:
            tool.description ?? "",

        parameters:
            tool.inputSchema
    }
}));


// ======================================================
// 6. CREATE GROQ CLIENT
// ======================================================

const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
    throw new Error(
        "GROQ_API_KEY must be set in the environment."
    );
}

const groq = new Groq({
    apiKey: groqApiKey
});


// ======================================================
// 7. USER'S QUESTION
// ======================================================

const userQuestion =
    "Where is order 101?";


// Conversation history.
//
// Using any[] here keeps this tutorial focused on MCP
// rather than Groq SDK's detailed TypeScript message types.
const messages: any[] = [

    {
        role: "system",

        content:
            "You are an order support assistant. " +
            "Use the provided order tools whenever the user asks " +
            "about an order's status. Do not invent order information."
    },

    {
        role: "user",
        content: userQuestion
    }
];


// ======================================================
// 8. ASK GROQ MODEL
// ======================================================

let response =
    await groq.chat.completions.create({

        model: "openai/gpt-oss-20b",

        messages: messages,

        tools: groqTools,

        tool_choice: "auto"
    });


let assistantMessage =
    response.choices[0].message;


// Add Groq's response to conversation history.
//
// This response may contain:
//      content
// OR:
//      tool_calls
messages.push(assistantMessage);


// ======================================================
// 9. DID MODEL REQUEST A TOOL?
// ======================================================

const toolCalls =
    assistantMessage.tool_calls;


if (!toolCalls || toolCalls.length === 0) {

    // Model decided that no tool was needed.

    console.log(
        "AI:",
        assistantMessage.content
    );

}

else {

    // ==================================================
    // 10. EXECUTE EACH REQUESTED TOOL THROUGH MCP
    // ==================================================

    for (const toolCall of toolCalls) {

        const toolName =
            toolCall.function.name;

        const toolArguments =
            JSON.parse(
                toolCall.function.arguments
            );


        console.log(
            "\nGroq decided to call:"
        );

        console.log(
            toolName,
            toolArguments
        );


        // THIS IS THE ACTUAL MCP TOOL CALL

        const mcpResult =
            await mcpClient.callTool({

                name: toolName,

                arguments: toolArguments
            });


        console.log(
            "\nMCP returned:"
        );

        console.log(
            mcpResult.content
        );


        // ==================================================
        // 11. SEND MCP RESULT BACK INTO CONVERSATION
        // ==================================================

        messages.push({

            role: "tool",

            tool_call_id:
                toolCall.id,

            name:
                toolName,

            content:
                JSON.stringify(
                    mcpResult.content
                )
        });
    }


    // ==================================================
    // 12. ASK GROQ TO PRODUCE FINAL HUMAN ANSWER
    // ==================================================

    const finalResponse =
        await groq.chat.completions.create({

            model: "openai/gpt-oss-20b",

            messages: messages,

            tools: groqTools,

            tool_choice: "none"
        });


    console.log(
        "\nAI:",
        finalResponse
            .choices[0]
            .message
            .content
    );
}


// ======================================================
// 13. CLEANLY SHUT DOWN MCP CONNECTION
// ======================================================

await mcpClient.close();
