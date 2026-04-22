import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from "axios";
import type { AccountSummary, Position, Order } from "./types.js";

const DEMO_BASE_URL = "https://demo.trading212.com";
const LIVE_BASE_URL = "https://live.trading212.com";

let singletonClient: Trading212Client | null = null;
let singletonConfig: Trading212ClientConfig | null = null;

export interface Trading212ClientConfig {
  apiKey: string;
  secret: string;
  liveMode?: boolean;
}

export class Trading212Client {
  private client: AxiosInstance;

  constructor(config: Trading212ClientConfig) {
    const baseURL = config.liveMode ? LIVE_BASE_URL : DEMO_BASE_URL;
    const auth = Buffer.from(`${config.apiKey}:${config.secret}`).toString("base64");

    this.client = axios.create({
      baseURL: `${baseURL}/api/v0`,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    this.client.interceptors.response.use(undefined, this.handleError.bind(this));
    this.client.interceptors.request.use(this.addRetryDelay.bind(this));
  }

  private retryUntilMs: number | null = null;
  private lastRequestTimeByBucket = new Map<string, number>();

  private async sleep(ms: number): Promise<void> {
    if (ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getBucket(method: string | undefined, url: string | undefined): { key: string; minIntervalMs: number } {
    const m = (method ?? "get").toLowerCase();
    const u = url ?? "";

    if (m === "get" && u.startsWith("/equity/positions")) {
      return { key: "get:/equity/positions", minIntervalMs: 1000 };
    }
    if (m === "get" && u.startsWith("/equity/account/summary")) {
      return { key: "get:/equity/account/summary", minIntervalMs: 5000 };
    }
    if (m === "get" && u.startsWith("/equity/orders")) {
      return { key: "get:/equity/orders", minIntervalMs: 5000 };
    }
    if (m === "post" && u.startsWith("/equity/orders/")) {
      return { key: "post:/equity/orders", minIntervalMs: 2000 };
    }
    if (m === "delete" && u.startsWith("/equity/orders/")) {
      return { key: "delete:/equity/orders", minIntervalMs: 2000 };
    }

    return { key: `${m}:${u}`, minIntervalMs: 2000 };
  }

  private async addRetryDelay(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
    const now = Date.now();

    if (this.retryUntilMs && now < this.retryUntilMs) {
      await this.sleep(this.retryUntilMs - now);
      this.retryUntilMs = null;
    }

    const bucket = this.getBucket(config.method, config.url);
    const last = this.lastRequestTimeByBucket.get(bucket.key) ?? 0;
    const elapsed = now - last;
    if (elapsed < bucket.minIntervalMs) {
      await this.sleep(bucket.minIntervalMs - elapsed);
    }

    this.lastRequestTimeByBucket.set(bucket.key, Date.now());
    return config;
  }

  private async handleError(error: AxiosError): Promise<AxiosResponse> {
    const status = error.response?.status;

    if (status === 429) {
      const cfg = (error.config ?? {}) as InternalAxiosRequestConfig & { _t212RetryCount?: number };
      cfg._t212RetryCount = (cfg._t212RetryCount ?? 0) + 1;
      if (cfg._t212RetryCount > 2) {
        throw new Error("Rate limit exceeded. Please wait before retrying.");
      }

      const headers = error.response?.headers as Record<string, unknown> | undefined;
      const retryAfterRaw = headers?.["x-ratelimit-retry-after"];
      const resetRaw = headers?.["x-ratelimit-reset"];

      const retryAfterSeconds =
        typeof retryAfterRaw === "string" ? parseInt(retryAfterRaw, 10) : typeof retryAfterRaw === "number" ? retryAfterRaw : NaN;
      const resetUnix =
        typeof resetRaw === "string" ? parseInt(resetRaw, 10) : typeof resetRaw === "number" ? resetRaw : NaN;

      let waitMs = 5000;
      if (Number.isFinite(retryAfterSeconds)) {
        waitMs = Math.max(0, retryAfterSeconds * 1000);
      } else if (Number.isFinite(resetUnix)) {
        waitMs = Math.max(0, resetUnix * 1000 - Date.now());
      }

      this.retryUntilMs = Date.now() + waitMs;
      await this.sleep(waitMs);

      return this.client.request(cfg);
    }

    const data = error.response?.data as Record<string, unknown> | undefined;
    const message = typeof data?.error === "string" ? data.error : data?.message as string | undefined;

    switch (status) {
      case 401:
        throw new Error("Authentication failed. Check your API_KEY and SECRET.");
      case 403:
        throw new Error("Access forbidden. Your account may not have API access enabled.");
      case 404:
        throw new Error("Resource not found. Check the instrument ID or order ID.");
      case 400:
        throw new Error(`Bad request: ${message || "Invalid parameters"}`);
      default:
        if (!status) {
          throw new Error(`Network error: ${error.message}`);
        }
        throw new Error(`API error (${status}): ${message || error.message}`);
    }
  }

  private updateRateLimitHeaders(headers: Record<string, string>): void {
    const limit = headers["x-ratelimit-limit"];
    const remaining = headers["x-ratelimit-remaining"];
    const reset = headers["x-ratelimit-reset"];

    if (limit && remaining) {
      const resetUnix = reset ? parseInt(reset, 10) : NaN;
      const resetInSeconds = Number.isFinite(resetUnix) ? Math.max(0, resetUnix - Math.floor(Date.now() / 1000)) : undefined;
      const resetStr = typeof resetInSeconds === "number" ? `${resetInSeconds}s` : "unknown";
      console.error(`[Trading212] Rate limit: ${remaining}/${limit} (reset in ${resetStr})`);
    }
  }

  async getAccountSummary(): Promise<AccountSummary> {
    const response = await this.client.get("/equity/account/summary");
    this.updateRateLimitHeaders(response.headers as unknown as Record<string, string>);
    return response.data;
  }

  async getPositions(input?: { ticker?: string }): Promise<{ positions: Position[] }> {
    const params = input?.ticker ? { ticker: input.ticker } : undefined;
    const response = await this.client.get("/equity/positions", { params });
    this.updateRateLimitHeaders(response.headers as unknown as Record<string, string>);
    const positions = Array.isArray(response.data) ? response.data : [];
    return { positions };
  }

  async getPendingOrders(): Promise<{ orders: Order[] }> {
    const response = await this.client.get("/equity/orders");
    this.updateRateLimitHeaders(response.headers as unknown as Record<string, string>);
    const orders = Array.isArray(response.data) ? response.data : [];
    return { orders };
  }

  async getOrder(orderId: string | number): Promise<Order> {
    const response = await this.client.get(`/equity/orders/${orderId}`);
    this.updateRateLimitHeaders(response.headers as unknown as Record<string, string>);
    return response.data;
  }

  async placeLimitOrder(ticker: string, quantity: number, limitPrice: number, timeValidity?: string): Promise<Order> {
    const response = await this.client.post("/equity/orders/limit", {
      ticker,
      quantity,
      limitPrice,
      timeValidity,
    });
    this.updateRateLimitHeaders(response.headers as unknown as Record<string, string>);
    return response.data;
  }

  async placeMarketOrder(ticker: string, quantity: number, timeValidity?: string): Promise<Order> {
    const response = await this.client.post("/equity/orders/market", {
      ticker,
      quantity,
      timeValidity,
    });
    this.updateRateLimitHeaders(response.headers as unknown as Record<string, string>);
    return response.data;
  }

  async placeStopOrder(
    ticker: string,
    quantity: number,
    stopPrice: number,
    timeValidity?: string
  ): Promise<Order> {
    const response = await this.client.post("/equity/orders/stop", {
      ticker,
      quantity,
      stopPrice,
      timeValidity,
    });
    this.updateRateLimitHeaders(response.headers as unknown as Record<string, string>);
    return response.data;
  }

  async placeStopLimitOrder(
    ticker: string,
    quantity: number,
    limitPrice: number,
    stopPrice: number,
    timeValidity?: string
  ): Promise<Order> {
    const response = await this.client.post("/equity/orders/stop_limit", {
      ticker,
      quantity,
      limitPrice,
      stopPrice,
      timeValidity,
    });
    this.updateRateLimitHeaders(response.headers as unknown as Record<string, string>);
    return response.data;
  }

  async cancelOrder(orderId: string | number): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/equity/orders/${orderId}`);
    this.updateRateLimitHeaders(response.headers as unknown as Record<string, string>);
    return response.data;
  }
}

export function createClient(config: Trading212ClientConfig): Trading212Client {
  if (
    singletonClient &&
    singletonConfig?.apiKey === config.apiKey &&
    singletonConfig?.secret === config.secret &&
    singletonConfig?.liveMode === config.liveMode
  ) {
    return singletonClient;
  }
  singletonClient = new Trading212Client(config);
  singletonConfig = config;
  return singletonClient;
}
