import { z } from "zod";
import type { Trading212ClientConfig } from "../api/client.js";

export const Trading212SourceSchema = z.enum(["live", "demo"]);
export type Trading212Source = z.infer<typeof Trading212SourceSchema>;

export function getTrading212Source(config: Trading212ClientConfig): Trading212Source {
  return config.liveMode ? "live" : "demo";
}

