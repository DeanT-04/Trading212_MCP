import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient, type Trading212ClientConfig } from "../api/client.js";
import { OrderSchema } from "../api/types.js";
import { formatError, getActionableSuggestion } from "../utils/errors.js";
import { getPaginationParams } from "../utils/pagination.js";
import { z } from "zod";

function formatOrder(order: ReturnType<typeof OrderSchema.parse>): string {
  const status = order.status.toUpperCase();
  const type = order.type.toUpperCase();
  const side = order.side?.toUpperCase() ?? "ORDER";
  const qty = order.quantity ?? order.value ?? "unknown";
  const price = order.limitPrice ?? order.stopPrice ?? "market";
  return `${order.ticker} ${side} ${qty} @ ${price} (${type}) - ${status}`;
}

export function registerOrderTools(server: McpServer, clientConfig: Trading212ClientConfig): void {
  server.registerTool(
    "get_pending_orders",
    {
      description: "Get all pending orders",
      inputSchema: z.object({
        limit: z.number().min(1).max(50).default(20).describe("Maximum number of orders to return (1-50, default 20)"),
        cursor: z.string().describe("Pagination cursor for next page"),
      }),
    },
    async ({ limit, cursor }: { limit?: number; cursor?: string }) => {
      try {
        const client = createClient(clientConfig);
        const params = getPaginationParams({ limit, cursor });
        const result = await client.getPendingOrders(params);

        if (!result.orders || result.orders.length === 0) {
          return {
            content: [{ type: "text", text: "No pending orders found." }],
          };
        }

        const validated = result.orders.map((o) => OrderSchema.parse(o));
        const lines = validated.map((o) => {
          const amountStr = o.quantity ? `${o.quantity} shares` : (o.value ? `£${o.value} value` : "Unknown amount");
          const priceStr = o.limitPrice ? `@ ${o.limitPrice}` : (o.stopPrice ? `@ stop ${o.stopPrice}` : "@ market");
          const sideStr = o.side ? o.side.toUpperCase() : "ORDER";
          
          return `- [ID: ${o.id}] ${o.ticker} ${sideStr} ${amountStr} ${priceStr} (${o.type}) - Status: ${o.status}`;
        });

        return {
          content: [{ type: "text", text: `Found ${validated.length} pending orders:\n` + lines.join("\n") }],
        };
      } catch (error) {
        const suggestion = getActionableSuggestion(error);
        return {
          content: [{ type: "text", text: `Error: ${formatError(error)}. ${suggestion}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "get_order",
    {
      description: "Get a specific pending order by ID",
      inputSchema: z.object({
        orderId: z.string().describe("The order ID to retrieve"),
      }),
    },
    async ({ orderId }: { orderId: string }) => {
      try {
        const client = createClient(clientConfig);
        const order = await client.getOrder(orderId);
        const validated = OrderSchema.parse(order);

        const text = `Order ${validated.id}:
- Ticker: ${validated.ticker}
- Type: ${validated.type.toUpperCase()}
- Side: ${validated.side?.toUpperCase() ?? "UNKNOWN"}
- Quantity: ${validated.quantity ?? "N/A"}
- ${validated.limitPrice ? `Limit Price: ${validated.limitPrice}` : validated.stopPrice ? `Stop Price: ${validated.stopPrice}` : "Market Order"}
- Status: ${validated.status.toUpperCase()}
- Created: ${validated.creationTime ?? "Unknown"}`;

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        const suggestion = getActionableSuggestion(error);
        return {
          content: [{ type: "text", text: `Error: ${formatError(error)}. ${suggestion}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "place_limit_order",
    {
      description: "Place a limit order (buy/sell at specified price or better)",
      inputSchema: z.object({
        ticker: z.string().describe("Trading instrument ticker (e.g., AAPL_US_EQ)"),
        quantity: z.number().positive().describe("Number of shares to trade"),
        limitPrice: z.number().positive().describe("Limit price per share"),
        timeValidity: z
          .enum(["DAY", "GOOD_TILL_CANCEL"])
          .optional()
          .describe("Order expiration: DAY or GOOD_TILL_CANCEL"),
      }),
    },
    async ({
      ticker,
      quantity,
      limitPrice,
      timeValidity,
    }: {
      ticker: string;
      quantity: number;
      limitPrice: number;
      timeValidity?: string;
    }) => {
      try {
        const client = createClient(clientConfig);
        const order = await client.placeLimitOrder(ticker, quantity, limitPrice, timeValidity);
        const validated = OrderSchema.parse(order);

        return {
          content: [
            {
              type: "text",
              text: `Order placed: ${formatOrder(validated)}\nOrder ID: ${validated.id}`,
            },
          ],
        };
      } catch (error) {
        const suggestion = getActionableSuggestion(error);
        return {
          content: [{ type: "text", text: `Error: ${formatError(error)}. ${suggestion}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "place_market_order",
    {
      description: "Place a market order (execute immediately at best available price)",
      inputSchema: z.object({
        ticker: z.string().describe("Trading instrument ticker (e.g., AAPL_US_EQ)"),
        quantity: z.number().positive().describe("Number of shares to trade"),
        timeValidity: z
          .enum(["DAY", "GOOD_TILL_CANCEL"])
          .optional()
          .describe("Order expiration: DAY or GOOD_TILL_CANCEL"),
      }),
    },
    async ({
      ticker,
      quantity,
      timeValidity,
    }: {
      ticker: string;
      quantity: number;
      timeValidity?: string;
    }) => {
      try {
        const client = createClient(clientConfig);
        const order = await client.placeMarketOrder(ticker, quantity, timeValidity);
        const validated = OrderSchema.parse(order);

        return {
          content: [
            {
              type: "text",
              text: `Order placed: ${formatOrder(validated)}\nOrder ID: ${validated.id}`,
            },
          ],
        };
      } catch (error) {
        const suggestion = getActionableSuggestion(error);
        return {
          content: [{ type: "text", text: `Error: ${formatError(error)}. ${suggestion}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "place_stop_order",
    {
      description: "Place a stop order (trigger at specified price)",
      inputSchema: z.object({
        ticker: z.string().describe("Trading instrument ticker (e.g., AAPL_US_EQ)"),
        quantity: z.number().positive().describe("Number of shares to trade"),
        stopPrice: z.number().positive().describe("Trigger price to activate the order"),
        timeValidity: z
          .enum(["DAY", "GOOD_TILL_CANCEL"])
          .optional()
          .describe("Order expiration: DAY or GOOD_TILL_CANCEL"),
      }),
    },
    async ({
      ticker,
      quantity,
      stopPrice,
      timeValidity,
    }: {
      ticker: string;
      quantity: number;
      stopPrice: number;
      timeValidity?: string;
    }) => {
      try {
        const client = createClient(clientConfig);
        const order = await client.placeStopOrder(ticker, quantity, stopPrice, timeValidity);
        const validated = OrderSchema.parse(order);

        return {
          content: [
            {
              type: "text",
              text: `Order placed: ${formatOrder(validated)}\nOrder ID: ${validated.id}`,
            },
          ],
        };
      } catch (error) {
        const suggestion = getActionableSuggestion(error);
        return {
          content: [{ type: "text", text: `Error: ${formatError(error)}. ${suggestion}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "place_stop_limit_order",
    {
      description: "Place a stop-limit order (trigger then execute at limit price)",
      inputSchema: z.object({
        ticker: z.string().describe("Trading instrument ticker (e.g., AAPL_US_EQ)"),
        quantity: z.number().positive().describe("Number of shares to trade"),
        limitPrice: z.number().positive().describe("Limit price per share"),
        stopPrice: z.number().positive().describe("Trigger price to activate the order"),
        timeValidity: z
          .enum(["DAY", "GOOD_TILL_CANCEL"])
          .optional()
          .describe("Order expiration: DAY or GOOD_TILL_CANCEL"),
      }),
    },
    async ({
      ticker,
      quantity,
      limitPrice,
      stopPrice,
      timeValidity,
    }: {
      ticker: string;
      quantity: number;
      limitPrice: number;
      stopPrice: number;
      timeValidity?: string;
    }) => {
      try {
        const client = createClient(clientConfig);
        const order = await client.placeStopLimitOrder(ticker, quantity, limitPrice, stopPrice, timeValidity);
        const validated = OrderSchema.parse(order);

        return {
          content: [
            {
              type: "text",
              text: `Order placed: ${formatOrder(validated)}\nOrder ID: ${validated.id}`,
            },
          ],
        };
      } catch (error) {
        const suggestion = getActionableSuggestion(error);
        return {
          content: [{ type: "text", text: `Error: ${formatError(error)}. ${suggestion}` }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "cancel_order",
    {
      description: "Cancel a pending order by ID",
      inputSchema: z.object({
        orderId: z.string().describe("The order ID to cancel"),
      }),
    },
    async ({ orderId }: { orderId: string }) => {
      try {
        const client = createClient(clientConfig);
        await client.cancelOrder(orderId);

        return {
          content: [{ type: "text", text: `Order ${orderId} has been cancelled.` }],
        };
      } catch (error) {
        const suggestion = getActionableSuggestion(error);
        return {
          content: [{ type: "text", text: `Error: ${formatError(error)}. ${suggestion}` }],
          isError: true,
        };
      }
    }
  );
}