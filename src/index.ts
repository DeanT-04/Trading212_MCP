import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient, type Trading212ClientConfig } from "./api/client.js";
import { registerAccountTools } from "./tools/accounts.js";
import { registerPositionTools } from "./tools/positions.js";
import { registerOrderTools } from "./tools/orders.js";

const SERVER_NAME = "trading212-mcp-server";
const SERVER_VERSION = "1.0.0";

async function main() {
  const apiKey = process.env.TRADING212_API_KEY;
  const secret = process.env.TRADING212_SECRET;
  const liveMode = process.env.TRADING212_LIVE_MODE === "true";

  if (!apiKey || !secret) {
    console.error("Error: TRADING212_API_KEY and TRADING212_SECRET must be set in .env file");
    console.error("Copy .env.example to .env and add your credentials");
    process.exit(1);
  }

  const clientConfig: Trading212ClientConfig = {
    apiKey,
    secret,
    liveMode,
  };

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerAccountTools(server, clientConfig);
  registerPositionTools(server, clientConfig);
  registerOrderTools(server, clientConfig);

  const transport = new StdioServerTransport();

  process.on("SIGINT", async () => {
    console.log("\n[Trading212 MCP] Shutting down...");
    await server.close();
    process.exit(0);
  });

  await server.connect(transport);
  console.log(`[Trading212 MCP] Server running on stdio (demo mode: ${!liveMode})`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});