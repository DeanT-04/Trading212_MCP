# trading212-mcp-server

A Model Context Protocol (MCP) server for Trading212 brokerage API. Enables AI assistants to interact with Trading212 trading accounts for portfolio management, order placement, and account monitoring.

[![npm version](https://img.shields.io/npm/v/trading212-mcp-server)](https://www.npmjs.com/package/trading212-mcp-server)
[![Node.js version](https://img.shields.io/node/v/trading212-mcp-server)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

## Features

- **Full Trading212 API Integration** - Access accounts, positions, orders, and trading operations
- **13 Trading Tools** - Comprehensive coverage of core Trading212 functionality
- **MCP Protocol Compliant** - Works with any MCP-compatible client (Claude Desktop, Cursor, OpenCode, etc.)
- **TypeScript** - Fully typed for excellent developer experience
- **stdio Transport** - Simple local deployment
- **Live Mode Default** - Defaults to live trading; demo/paper trading is opt-in
- **Security First** - API credentials stored locally, never sent to external servers

## Requirements

- Node.js >= 18.x
- A Trading212 brokerage account (Invest or Stocks ISA)
- Trading212 API credentials (obtained from Trading212 dashboard)

## Installation

### Global CLI
```bash
npm install -g trading212-mcp-server
```

### As Local Dependency
```bash
npm install trading212-mcp-server
```

### Using npx (Quick Start)
```bash
npx -y trading212-mcp-server
```

## Quick Start

### Step 1: Get Your Trading212 API Credentials

1. Log in to your Trading212 account
2. Go to Account Settings > API Access
3. Generate a new API key and secret
4. Copy credentials securely

> **Note:** You can opt into **demo/paper trading** by setting `TRADING212_LIVE_MODE=false`.

### Step 2: Configure MCP Client

#### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "trading212": {
      "command": "npx",
      "args": ["-y", "trading212-mcp-server"],
      "env": {
        "TRADING212_API_KEY": "your_api_key",
        "TRADING212_SECRET": "your_secret"
      }
    }
  }
}
```

#### Cursor

Add to your MCP settings in Cursor preferences via Settings > MCP Servers.

#### OpenCode

Add to your project's `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "trading212": {
      "type": "local",
      "command": ["npx", "-y", "trading212-mcp-server"],
      "enabled": true
    }
  }
}
```

> **Note:** API credentials are loaded from the `.env` file - update `.env` with your actual credentials.

## Configuration

### Environment Variables

The server uses the following environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `TRADING212_API_KEY` | Yes | Your Trading212 API key |
| `TRADING212_SECRET` | Yes | Your Trading212 API secret |
| `TRADING212_LIVE_MODE` | No | Defaults to `true` (live). Set to `false` for demo/paper trading |

### Using a `.env` File

Create a `.env` file in your project directory:

```bash
TRADING212_API_KEY=your_api_key_here
TRADING212_SECRET=your_secret_here
TRADING212_LIVE_MODE=true
```

> **Security Note:** Never commit your API credentials to version control. The `.env.example` file is included as a template - copy it to `.env` and ensure `.env` is in your `.gitignore`.

## Tools

This MCP server exposes 13 Trading212 tools. All tools return compact text plus machine-readable data in `structuredContent`.

### Read-only tools

- `trading212_get_account_summary` (no args)
- `trading212_get_positions` (`ticker?`)
- `trading212_get_pending_orders` (`limit?`)
- `trading212_get_order` (`orderId`)

### Trading tools (real trades in live mode)

Buy:

- `trading212_place_limit_buy_order` (`ticker`, `quantity`, `limitPrice`, `timeValidity?`)
- `trading212_place_market_buy_order` (`ticker`, `quantity`, `timeValidity?`)
- `trading212_place_stop_buy_order` (`ticker`, `quantity`, `stopPrice`, `timeValidity?`)
- `trading212_place_stop_limit_buy_order` (`ticker`, `quantity`, `limitPrice`, `stopPrice`, `timeValidity?`)

Sell (separate tools; `quantity` stays positive and will be converted to a SELL order):

- `trading212_place_limit_sell_order` (`ticker`, `quantity`, `limitPrice`, `timeValidity?`)
- `trading212_place_market_sell_order` (`ticker`, `quantity`, `timeValidity?`)
- `trading212_place_stop_sell_order` (`ticker`, `quantity`, `stopPrice`, `timeValidity?`)
- `trading212_place_stop_limit_sell_order` (`ticker`, `quantity`, `limitPrice`, `stopPrice`, `timeValidity?`)

Other:

- `trading212_cancel_order` (`orderId`)

## Examples

### Checking Account Balance

> **User:** "What's my current cash balance?"

Claude uses `trading212_get_account_summary` and returns:
```
Account 1 (USD)
Available: $100.00 | Reserved: $0.00
Total: $1000.00 | Investments: $900.00 | Unrealized P/L: +$100.00
```

### Viewing Open Positions

> **User:** "Show me all my current positions"

Claude uses `trading212_get_positions` and displays your portfolio with P/L.

### Placing a Trade

> **User:** "Buy 10 shares of AAPL at market price"

Claude uses `trading212_place_market_buy_order` to execute immediately.

### Setting a Stop Loss

> **User:** "Set a stop order to sell 5 shares of TSLA if it drops below $150"

Claude uses `trading212_place_stop_sell_order` to set the protective stop.

### Canceling an Order

> **User:** "Cancel my pending AAPL order"

Claude uses `trading212_cancel_order` to remove the order.

## Development

### Prerequisites

- Node.js >= 18.x
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/DeanT-04/Trading212_MCP.git
cd Trading212_MCP

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

### Project Structure

```
Trading212_MCP/
├── src/
│   ├── index.ts           # Main entry point
│   ├── api/
│   │   ├── client.ts    # Trading212 API client
│   │   └── types.ts    # Zod schemas + TypeScript types
│   ├── tools/
│   │   ├── accounts.ts # Account tools
│   │   ├── positions.ts # Position tools
│   │   └── orders.ts   # Order tools
│   └── utils/
│       ├── errors.ts    # Error handling
│       ├── mcp.ts       # MCP helpers
│       └── pagination.ts # Pagination utilities
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── .gitignore
```

## Testing with MCP Inspector

```bash
# Run the MCP Inspector to test tools
npm run inspector
```

The Inspector provides an interactive UI to test all available tools.

## Contributing

Contributions are welcome. Please ensure:

- All tests pass (`npm test`)
- Code is properly typed
- Tools have clear descriptions

## License

MIT License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2026 DeanT

---

## Related Links

- [Trading212 API Documentation](https://docs.trading212.com/api)
- [MCP Specification](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
