import test from "node:test";
import assert from "node:assert/strict";
import { OrderSchema, PositionSchema } from "../dist/api/types.js";

test("PositionSchema parses Trading212 positions shape", () => {
  const position = {
    averagePricePaid: 150.12,
    createdAt: "2026-01-01T00:00:00Z",
    currentPrice: 155.55,
    instrument: {
      currency: "USD",
      isin: "US0378331005",
      name: "Apple Inc.",
      ticker: "AAPL_US_EQ",
    },
    quantity: 10,
    quantityAvailableForTrading: 10,
    quantityInPies: 0,
    walletImpact: {
      currency: "USD",
      currentValue: 1555.5,
      fxImpact: 0,
      totalCost: 1501.2,
      unrealizedProfitLoss: 54.3,
    },
  };

  assert.ok(PositionSchema.parse(position));
});

test("OrderSchema parses Trading212 pending order shape", () => {
  const order = {
    createdAt: "2026-01-01T00:00:00Z",
    currency: "USD",
    extendedHours: false,
    filledQuantity: 0,
    filledValue: 0,
    id: 123456,
    initiatedFrom: "API",
    instrument: {
      currency: "USD",
      isin: "US0378331005",
      name: "Apple Inc.",
      ticker: "AAPL_US_EQ",
    },
    limitPrice: 150.0,
    quantity: 1,
    side: "BUY",
    status: "NEW",
    strategy: "QUANTITY",
    ticker: "AAPL_US_EQ",
    timeInForce: "DAY",
    type: "LIMIT",
  };

  assert.ok(OrderSchema.parse(order));
});

