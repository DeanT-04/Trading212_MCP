import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from "axios";
import type { AccountSummary, Position, Order, PaginationParams } from "./types.js";

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
    });

    this.client.interceptors.response.use(undefined, this.handleError.bind(this));
    this.client.interceptors.request.use(this.addRetryDelay.bind(this));
  }

  private retryAfter: number = 0;
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 5000;

  private async addRetryDelay(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    
    if (this.retryAfter > 0) {
      const resetTime = this.retryAfter * 1000;
      if (now < this.retryAfter) {
        await new Promise(resolve => setTimeout(resolve, resetTime));
      }
      this.retryAfter = 0;
    }

    return config;
  }

  private async handleError(error: AxiosError): Promise<AxiosResponse> {
    const status = error.response?.status;
    
    if (status === 429) {
      const retryAfterHeader = error.response?.headers["x-ratelimit-retry-after"];
      this.retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 5;
      
      const waitTime = this.retryAfter * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.retryAfter = 0;
      
      return this.client.request(error.config!);
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
        throw new Error(`API error (${status}): ${message || error.message}`);
    }
  }

  private updateRateLimitHeaders(headers: Record<string, string>): void {
    const limit = headers["x-ratelimit-limit"];
    const remaining = headers["x-ratelimit-remaining"];
    const reset = headers["x-ratelimit-reset"];

    if (limit && remaining) {
      console.error(`[Trading212] Rate limit: ${remaining}/${limit} (reset in ${reset}s)`);
    }
  }

  async getAccountSummary(): Promise<AccountSummary> {
    const response = await this.client.get("/equity/account/summary");
    this.updateRateLimitHeaders(response.headers as unknown as Record<string, string>);
    return response.data;
  }

  async getPositions(pagination?: PaginationParams): Promise<{ positions: Position[]; cursor?: string }> {
    const params = { limit: pagination?.limit ?? 20, cursor: pagination?.cursor };
    const response = await this.client.get("/equity/positions", { params });
    this.updateRateLimitHeaders(response.headers as unknown as Record<string, string>);

    const data = response.data;
    const positions = Array.isArray(data) ? data : (data.items || data.positions || []);
    return { positions, cursor: data.nextPagePath || data.cursor };
  }

  async getPendingOrders(pagination?: PaginationParams): Promise<{ orders: Order[]; cursor?: string }> {
    const params = { limit: pagination?.limit ?? 20, cursor: pagination?.cursor };
    const response = await this.client.get("/equity/orders", { params });
    this.updateRateLimitHeaders(response.headers as unknown as Record<string, string>);

    const data = response.data;
    const orders = Array.isArray(data) ? data : (data.items || data.orders || []);
    return { orders, cursor: data.nextPagePath || data.cursor };
  }

  async getOrder(orderId: string): Promise<Order> {
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

  async cancelOrder(orderId: string): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/equity/orders/${orderId}`);
    this.updateRateLimitHeaders(response.headers as unknown as Record<string, string>);
    return response.data;
  }
}

export function createClient(config: Trading212ClientConfig): Trading212Client {
  if (singletonClient && singletonConfig?.apiKey === config.apiKey && singletonConfig?.secret === config.secret) {
    return singletonClient;
  }
  singletonClient = new Trading212Client(config);
  singletonConfig = config;
  return singletonClient;
}