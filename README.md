# Abstract Chain Token Sniper

A TypeScript-based tool for monitoring the Abstract Chain's RPC availability and automatically purchasing a specific token when the RPC becomes functional.

## Purpose

The Abstract Chain is launching soon, and there's a leaked RPC that people are using. However, the RPC is intermittently functional. This tool:
1. Continuously monitors the RPC endpoint
2. Verifies chain functionality by checking block timestamps
3. Automatically attempts to purchase a specified token when the RPC becomes available
4. Sends notifications about RPC status and transaction attempts

## Features

- RPC Health Monitoring
- Mobile/Desktop Notifications via ntfy.sh
- 50% Slippage Protection
- High Gas Priority (20 gwei)
- Multiple Purchase Retry Attempts
- Balance Checking
- Detailed Error Reporting

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```
PRIVATE_KEY=your_private_key_here
```

3. Subscribe to notifications:
- Open https://ntfy.sh/absnipe in your browser
- Or install the ntfy app and subscribe to "absnipe" topic

## Available Scripts

- `npm start` - Run the main sniper bot (continuous monitoring)
- `npm run test-buy` - Attempt a single test purchase
- `npm run balance` - Check your wallet's ETH balance

## Configuration

Current settings (in scripts/snipe.ts and scripts/test-buy.ts):
- Purchase Amount: 0.005 ETH
- Gas Price: 20 gwei
- Gas Limit: 500,000
- Slippage: 50%
- Transaction Deadline: 2 minutes
- Max Retry Attempts: 5

## Target Details

- Chain: Abstract (ChainID: 2741)
- RPC URL: https://abstract.leakedrpc.com
- DEX: Uniswap V2 Fork
- Default Target Token: 0xc2EdaeabEB33551774914A6988C20AD7910c4626 (Change this in both scripts)
- Router: 0xF3d37F357e4E1A7AA87e3F13992c0604AbA6af13
- WETH: 0x3439153eb7af838ad19d56e1571fbd09333c2809

### Changing Target Token

To snipe a different token:
1. Replace `TOKEN_ADDRESS` in both `scripts/snipe.ts` and `scripts/test-buy.ts` with your desired token address
2. Make sure to test with `npm run test-buy` before running the sniper

## Safety

- Never share your private key
- Test with small amounts first using `npm run test-buy`
- Verify your wallet balance before running using `npm run balance`
- Monitor the notifications to stay updated on the bot's status

## Error Handling

The bot will:
- Retry failed transactions up to 5 times
- Send notifications for all important events
- Continue monitoring if transactions fail
- Exit if there's an unrecoverable error

## Notifications

You'll receive notifications for:
- RPC status changes
- Purchase attempts
- Transaction hashes
- Success/failure confirmations
- Error messages

## Requirements

- Node.js
- npm
- An Ethereum wallet with Abstract chain ETH
- Internet connection
