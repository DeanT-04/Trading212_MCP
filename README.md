# trading212-mcp-server

A Model Context Protocol (MCP) server for Trading212 brokerage API. Enables AI assistants to interact with Trading212 trading accounts for portfolio management, order placement, and account monitoring.

[![npm version](https://img.shields.io/npm/v/trading212-mcp-server)](https://www.npmjs.com/package/trading212-mcp-server)
[![Node.js version](https://img.shields.io/node/v/trading212-mcp-server)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

## Features

- **Full Trading212 API Integration** - Access accounts, positions, orders, and trading operations
- **9 Trading Tools** - Comprehensive coverage of core Trading212 functionality
- **MCP Protocol Compliant** - Works with any MCP-compatible client (Claude Desktop, Cursor, OpenCode, etc.)
- **TypeScript** - Fully typed for excellent developer experience
- **stdio Transport** - Simple local deployment
- **Demo Mode First** - Safe testing via paper trading before live trading
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

> **Note:** Start with **demo mode** (paper trading) to test integration safely.

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
      "enabled": true,
      "environment": {
        "TRADING212_API_KEY": "your_api_key",
        "TRADING212_SECRET": "your_secret",
        "TRADING212_LIVE_MODE": "false"
      }
    }
  }
}
```

> **Note:** The included `opencode.json` has placeholder values - update with your actual API credentials.

## Configuration

### Environment Variables

The server uses the following environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `TRADING212_API_KEY` | Yes | Your Trading212 API key |
| `TRADING212_SECRET` | Yes | Your Trading212 API secret |
| `TRADING212_LIVE_MODE` | No | Set to `true` for live trading (default: `false` = demo/paper trading) |

### Using a `.env` File

Create a `.env` file in your project directory:

```bash
TRADING212_API_KEY=your_api_key_here
TRADING212_SECRET=your_secret_here
TRADING212_LIVE_MODE=false
```

> **Security Note:** Never commit your API credentials to version control. The `.env.example` file is included as a template - copy it to `.env` and ensure `.env` is in your `.gitignore`.

## Tools

This MCP server exposes 9 trading tools:

### get_account_summary

Get account overview including account ID, currency, and cash balance.

**Parameters:** None

**Example Request:**
```json
{
  "name": "get_account_summary",
  "arguments": {}
}
```

**Example Response:**
```
Account Summary:
- Account ID: ACC-XXXXXXXX
- Currency: USD
- Cash Balance: $10000.00
```

---

### get_positions

Get all open positions with quantity, average price, current price, and profit/loss.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Max positions to return (1-50, default: 20) |
| `cursor` | string | No | Pagination cursor |

**Example Request:**
```json
{
  "name": "get_positions",
  "arguments": {
    "limit": 10
  }
}
```

**Example Response:**
```
Open Positions (3):
AAPL: 10 shares @ 150.00 (now 155.50) | P/L: +55.00 (+36.67%)
TSLA: 5 shares @ 200.00 (now 195.00) | P/L: -25.00 (-25.00%)
```

---

### get_pending_orders

Get all pending (not yet executed) orders.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Max orders to return (1-50, default: 20) |
| `cursor` | string | No | Pagination cursor |

**Example Request:**
```json
{
  "name": "get_pending_orders",
  "arguments": {}
}
```

---

### get_order

Get details of a specific pending order by ID.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderId` | string | Yes | The order ID to retrieve |

**Example Request:**
```json
{
  "name": "get_order",
  "arguments": {
    "orderId": "ORD-XXXXXXXX"
  }
}
```

---

### place_limit_order

Place a limit order (execute at specified price or better).

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instrumentId` | string | Yes | Trading instrument ticker (e.g., "AAPL", "BTC.USD") |
| `quantity` | number | Yes | Number of shares (positive integer) |
| `limitPrice` | number | Yes | Limit price per share |
| `timeInForce` | string | No | Expiration: `day`, `good_until_cancelled`, `at_the_open`, `at_the_close` |

**Example Request:**
```json
{
  "name": "place_limit_order",
  "arguments": {
    "instrumentId": "AAPL",
    "quantity": 10,
    "limitPrice": 150.00
  }
}
```

---

### place_market_order

Place a market order (execute immediately at best available price).

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instrumentId` | string | Yes | Trading instrument ticker |
| `quantity` | number | Yes | Number of shares |
| `timeInForce` | string | No | Expiration: `day`, `good_until_cancelled`, `at_the_open`, `at_the_close` |

**Example Request:**
```json
{
  "name": "place_market_order",
  "arguments": {
    "instrumentId": "AAPL",
    "quantity": 5
  }
}
```

---

### place_stop_order

Place a stop order (trigger when price reaches specified level).

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instrumentId` | string | Yes | Trading instrument ticker |
| `quantity` | number | Yes | Number of shares |
| `triggerPrice` | number | Yes | Trigger price |
| `timeInForce` | string | No | Expiration: `day`, `good_until_cancelled`, `at_the_open`, `at_the_close` |

**Example Request:**
```json
{
  "name": "place_stop_order",
  "arguments": {
    "instrumentId": "TSLA",
    "quantity": 10,
    "triggerPrice": 145.00
  }
}
```

---

### place_stop_limit_order

Place a stop-limit order (stop triggered then executes at limit price).

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instrumentId` | string | Yes | Trading instrument ticker |
| `quantity` | number | Yes | Number of shares |
| `limitPrice` | number | Yes | Limit price |
| `triggerPrice` | number | Yes | Trigger price |
| `timeInForce` | string | No | Expiration: `day`, `good_until_cancelled`, `at_the_open`, `at_the_close` |

**Example Request:**
```json
{
  "name": "place_stop_limit_order",
  "arguments": {
    "instrumentId": "TSLA",
    "quantity": 10,
    "limitPrice": 139.50,
    "triggerPrice": 140.00
  }
}
```

---

### cancel_order

Cancel a pending order by ID.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderId` | string | Yes | The order ID to cancel |

**Example Request:**
```json
{
  "name": "cancel_order",
  "arguments": {
    "orderId": "ORD-XXXXXXXX"
  }
}
```

## Examples

### Checking Account Balance

> **User:** "What's my current cash balance?"

Claude uses `get_account_summary` and returns:
```
Account Summary:
- Account ID: ACC-XXXXXXXX
- Currency: USD
- Cash Balance: $10000.00
```

### Viewing Open Positions

> **User:** "Show me all my current positions"

Claude uses `get_positions` and displays your portfolio with P/L.

### Placing a Trade

> **User:** "Buy 10 shares of AAPL at market price"

Claude uses `place_market_order` to execute immediately.

### Setting a Stop Loss

> **User:** "Set a stop order to sell 5 shares of TSLA if it drops below $150"

Claude uses `place_stop_order` to set the protective stop.

### Canceling an Order

> **User:** "Cancel my pending AAPL order"

Claude uses `cancel_order` to remove the order.

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
│   │   └── types.ts    # TypeScript interfaces
│   ├── tools/
│   │   ├── accounts.ts # Account tools
│   │   ├── positions.ts # Position tools
│   │   └── orders.ts   # Order tools
│   └── utils/
│       ├── errors.ts    # Error handling
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

- All tests pass (`npm run build`)
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