# Order MCP

A small end-to-end example of a Groq-powered order assistant using the Model Context Protocol (MCP).

## Architecture

```text
Groq LLM -> MCP client -> MCP server -> REST order backend
```

- `src/ai-client.ts` sends the user question to Groq and acts as the MCP client.
- `src/index.ts` is the MCP server and exposes the `get_order_status` tool over stdio.
- `src/backend.ts` is a sample REST order backend at `http://localhost:3000`.

## Tool discovery and calling

After connecting to the MCP server, the client calls `listTools()` to discover the tools and their JSON schemas. It converts those definitions to Groq function tools and includes them in the chat request. When Groq returns a tool call, the client passes its name and arguments to `callTool()`. The MCP server calls the REST backend, and the client sends the tool result back to Groq for the final response.

## Install and run

Requires Node.js 20 or later.

```bash
npm install
```

Supply a Groq API key through the `GROQ_API_KEY` environment variable. Do not put the key in source code or commit it to Git.

Start the REST backend in one terminal:

```bash
npm run backend
```

Then run the client in another terminal. The client starts and connects to the MCP server automatically:

PowerShell:

```powershell
$env:GROQ_API_KEY = "your-key"
npm run client
```

macOS/Linux:

```bash
export GROQ_API_KEY="your-key"
npm run client
```
