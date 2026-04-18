import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient, type Trading212ClientConfig } from "../api/client.js";
import { PositionSchema } from "../api/types.js";
import { formatError, getActionableSuggestion } from "../utils/errors.js";
import { getPaginationParams } from "../utils/pagination.js";
import { z } from "zod";

export function registerPositionTools(server: McpServer, clientConfig: Trading212ClientConfig): void {
  server.registerTool(
    "get_positions",
    {
      description: "Get all open positions with quantity, average price, current price, and profit/loss",
      inputSchema: z.object({
        limit: z.number().min(1).max(50).default(20).describe("Maximum number of positions to return (1-50, default 20)"),
        cursor: z.string().describe("Pagination cursor for next page"),
      }),
    },
    async ({ limit, cursor }: { limit?: number; cursor?: string }) => {
      try {
        const client = createClient(clientConfig);
        const params = getPaginationParams({ limit, cursor });
        const result = await client.getPositions(params);

        if (result.positions.length === 0) {
          return {
            content: [{ type: "text", text: "No open positions found." }],
          };
        }

        const validated = result.positions.map((p) => PositionSchema.parse(p));

        const lines = validated.map((p) => {
          const pl = p.profitLoss >= 0 ? `+${p.profitLoss.toFixed(2)}` : p.profitLoss.toFixed(2);
          const plPct = p.profitLossPercentage >= 0 ? `+${p.profitLossPercentage.toFixed(2)}%` : `${p.profitLossPercentage.toFixed(2)}%`;
          return `${p.instrumentId}: ${p.quantity} shares @ ${p.averagePrice.toFixed(2)} (now ${p.currentPrice.toFixed(2)}) | P/L: ${pl} (${plPct})`;
        });

        const text = `Open Positions (${validated.length}):\n${lines.join("\n")}`;

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