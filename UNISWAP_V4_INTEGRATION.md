# Uniswap V4 Integration Guide

## Overview

This integration adds DeFi portfolio tracking for Uniswap V4 liquidity positions across 5 chains:
- Ethereum (Chain ID: 1)
- BSC (Chain ID: 56)
- Base (Chain ID: 8453)
- Arbitrum One (Chain ID: 42161)
- Unichain (Chain ID: 1301)

## API Endpoint

### Get Positions

```
GET /api/v4/positions/:walletAddress?chainId={chainId}
```

**Parameters:**
- `walletAddress` (required) - Ethereum wallet address (0x + 40 hex chars)
- `chainId` (optional) - Filter by specific chain (1, 56, 8453, 42161, 1301)

**Response:**
```json
{
  "success": true,
  "data": {
    "walletAddress": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "positions": [...],
    "totalValueUsd": 9000.00,
    "totalFeesUsd": 90.00,
    "timestamp": "2026-02-06T14:10:00.000Z",
    "chainErrors": []
  },
  "message": "Found 1 positions"
}
```

## Environment Setup

### Required Environment Variables

```bash
# The Graph API key (get from https://thegraph.com/studio/)
THE_GRAPH_API_KEY=your_api_key_here

# CoinMarketCap API key (get from https://pro.coinmarketcap.com/account)
COINMARKETCAP_API_KEY=your_cmc_key_here
```

### Optional RPC Endpoints

By default, the service uses public RPCs. For better reliability, set private RPC URLs:

```bash
INFURA_ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
INFURA_BSC_RPC_URL=https://bsc-dataseed.binance.org
BASE_RPC_URL=https://mainnet.base.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
UNICHAIN_RPC_URL=https://rpc.unichain.org
```

## Current Status

### ✅ Implemented

- [x] Multi-chain support (5 chains)
- [x] Chain configuration with contract addresses
- [x] PriceService with CoinMarketCap integration
- [x] UniswapV4Service architecture
- [x] API routes with validation
- [x] Error handling and graceful degradation
- [x] Unit tests (PriceService: 100% coverage)
- [x] Type definitions
- [x] Documentation

### ⚠️ Known Issues

#### 1. GraphQL Schema Mismatch

**Problem:** The Graph subgraph schema is not matching our query.

**Current Query:**
```graphql
query GetPositions($owner: Bytes!) {
  tokens(where: { owner: $owner }) {
    id
    owner
  }
}
```

**Error:** `Type 'Query' has no field 'tokens'`

**Solutions:**

##### Option A: Schema Introspection (Recommended)

Run the introspection script to discover the correct schema:

```bash
# Install ts-node if not already installed
pnpm add -D ts-node

# Run introspection
THE_GRAPH_API_KEY=your_key ts-node scripts/introspect-subgraph.ts
```

This will show all available query fields. Look for position-related entities.

##### Option B: Manual Testing

1. Visit The Graph Explorer: https://thegraph.com/explorer
2. Search for "Uniswap V4" subgraphs
3. Open the playground and try queries:

```graphql
# Try different entity names:
{ positions(first: 1) { id owner tokenId } }
{ positionNFTs(first: 1) { id owner } }
{ tokens(first: 1) { id owner } }
{ accounts(first: 1) { id positions { id } } }
```

4. Once you find the correct entity, update `src/core/UniswapV4Service.ts`:

```typescript
const GET_POSITIONS_QUERY = `
  query GetPositions($owner: Bytes!) {
    YOUR_ENTITY_HERE(where: { owner: $owner }) {
      id
      # Add other fields as needed
    }
  }
`;
```

##### Option C: Use Blockchain Events (Fallback)

If The Graph doesn't work, query blockchain events directly:

```typescript
// Listen to Transfer events from Position Manager
const transferEvents = await viemClient.getLogs({
  address: positionManagerAddress,
  event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
  fromBlock: 'earliest',
  args: { to: walletAddress }
});
```

#### 2. Simplified Position Calculations

**Current Implementation:**
- Token amounts: 50/50 liquidity split (inaccurate)
- Fees: 1% of position value (estimate)

**To Improve:**

1. **Token Amounts** - Use tick-based calculation:
```typescript
import { Position } from '@uniswap/v4-sdk';
import { Token } from '@uniswap/sdk-core';

const position = new Position({
  pool,
  liquidity,
  tickLower,
  tickUpper
});

const amount0 = position.amount0.toSignificant(6);
const amount1 = position.amount1.toSignificant(6);
```

2. **Fees** - Query `feeGrowthInside`:
```typescript
const fees = await viemClient.readContract({
  address: poolManagerAddress,
  abi: POOL_MANAGER_ABI,
  functionName: 'getFeeGrowthInside',
  args: [poolKey, tickLower, tickUpper]
});
```

## Testing

### Run Tests

```bash
# All tests
pnpm test

# With coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

### Manual API Testing

```bash
# Start server
pnpm dev

# Health check
curl http://localhost:3000/health

# Test validation (invalid address)
curl http://localhost:3000/api/v4/positions/invalid

# Test validation (invalid chainId)
curl "http://localhost:3000/api/v4/positions/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?chainId=999"

# Test specific chain
curl "http://localhost:3000/api/v4/positions/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?chainId=1"

# Test all chains (slower)
curl http://localhost:3000/api/v4/positions/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

## Architecture

```
GET /api/v4/positions/:address
         ↓
   UniswapV4Service.getPositions()
         ↓
    ┌────────────┬──────────────┬───────────────┐
    ↓            ↓              ↓               ↓
The Graph    viem (RPC)   CoinMarketCap    Token Metadata
(positions)  (on-chain)     (prices)       (symbol, decimals)
```

### Key Components

1. **UniswapV4Service** (`src/core/UniswapV4Service.ts`)
   - Orchestrates position fetching
   - Parallel multi-chain queries
   - Error handling with chainErrors

2. **PriceService** (`src/core/PriceService.ts`)
   - CoinMarketCap integration
   - 1-minute price caching
   - Batch price fetching

3. **v4-config.ts** (`src/core/v4-config.ts`)
   - Chain configurations
   - Contract addresses
   - RPC URLs
   - Subgraph URLs

## Troubleshooting

### Issue: "No API key" warnings

**Solution:** Set environment variables:
```bash
export THE_GRAPH_API_KEY=your_key
export COINMARKETCAP_API_KEY=your_key
```

### Issue: RPC rate limits

**Solution:** Use private RPC providers (Infura, Alchemy, QuickNode):
```bash
export INFURA_ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
```

### Issue: Slow responses

**Cause:** Querying all 5 chains in parallel can take 10-30 seconds.

**Solution:** Use `?chainId=1` to query specific chains:
```bash
curl "http://localhost:3000/api/v4/positions/0xADDRESS?chainId=1"
```

### Issue: Empty positions

**Possible causes:**
1. Wallet has no Uniswap V4 positions
2. GraphQL schema issue (see above)
3. Subgraph not synced yet

**Debug:**
```bash
# Check server logs for errors
tail -f logs/app.log

# Check subgraph status
curl "https://gateway.thegraph.com/api/APIKEY/subgraphs/id/SUBGRAPH_ID/status"
```

## Roadmap

### Phase 1: Fix Schema Issue ⚠️
- [ ] Run introspection script
- [ ] Update GraphQL query
- [ ] Test with real wallet addresses
- [ ] Verify BSC and Arbitrum subgraph IDs

### Phase 2: Improve Calculations
- [ ] Implement accurate token amount calculation using @uniswap/v4-sdk
- [ ] Implement accurate fee calculation using feeGrowthInside
- [ ] Add tick math utilities

### Phase 3: Performance
- [ ] Implement multicall for batch RPC calls
- [ ] Add Redis caching (1-minute TTL)
- [ ] Add request rate limiting
- [ ] Optimize parallel queries

### Phase 4: Features
- [ ] Add historical position data
- [ ] Add APR/APY calculations
- [ ] Add impermanent loss tracking
- [ ] WebSocket endpoint for real-time updates
- [ ] Add more chains as V4 deploys

## Resources

- [Uniswap V4 Docs](https://docs.uniswap.org/contracts/v4/overview)
- [Uniswap V4 Deployments](https://docs.uniswap.org/contracts/v4/deployments)
- [The Graph Docs](https://thegraph.com/docs/en/)
- [Viem Docs](https://viem.sh)
- [CoinMarketCap API](https://coinmarketcap.com/api/documentation/v1/)

## Support

For issues or questions:
1. Check this documentation
2. Review server logs
3. Run introspection script
4. Check The Graph Explorer
5. Open GitHub issue with logs and error details
