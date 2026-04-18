import { z } from "zod";

export const AccountSummarySchema = z.object({
  id: z.number(),
  currency: z.string(),
  totalValue: z.number(),
  cash: z.object({
    availableToTrade: z.number(),
    reservedForOrders: z.number(),
    inPies: z.number(),
  }),
  investments: z.object({
    currentValue: z.number(),
    totalCost: z.number(),
    realizedProfitLoss: z.number(),
    unrealizedProfitLoss: z.number(),
  }),
});

export type AccountSummary = z.infer<typeof AccountSummarySchema>;

export const PositionSchema = z.object({
  ticker: z.string(),
  instrumentName: z.string(),
  quantity: z.number(),
  averagePrice: z.number(),
  currentPrice: z.number(),
  profitLoss: z.number(),
  profitLossPercentage: z.number(),
});

export type Position = z.infer<typeof PositionSchema>;

export const InstrumentSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  isin: z.string().optional(),
  currency: z.string(),
});

export const OrderSchema = z.object({
  id: z.number().or(z.string()),
  ticker: z.string(),
  status: z.string(),
  type: z.string(),
  side: z.string().optional(),
  quantity: z.number().nullable().optional(),
  value: z.number().nullable().optional(),
  filledQuantity: z.number().nullable().optional(),
  filledValue: z.number().nullable().optional(),
  limitPrice: z.number().nullable().optional(),
  stopPrice: z.number().nullable().optional(),
  creationTime: z.string().nullable().optional(),
});

export type Order = z.infer<typeof OrderSchema>;

export const CreateOrderSchema = z.object({
  ticker: z.string().describe("Trading instrument ticker (e.g., AAPL_US_EQ)"),
  quantity: z.number().positive().describe("Number of shares to trade"),
  limitPrice: z.number().positive().optional().describe("Limit price for limit/stop-limit orders"),
  stopPrice: z.number().positive().optional().describe("Stop price for stop/stop-limit orders"),
  timeValidity: z
    .enum(["DAY", "GOOD_TILL_CANCEL"])
    .optional()
    .describe("Order time validity: DAY or GOOD_TILL_CANCEL"),
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