import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Trading212Client, createClient, type Trading212ClientConfig } from "../api/client.js";
import { OrderIdSchema, OrderSchema } from "../api/types.js";
import { formatError, getActionableSuggestion } from "../utils/errors.js";
import { getTrading212Source, Trading212SourceSchema } from "../utils/mcp.js";
import { z } from "zod";

type ClientFactory = (config: Trading212ClientConfig) => Trading212Client;

const OrdersListOutputSchema = z.object({
  source: Trading212SourceSchema,
  orders: z.array(OrderSchema),
});

const OrderOutputSchema = z.object({
  source: Trading212SourceSchema,
  order: OrderSchema,
});

const CancelOutputSchema = z.object({
  source: Trading212SourceSchema,
  orderId: z.union([z.string(), z.number()]),
});

function formatOrder(order: ReturnType<typeof OrderSchema.parse>): string {
  const status = order.status.toUpperCase();
  const type = order.type?.toUpperCase() ?? "ORDER";
  const side = order.side?.toUpperCase() ?? "ORDER";
  const qty = typeof order.quantity === "number" ? order.quantity : order.value;
  const qtyStr = typeof qty === "number" ? String(qty) : "N/A";
  const price = typeof order.limitPrice === "number" ? order.limitPrice : order.stopPrice;
  const priceStr = typeof price === "number" ? String(price) : "market";
  return `${order.ticker} ${side} ${qtyStr} @ ${priceStr} (${type}) - ${status}`;
}

export function registerOrderTools(server: McpServer, clientConfig: Trading212ClientConfig): void {
  registerOrderToolsWithDeps(server, clientConfig, {});
}

export function registerOrderToolsWithDeps(
  server: McpServer,
  clientConfig: Trading212ClientConfig,
  deps: { clientFactory?: ClientFactory }
): void {
  const clientFactory = deps.clientFactory ?? createClient;

  server.registerTool(
    "trading212_get_pending_orders",
    {
      description: "Get all pending orders",
      inputSchema: z.object({
        limit: z.number().min(1).max(50).optional().describe("Optional max number of orders to include in the response"),
      }),
      outputSchema: OrdersListOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ limit }: { limit?: number }) => {
      try {
        const client = clientFactory(clientConfig);
        const result = await client.getPendingOrders();

        if (!result.orders || result.orders.length === 0) {
          return {
            content: [{ type: "text", text: "No pending orders found." }],
            structuredContent: {
              source: getTrading212Source(clientConfig),
              orders: [],
            },
          };
        }

        const validatedAll = result.orders.map((o) => OrderSchema.parse(o));
        const validated = typeof limit === "number" ? validatedAll.slice(0, limit) : validatedAll;
        const lines = validated.map((o) => {
          return `[${o.id}] ${formatOrder(o)}`;
        });

        return {
          content: [{ type: "text", text: `Pending Orders (${validated.length}${validatedAll.length !== validated.length ? `/${validatedAll.length}` : ""}):\n${lines.join("\n")}` }],
          structuredContent: {
            source: getTrading212Source(clientConfig),
            orders: validated,
          },
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
    "trading212_get_order",
    {
      description: "Get a specific pending order by ID",
      inputSchema: OrderIdSchema,
      outputSchema: OrderOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ orderId }: { orderId: string | number }) => {
      try {
        const client = clientFactory(clientConfig);
        const order = await client.getOrder(orderId);
        const validated = OrderSchema.parse(order);

        const text = `Order ${validated.id}: ${formatOrder(validated)}`;

        return {
          content: [{ type: "text", text }],
          structuredContent: {
            source: getTrading212Source(clientConfig),
            order: validated,
          },
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
    "trading212_place_limit_buy_order",
    {
      description: "Place a limit BUY order (execute at limit price or better)",
      inputSchema: z.object({
        ticker: z.string().describe("Trading instrument ticker (e.g., AAPL_US_EQ)"),
        quantity: z.number().positive().describe("Number of shares to trade"),
        limitPrice: z.number().positive().describe("Limit price per share"),
        timeValidity: z
          .enum(["DAY", "GOOD_TILL_CANCEL"])
          .optional()
          .describe("Order expiration: DAY or GOOD_TILL_CANCEL"),
      }),
      outputSchema: OrderOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
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
        const client = clientFactory(clientConfig);
        const order = await client.placeLimitOrder(ticker, quantity, limitPrice, timeValidity);
        const validated = OrderSchema.parse(order);

        return {
          content: [
            {
              type: "text",
              text: `Order placed: ${formatOrder(validated)}\nOrder ID: ${validated.id}`,
            },
          ],
          structuredContent: {
            source: getTrading212Source(clientConfig),
            order: validated,
          },
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
    "trading212_place_market_buy_order",
    {
      description: "Place a market BUY order (execute immediately at best available price)",
      inputSchema: z.object({
        ticker: z.string().describe("Trading instrument ticker (e.g., AAPL_US_EQ)"),
        quantity: z.number().positive().describe("Number of shares to trade"),
        timeValidity: z
          .enum(["DAY", "GOOD_TILL_CANCEL"])
          .optional()
          .describe("Order expiration: DAY or GOOD_TILL_CANCEL"),
      }),
      outputSchema: OrderOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
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
        const client = clientFactory(clientConfig);
        const order = await client.placeMarketOrder(ticker, quantity, timeValidity);
        const validated = OrderSchema.parse(order);

        return {
          content: [
            {
              type: "text",
              text: `Order placed: ${formatOrder(validated)}\nOrder ID: ${validated.id}`,
            },
          ],
          structuredContent: {
            source: getTrading212Source(clientConfig),
            order: validated,
          },
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
    "trading212_place_stop_buy_order",
    {
      description: "Place a stop BUY order (trigger at specified price)",
      inputSchema: z.object({
        ticker: z.string().describe("Trading instrument ticker (e.g., AAPL_US_EQ)"),
        quantity: z.number().positive().describe("Number of shares to trade"),
        stopPrice: z.number().positive().describe("Trigger price to activate the order"),
        timeValidity: z
          .enum(["DAY", "GOOD_TILL_CANCEL"])
          .optional()
          .describe("Order expiration: DAY or GOOD_TILL_CANCEL"),
      }),
      outputSchema: OrderOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
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
        const client = clientFactory(clientConfig);
        const order = await client.placeStopOrder(ticker, quantity, stopPrice, timeValidity);
        const validated = OrderSchema.parse(order);

        return {
          content: [
            {
              type: "text",
              text: `Order placed: ${formatOrder(validated)}\nOrder ID: ${validated.id}`,
            },
          ],
          structuredContent: {
            source: getTrading212Source(clientConfig),
            order: validated,
          },
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
    "trading212_place_stop_limit_buy_order",
    {
      description: "Place a stop-limit BUY order (trigger then execute at limit price)",
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
      outputSchema: OrderOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
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
        const client = clientFactory(clientConfig);
        const order = await client.placeStopLimitOrder(ticker, quantity, limitPrice, stopPrice, timeValidity);
        const validated = OrderSchema.parse(order);

        return {
          content: [
            {
              type: "text",
              text: `Order placed: ${formatOrder(validated)}\nOrder ID: ${validated.id}`,
            },
          ],
          structuredContent: {
            source: getTrading212Source(clientConfig),
            order: validated,
          },
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
    "trading212_place_limit_sell_order",
    {
      description: "Place a limit SELL order (execute at limit price or better)",
      inputSchema: z.object({
        ticker: z.string().describe("Trading instrument ticker (e.g., AAPL_US_EQ)"),
        quantity: z.number().positive().describe("Number of shares to trade (will be converted to a SELL order)"),
        limitPrice: z.number().positive().describe("Limit price per share"),
        timeValidity: z
          .enum(["DAY", "GOOD_TILL_CANCEL"])
          .optional()
          .describe("Order expiration: DAY or GOOD_TILL_CANCEL"),
      }),
      outputSchema: OrderOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ ticker, quantity, limitPrice, timeValidity }: { ticker: string; quantity: number; limitPrice: number; timeValidity?: string }) => {
      try {
        const client = clientFactory(clientConfig);
        const order = await client.placeLimitOrder(ticker, -quantity, limitPrice, timeValidity);
        const validated = OrderSchema.parse(order);
        return {
          content: [{ type: "text", text: `Order placed: ${formatOrder(validated)}\nOrder ID: ${validated.id}` }],
          structuredContent: { source: getTrading212Source(clientConfig), order: validated },
        };
      } catch (error) {
        const suggestion = getActionableSuggestion(error);
        return { content: [{ type: "text", text: `Error: ${formatError(error)}. ${suggestion}` }], isError: true };
      }
    }
  );

  server.registerTool(
    "trading212_place_market_sell_order",
    {
      description: "Place a market SELL order (execute immediately at best available price)",
      inputSchema: z.object({
        ticker: z.string().describe("Trading instrument ticker (e.g., AAPL_US_EQ)"),
        quantity: z.number().positive().describe("Number of shares to trade (will be converted to a SELL order)"),
        timeValidity: z
          .enum(["DAY", "GOOD_TILL_CANCEL"])
          .optional()
          .describe("Order expiration: DAY or GOOD_TILL_CANCEL"),
      }),
      outputSchema: OrderOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ ticker, quantity, timeValidity }: { ticker: string; quantity: number; timeValidity?: string }) => {
      try {
        const client = clientFactory(clientConfig);
        const order = await client.placeMarketOrder(ticker, -quantity, timeValidity);
        const validated = OrderSchema.parse(order);
        return {
          content: [{ type: "text", text: `Order placed: ${formatOrder(validated)}\nOrder ID: ${validated.id}` }],
          structuredContent: { source: getTrading212Source(clientConfig), order: validated },
        };
      } catch (error) {
        const suggestion = getActionableSuggestion(error);
        return { content: [{ type: "text", text: `Error: ${formatError(error)}. ${suggestion}` }], isError: true };
      }
    }
  );

  server.registerTool(
    "trading212_place_stop_sell_order",
    {
      description: "Place a stop SELL order (trigger at specified price)",
      inputSchema: z.object({
        ticker: z.string().describe("Trading instrument ticker (e.g., AAPL_US_EQ)"),
        quantity: z.number().positive().describe("Number of shares to trade (will be converted to a SELL order)"),
        stopPrice: z.number().positive().describe("Trigger price to activate the order"),
        timeValidity: z
          .enum(["DAY", "GOOD_TILL_CANCEL"])
          .optional()
          .describe("Order expiration: DAY or GOOD_TILL_CANCEL"),
      }),
      outputSchema: OrderOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ ticker, quantity, stopPrice, timeValidity }: { ticker: string; quantity: number; stopPrice: number; timeValidity?: string }) => {
      try {
        const client = clientFactory(clientConfig);
        const order = await client.placeStopOrder(ticker, -quantity, stopPrice, timeValidity);
        const validated = OrderSchema.parse(order);
        return {
          content: [{ type: "text", text: `Order placed: ${formatOrder(validated)}\nOrder ID: ${validated.id}` }],
          structuredContent: { source: getTrading212Source(clientConfig), order: validated },
        };
      } catch (error) {
        const suggestion = getActionableSuggestion(error);
        return { content: [{ type: "text", text: `Error: ${formatError(error)}. ${suggestion}` }], isError: true };
      }
    }
  );

  server.registerTool(
    "trading212_place_stop_limit_sell_order",
    {
      description: "Place a stop-limit SELL order (trigger then execute at limit price)",
      inputSchema: z.object({
        ticker: z.string().describe("Trading instrument ticker (e.g., AAPL_US_EQ)"),
        quantity: z.number().positive().describe("Number of shares to trade (will be converted to a SELL order)"),
        limitPrice: z.number().positive().describe("Limit price per share"),
        stopPrice: z.number().positive().describe("Trigger price to activate the order"),
        timeValidity: z
          .enum(["DAY", "GOOD_TILL_CANCEL"])
          .optional()
          .describe("Order expiration: DAY or GOOD_TILL_CANCEL"),
      }),
      outputSchema: OrderOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
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
        const client = clientFactory(clientConfig);
        const order = await client.placeStopLimitOrder(ticker, -quantity, limitPrice, stopPrice, timeValidity);
        const validated = OrderSchema.parse(order);
        return {
          content: [{ type: "text", text: `Order placed: ${formatOrder(validated)}\nOrder ID: ${validated.id}` }],
          structuredContent: { source: getTrading212Source(clientConfig), order: validated },
        };
      } catch (error) {
        const suggestion = getActionableSuggestion(error);
        return { content: [{ type: "text", text: `Error: ${formatError(error)}. ${suggestion}` }], isError: true };
      }
    }
  );

  server.registerTool(
    "trading212_cancel_order",
    {
      description: "Cancel a pending order by ID",
      inputSchema: OrderIdSchema,
      outputSchema: CancelOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ orderId }: { orderId: string | number }) => {
      try {
        const client = clientFactory(clientConfig);
        await client.cancelOrder(orderId);

        return {
          content: [{ type: "text", text: `Order ${orderId} has been cancelled.` }],
          structuredContent: {
            source: getTrading212Source(clientConfig),
            orderId,
          },
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
