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

export const InstrumentSchema = z
  .object({
    currency: z.string(),
    isin: z.string().optional(),
    name: z.string(),
    ticker: z.string(),
  })
  .passthrough();

export type Instrument = z.infer<typeof InstrumentSchema>;

export const PositionSchema = z
  .object({
    averagePricePaid: z.number(),
    createdAt: z.string().optional(),
    currentPrice: z.number(),
    instrument: InstrumentSchema,
    quantity: z.number(),
    quantityAvailableForTrading: z.number().optional(),
    quantityInPies: z.number().optional(),
    walletImpact: z
      .object({
        currency: z.string(),
        currentValue: z.number(),
        fxImpact: z.number().optional(),
        totalCost: z.number(),
        unrealizedProfitLoss: z.number(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type Position = z.infer<typeof PositionSchema>;

export const OrderSideSchema = z.enum(["BUY", "SELL"]);
export type OrderSide = z.infer<typeof OrderSideSchema>;

export const TimeInForceSchema = z.enum(["DAY", "GOOD_TILL_CANCEL"]);
export type TimeInForce = z.infer<typeof TimeInForceSchema>;

export const OrderTypeSchema = z.enum(["LIMIT", "STOP", "MARKET", "STOP_LIMIT"]);
export type OrderType = z.infer<typeof OrderTypeSchema>;

export const OrderSchema = z
  .object({
    createdAt: z.string().optional(),
    currency: z.string().optional(),
    extendedHours: z.boolean().optional(),
    filledQuantity: z.number().optional(),
    filledValue: z.number().optional(),
    id: z.number(),
    initiatedFrom: z.string().optional(),
    instrument: InstrumentSchema.optional(),
    limitPrice: z.number().optional(),
    quantity: z.number().optional(),
    side: OrderSideSchema.optional(),
    status: z.string(),
    stopPrice: z.number().optional(),
    strategy: z.string().optional(),
    ticker: z.string(),
    timeInForce: TimeInForceSchema.optional(),
    type: OrderTypeSchema.optional(),
    value: z.number().optional(),
  })
  .passthrough();

export type Order = z.infer<typeof OrderSchema>;

export const OrderIdSchema = z.object({
  orderId: z.union([z.string(), z.number()]).describe("The unique order ID"),
});

export type OrderId = z.infer<typeof OrderIdSchema>;
