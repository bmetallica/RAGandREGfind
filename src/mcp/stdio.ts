import { createRagMcpServer } from "./server";

async function start() {
  const { StdioServerTransport } = await import("@modelcontextprotocol/server");
  const server = await createRagMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error("RAG MCP stdio server is running");
}

start().catch((error) => {
  console.error("Failed to start RAG MCP stdio server", error);
  process.exit(1);
});