import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient, type Trading212ClientConfig } from "../api/client.js";
import { AccountSummarySchema } from "../api/types.js";
import { formatError, getActionableSuggestion } from "../utils/errors.js";
import { z } from "zod";

export function registerAccountTools(server: McpServer, clientConfig: Trading212ClientConfig): void {
  server.registerTool(
    "get_account_summary",
    {
      description: "Get account summary including account ID, currency, and cash balance",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const client = createClient(clientConfig);
        const summary = await client.getAccountSummary();

        const validated = AccountSummarySchema.parse(summary);

        const text = `Account Summary:
- Account ID: ${validated.id}
- Currency: ${validated.currency}
- Cash Balance: ${validated.currency === "USD" ? "$" : validated.currency}${validated.cash.toFixed(2)}`;

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        const suggestion = getActionableSuggestion(error);
        return {
          content: [
            {
              type: "text",
              text: `Error: ${formatError(error)}. ${suggestion}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}