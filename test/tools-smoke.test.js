import test from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAccountToolsWithDeps } from "../dist/tools/accounts.js";
import { registerPositionToolsWithDeps } from "../dist/tools/positions.js";
import { registerOrderToolsWithDeps } from "../dist/tools/orders.js";

class StubClient {
  constructor() {
    this.calls = [];
  }

  async getAccountSummary() {
    return {
      id: 1,
      currency: "USD",
      totalValue: 1000,
      cash: { availableToTrade: 100, reservedForOrders: 0, inPies: 0 },
      investments: { currentValue: 900, totalCost: 800, realizedProfitLoss: 0, unrealizedProfitLoss: 100 },
    };
  }

  async getPositions() {
    return {
      positions: [
        {
          averagePricePaid: 150,
          currentPrice: 155,
          instrument: { currency: "USD", name: "Apple Inc.", ticker: "AAPL_US_EQ" },
          quantity: 10,
          walletImpact: { currency: "USD", currentValue: 1550, totalCost: 1500, unrealizedProfitLoss: 50 },
        },
      ],
    };
  }

  async getPendingOrders() {
    return {
      orders: [
        {
          id: 101,
          ticker: "AAPL_US_EQ",
          status: "NEW",
          type: "LIMIT",
          side: "BUY",
          quantity: 1,
          limitPrice: 150,
        },
      ],
    };
  }

  async getOrder(orderId) {
    return { id: Number(orderId), ticker: "AAPL_US_EQ", status: "NEW", type: "LIMIT", side: "BUY", quantity: 1, limitPrice: 150 };
  }

  async placeMarketOrder(ticker, quantity) {
    this.calls.push({ method: "placeMarketOrder", ticker, quantity });
    return { id: 202, ticker, status: "NEW", type: "MARKET", side: quantity < 0 ? "SELL" : "BUY", quantity };
  }

  async cancelOrder(orderId) {
    this.calls.push({ method: "cancelOrder", orderId });
    return { success: true };
  }
}

function getTools(server) {
  return server._registeredTools;
}

test("Registers prefixed tools only", () => {
  const server = new McpServer({ name: "t", version: "0" });
  const stub = new StubClient();
  const clientConfig = { apiKey: "x", secret: "y", liveMode: true };
  const deps = { clientFactory: () => stub };

  registerAccountToolsWithDeps(server, clientConfig, deps);
  registerPositionToolsWithDeps(server, clientConfig, deps);
  registerOrderToolsWithDeps(server, clientConfig, deps);

  const tools = getTools(server);

  assert.ok(tools.trading212_get_account_summary);
  assert.ok(tools.trading212_get_positions);
  assert.ok(tools.trading212_get_pending_orders);
  assert.ok(tools.trading212_place_market_buy_order);
  assert.ok(tools.trading212_place_market_sell_order);

  assert.equal(tools.get_account_summary, undefined);
  assert.equal(tools.get_positions, undefined);
  assert.equal(tools.get_pending_orders, undefined);
});

test("Tool handlers return structuredContent and validate outputSchema", async () => {
  const server = new McpServer({ name: "t", version: "0" });
  const stub = new StubClient();
  const clientConfig = { apiKey: "x", secret: "y", liveMode: true };
  const deps = { clientFactory: () => stub };

  registerAccountToolsWithDeps(server, clientConfig, deps);
  registerPositionToolsWithDeps(server, clientConfig, deps);
  registerOrderToolsWithDeps(server, clientConfig, deps);

  const tools = getTools(server);

  const accountResult = await tools.trading212_get_account_summary.handler({});
  assert.ok(accountResult.structuredContent);
  tools.trading212_get_account_summary.outputSchema.parse(accountResult.structuredContent);

  const positionsResult = await tools.trading212_get_positions.handler({});
  assert.ok(positionsResult.structuredContent);
  tools.trading212_get_positions.outputSchema.parse(positionsResult.structuredContent);

  const ordersResult = await tools.trading212_get_pending_orders.handler({ limit: 1 });
  assert.ok(ordersResult.structuredContent);
  tools.trading212_get_pending_orders.outputSchema.parse(ordersResult.structuredContent);
});

test("Sell tools negate quantity", async () => {
  const server = new McpServer({ name: "t", version: "0" });
  const stub = new StubClient();
  const clientConfig = { apiKey: "x", secret: "y", liveMode: true };
  const deps = { clientFactory: () => stub };

  registerOrderToolsWithDeps(server, clientConfig, deps);

  const tools = getTools(server);
  const result = await tools.trading212_place_market_sell_order.handler({ ticker: "AAPL_US_EQ", quantity: 2 });
  assert.ok(result.structuredContent);
  assert.deepEqual(stub.calls[0], { method: "placeMarketOrder", ticker: "AAPL_US_EQ", quantity: -2 });
});

