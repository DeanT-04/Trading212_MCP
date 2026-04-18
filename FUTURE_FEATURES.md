# Future Features

This document outlines planned features and enhancements for the Trading212 MCP Server. Features are organized by priority and phase.

---

## Phase 2: Instruments & Metadata

### Planned Tools

| Tool | Endpoint | Description |
|------|----------|-------------|
| `list_exchanges` | `/api/v0/equity/metadata/exchanges` | Get available exchanges |
| `list_instruments` | `/api/v0/equity/metadata/instruments` | Get all available trading instruments |

### Implementation Notes

- Use pagination for large instrument lists
- Cache instrument metadata locally with refresh interval
- Support filtering by exchange, instrument type

---

## Phase 3: Historical Data

### Planned Tools

| Tool | Endpoint | Description |
|------|----------|-------------|
| `get_dividends` | `/api/v0/equity/history/dividends` | Get paid dividends |
| `list_reports` | `/api/v0/equity/history/exports` | List generated CSV reports |
| `request_report` | `/api/v0/equity/history/exports` | Request CSV report export |
| `get_order_history` | `/api/v0/equity/history/orders` | Get historical orders |
| `get_transactions` | `/api/v0/equity/history/transactions` | Get account transactions |

### Implementation Notes

- Support date range filtering
- Export to CSV functionality
- Transaction categorization

---

## Phase 4: Workflow Tools

### Composite Tools

| Tool | Description |
|------|-------------|
| `get_portfolio_summary` | Combined account + positions in one call |
| `close_position` | Close a specific position (sell all shares) |
| `close_all_positions` | Close all open positions |
| `calculate_position_pnl` | Calculate P/L for a position |

### Implementation Notes

- Reduce number of API calls for common workflows
- Add confirmation prompts for destructive operations
- Support partial position closing

---

## Phase 5: Advanced Features

### Enhanced Order Types

| Tool | Description |
|------|-------------|
| `modify_order` | Modify an existing pending order |
| `get_order_status` | Get real-time order status |
| `place_oco_order` | Place One Cancels Other order |
| `place_bracket_order` | Place bracket order with profit target + stop loss |

### Risk Management

| Tool | Description |
|------|-------------|
| `set_position_alert` | Set price alert for position |
| `get_portfolio_risk` | Calculate portfolio risk metrics |
| `estimate_margin` | Estimate margin requirements |

### Market Data

| Tool | Description |
|------|-------------|
| `get_quote` | Get real-time quote for instrument |
| `get_historical_prices` | Get historical price data |
| `get_market_status` | Get exchange market status |

---

## Phase 6: Extended Integration

### Watchlist Management

| Tool | Description |
|------|-------------|
| `get_watchlist` | Get user watchlist |
| `add_to_watchlist` | Add instrument to watchlist |
| `remove_from_watchlist` | Remove instrument from watchlist |

### Advanced Orders

| Tool | Description |
|------|-------------|
| `place_trailing_stop` | Trailing stop order |
| `place_trailing_stop_limit` | Trailing stop-limit order |
| `place_iceberg_order` | Iceberg/large volume order |

---

## Feature Request Process

To request a new feature:

1. Open an issue on GitHub
2. Describe the use case
3. Provide any relevant API documentation references

---

## Version History

| Version | Date | Features |
|---------|------|---------|
| 1.0.0 | 2026-04-18 | Core 9 tools: accounts, positions, orders (pending, place, cancel) |
| 1.1.0 | TBD | Instruments & metadata |
| 1.2.0 | TBD | Historical data |
| 1.3.0 | TBD | Workflow tools |
| 1.4.0 | TBD | Advanced features |
| 1.5.0 | TBD | Extended integration |

---

## Dependencies

- Trading212 API v0 (beta)
- MCP Protocol Specification
- Node.js >= 18.x