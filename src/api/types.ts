import { z } from "zod";

export const AccountSummarySchema = z.object({
  id: z.string(),
  currency: z.string(),
  cash: z.number(),
});

export type AccountSummary = z.infer<typeof AccountSummarySchema>;

export const PositionSchema = z.object({
  instrumentId: z.string(),
  instrumentName: z.string(),
  quantity: z.number(),
  averagePrice: z.number(),
  currentPrice: z.number(),
  profitLoss: z.number(),
  profitLossPercentage: z.number(),
});

export type Position = z.infer<typeof PositionSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  instrumentId: z.string(),
  status: z.enum(["pending", "triggered", "filled", "cancelled"]),
  type: z.enum(["limit", "market", "stop", "stop_limit"]),
  side: z.enum(["buy", "sell"]),
  quantity: z.number(),
  triggerPrice: z.number().nullable(),
  limitPrice: z.number().nullable(),
  createdAt: z.string(),
});

export type Order = z.infer<typeof OrderSchema>;

export const CreateOrderSchema = z.object({
  instrumentId: z.string().describe("Trading instrument ticker (e.g., AAPL, BTC.USD)"),
  quantity: z.number().int().positive().describe("Number of shares to trade"),
  limitPrice: z.number().positive().optional().describe("Limit price for limit/stop-limit orders"),
  triggerPrice: z.number().positive().optional().describe("Trigger price for stop/stop-limit orders"),
  timeInForce: z
    .enum(["day", "good_until_cancelled", "at_the_open", "at_the_close"])
    .optional()
    .describe("Order time expiration"),
});

export type CreateOrder = z.infer<typeof CreateOrderSchema>;

export const PaginationParamsSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20).optional(),
  cursor: z.string().optional(),
});

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

export const OrderIdSchema = z.object({
  orderId: z.string().describe("The unique order ID"),
});

export type OrderId = z.infer<typeof OrderIdSchema>;