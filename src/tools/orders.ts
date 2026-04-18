import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient, type Trading212ClientConfig } from "../api/client.js";
import { OrderSchema } from "../api/types.js";
import { formatError, getActionableSuggestion } from "../utils/errors.js";
import { getPaginationParams } from "../utils/pagination.js";
import { z } from "zod";

function formatOrder(order: ReturnType<typeof OrderSchema.parse>): string {
  const status = order.status.toUpperCase();
  const type = order.type.toUpperCase();
  const side = order.side.toUpperCase();
  const qty = order.quantity;
  const price = order.limitPrice ?? order.triggerPrice ?? "market";
  return `${order.instrumentId} ${side} ${qty} @ ${price} (${type}) - ${status}`;
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

        if (result.orders.length === 0) {
          return {
            content: [{ type: "text", text: "No pending orders found." }],
          };
        }

        const validated = result.orders.map((o) => OrderSchema.parse(o));
        const lines = validated.map(formatOrder);

        return {
          content: [{ type: "text", text: `Pending Orders (${validated.length}):\n${lines.join("\n")}` }],
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
- Instrument: ${validated.instrumentId}
- Type: ${validated.type.toUpperCase()}
- Side: ${validated.side.toUpperCase()}
- Quantity: ${validated.quantity}
- ${validated.limitPrice ? `Limit Price: ${validated.limitPrice}` : validated.triggerPrice ? `Trigger Price: ${validated.triggerPrice}` : "Market Order"}
- Status: ${validated.status.toUpperCase()}
- Created: ${validated.createdAt}`;

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
        instrumentId: z.string().describe("Trading instrument ticker (e.g., AAPL, BTC.USD)"),
        quantity: z.number().int().positive().describe("Number of shares to trade (positive integer)"),
        limitPrice: z.number().positive().describe("Limit price per share"),
        timeInForce: z
          .enum(["day", "good_until_cancelled", "at_the_open", "at_the_close"])
          .describe("Order expiration: day, good_until_cancelled, at_the_open, at_the_close"),
      }),
    },
    async ({
      instrumentId,
      quantity,
      limitPrice,
      timeInForce,
    }: {
      instrumentId: string;
      quantity: number;
      limitPrice: number;
      timeInForce?: string;
    }) => {
      try {
        const client = createClient(clientConfig);
        const order = await client.placeLimitOrder(instrumentId, quantity, limitPrice, timeInForce);
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
        instrumentId: z.string().describe("Trading instrument ticker (e.g., AAPL, BTC.USD)"),
        quantity: z.number().int().positive().describe("Number of shares to trade (positive integer)"),
        timeInForce: z
          .enum(["day", "good_until_cancelled", "at_the_open", "at_the_close"])
          .describe("Order expiration: day, good_until_cancelled, at_the_open, at_the_close"),
      }),
    },
    async ({
      instrumentId,
      quantity,
      timeInForce,
    }: {
      instrumentId: string;
      quantity: number;
      timeInForce?: string;
    }) => {
      try {
        const client = createClient(clientConfig);
        const order = await client.placeMarketOrder(instrumentId, quantity, timeInForce);
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
        instrumentId: z.string().describe("Trading instrument ticker (e.g., AAPL, BTC.USD)"),
        quantity: z.number().int().positive().describe("Number of shares to trade (positive integer)"),
        triggerPrice: z.number().positive().describe("Trigger price to activate the order"),
        timeInForce: z
          .enum(["day", "good_until_cancelled", "at_the_open", "at_the_close"])
          .describe("Order expiration: day, good_until_cancelled, at_the_open, at_the_close"),
      }),
    },
    async ({
      instrumentId,
      quantity,
      triggerPrice,
      timeInForce,
    }: {
      instrumentId: string;
      quantity: number;
      triggerPrice: number;
      timeInForce?: string;
    }) => {
      try {
        const client = createClient(clientConfig);
        const order = await client.placeStopOrder(instrumentId, quantity, triggerPrice, timeInForce);
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
        instrumentId: z.string().describe("Trading instrument ticker (e.g., AAPL, BTC.USD)"),
        quantity: z.number().int().positive().describe("Number of shares to trade (positive integer)"),
        limitPrice: z.number().positive().describe("Maximum price to pay (buy) or minimum to accept (sell)"),
        triggerPrice: z.number().positive().describe("Trigger price to activate the order"),
        timeInForce: z
          .enum(["day", "good_until_cancelled", "at_the_open", "at_the_close"])
          .describe("Order expiration: day, good_until_cancelled, at_the_open, at_the_close"),
      }),
    },
    async ({
      instrumentId,
      quantity,
      limitPrice,
      triggerPrice,
      timeInForce,
    }: {
      instrumentId: string;
      quantity: number;
      limitPrice: number;
      triggerPrice: number;
      timeInForce?: string;
    }) => {
      try {
        const client = createClient(clientConfig);
        const order = await client.placeStopLimitOrder(instrumentId, quantity, limitPrice, triggerPrice, timeInForce);
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