import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Trading212Client, createClient, type Trading212ClientConfig } from "../api/client.js";
import { PositionSchema } from "../api/types.js";
import { formatError, getActionableSuggestion } from "../utils/errors.js";
import { getTrading212Source, Trading212SourceSchema } from "../utils/mcp.js";
import { z } from "zod";

type ClientFactory = (config: Trading212ClientConfig) => Trading212Client;

const PositionsOutputSchema = z.object({
  source: Trading212SourceSchema,
  positions: z.array(PositionSchema),
});

function formatNumber(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : String(n);
}

export function registerPositionTools(server: McpServer, clientConfig: Trading212ClientConfig): void {
  registerPositionToolsWithDeps(server, clientConfig, {});
}

export function registerPositionToolsWithDeps(
  server: McpServer,
  clientConfig: Trading212ClientConfig,
  deps: { clientFactory?: ClientFactory }
): void {
  const clientFactory = deps.clientFactory ?? createClient;

  server.registerTool(
    "trading212_get_positions",
    {
      description: "Get all open positions with quantity, average price, current price, and profit/loss",
      inputSchema: z.object({
        ticker: z.string().optional().describe("Optional ticker filter (e.g., AAPL_US_EQ)"),
      }),
      outputSchema: PositionsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ ticker }: { ticker?: string }) => {
      try {
        const client = clientFactory(clientConfig);
        const result = await client.getPositions({ ticker });

        if (!result.positions || result.positions.length === 0) {
          return {
            content: [{ type: "text", text: "No open positions found." }],
            structuredContent: {
              source: getTrading212Source(clientConfig),
              positions: [],
            },
          };
        }

        const validated = result.positions.map((p) => PositionSchema.parse(p));

        const lines = validated.map((p) => {
          const pl = p.walletImpact?.unrealizedProfitLoss;
          const cost = p.walletImpact?.totalCost;
          const plPct =
            typeof pl === "number" && typeof cost === "number" && cost !== 0 ? (pl / cost) * 100 : undefined;
          const plStr = typeof pl === "number" ? (pl >= 0 ? `+${formatNumber(pl)}` : formatNumber(pl)) : "N/A";
          const plPctStr =
            typeof plPct === "number"
              ? plPct >= 0
                ? `+${formatNumber(plPct)}%`
                : `${formatNumber(plPct)}%`
              : "N/A";
          return `${p.instrument.ticker} qty=${p.quantity} avg=${formatNumber(p.averagePricePaid)} now=${formatNumber(
            p.currentPrice
          )} upl=${plStr} (${plPctStr})`;
        });

        const text = `Open Positions (${validated.length}):\n${lines.join("\n")}`;

        return {
          content: [{ type: "text", text }],
          structuredContent: {
            source: getTrading212Source(clientConfig),
            positions: validated,
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
