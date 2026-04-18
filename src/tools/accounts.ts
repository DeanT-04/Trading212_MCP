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

        const totalCash = validated.cash.availableToTrade + validated.cash.reservedForOrders;
        const totalInvestments = validated.investments.currentValue;
        const text = `Account Summary:
- Account ID: ${validated.id}
- Currency: ${validated.currency}
- Available to Trade: ${validated.currency === "USD" ? "$" : validated.currency === "GBP" ? "£" : validated.currency}${validated.cash.availableToTrade.toFixed(2)}
- Reserved for Orders: ${validated.currency === "GBP" ? "£" : validated.currency}${validated.cash.reservedForOrders.toFixed(2)}
- Total Value: ${validated.currency === "GBP" ? "£" : validated.currency}${validated.totalValue.toFixed(2)}
- Investments Value: ${validated.currency === "GBP" ? "£" : validated.currency}${totalInvestments.toFixed(2)}
- Unrealized P/L: ${validated.investments.unrealizedProfitLoss >= 0 ? "+" : ""}${validated.currency === "GBP" ? "£" : validated.currency}${validated.investments.unrealizedProfitLoss.toFixed(2)}`;

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