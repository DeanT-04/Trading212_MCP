import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Trading212Client, createClient, type Trading212ClientConfig } from "../api/client.js";
import { AccountSummarySchema } from "../api/types.js";
import { formatError, getActionableSuggestion } from "../utils/errors.js";
import { getTrading212Source, Trading212SourceSchema } from "../utils/mcp.js";
import { z } from "zod";

type ClientFactory = (config: Trading212ClientConfig) => Trading212Client;

const AccountSummaryOutputSchema = z.object({
  source: Trading212SourceSchema,
  accountSummary: AccountSummarySchema,
});

function formatCurrency(currency: string, amount: number): string {
  const symbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : `${currency} `;
  return `${symbol}${amount.toFixed(2)}`;
}

export function registerAccountTools(server: McpServer, clientConfig: Trading212ClientConfig): void {
  registerAccountToolsWithDeps(server, clientConfig, {});
}

export function registerAccountToolsWithDeps(
  server: McpServer,
  clientConfig: Trading212ClientConfig,
  deps: { clientFactory?: ClientFactory }
): void {
  const clientFactory = deps.clientFactory ?? createClient;

  server.registerTool(
    "trading212_get_account_summary",
    {
      description: "Get account summary including account ID, currency, and cash balance",
      inputSchema: z.object({}),
      outputSchema: AccountSummaryOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const client = clientFactory(clientConfig);
        const summary = await client.getAccountSummary();

        const validated = AccountSummarySchema.parse(summary);

        const totalInvestments = validated.investments.currentValue;
        const plPrefix = validated.investments.unrealizedProfitLoss >= 0 ? "+" : "";
        const text = [
          `Account ${validated.id} (${validated.currency})`,
          `Available: ${formatCurrency(validated.currency, validated.cash.availableToTrade)} | Reserved: ${formatCurrency(
            validated.currency,
            validated.cash.reservedForOrders
          )}`,
          `Total: ${formatCurrency(validated.currency, validated.totalValue)} | Investments: ${formatCurrency(
            validated.currency,
            totalInvestments
          )} | Unrealized P/L: ${plPrefix}${formatCurrency(validated.currency, validated.investments.unrealizedProfitLoss)}`,
        ].join("\n");

        return {
          content: [{ type: "text", text }],
          structuredContent: {
            source: getTrading212Source(clientConfig),
            accountSummary: validated,
          },
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
