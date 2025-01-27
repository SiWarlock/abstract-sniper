import { ethers } from "ethers";
import axios from "axios";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Network Configuration (from hardhat.config.ts)
const NETWORK_CONFIG = {
    url: "https://abstract.leakedrpc.com",
    chainId: 2741,
    name: "Abstract"
};

const FACTORY_ADDRESS = "0xE1e98623082f662BCA1009a05382758f86F133b3";
const WETH_ADDRESS = "0x3439153eb7af838ad19d56e1571fbd09333c2809";
const ROUTER_ADDRESS = "0xF3d37F357e4E1A7AA87e3F13992c0604AbA6af13";
const TOKEN_ADDRESS = "0xc2EdaeabEB33551774914A6988C20AD7910c4626";
const MAX_RETRIES = 5;
const FIVE_MINUTES = 5 * 60 * 1000;
const NTFY_URL = 'https://ntfy.sh/absnipe';

let lastRPCStatus = false; // Track RPC status to avoid spam notifications

async function sendNotification(message: string) {
    try {
        await axios.post(NTFY_URL, message, {
            headers: {
                'Content-Type': 'text/plain',
            },
        });
        console.log('Notification sent successfully');
    } catch (error) {
        console.error('Failed to send notification:', error);
    }
}

// UniswapV2Router02 ABI - only the functions we need
const ROUTER_ABI = [
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
];

async function isRPCFunctional(provider: ethers.providers.JsonRpcProvider): Promise<boolean> {
  try {
    const blockNumber = await provider.getBlockNumber();
    console.log('Block number:', blockNumber);

    const latestBlock = await provider.getBlock(blockNumber);
    if (!latestBlock) {
      console.log('Failed to get latest block details');
      return false;
    }

    const blockTimestamp = Number(latestBlock.timestamp) * 1000;
    const now = Date.now();
    
    if (now - blockTimestamp > FIVE_MINUTES) {
      console.log('Chain appears stale - last block too old');
      return false;
    }

    return true;
  } catch (error) {
    console.log('RPC check failed:', error);
    return false;
  }
}

async function attemptSwap(router: ethers.Contract, path: string[], wallet: ethers.Wallet, amountIn: ethers.BigNumber): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Swap attempt ${attempt}/${MAX_RETRIES}`);
      await sendNotification(`🚀 Attempting swap ${attempt}/${MAX_RETRIES}`);
      
      const amounts = await router.getAmountsOut(amountIn, path);
      console.log(`Expected output amount: ${ethers.utils.formatEther(amounts[1])} tokens`);
      
      const minOut = amounts[1].mul(50).div(100);
      const deadline = Math.floor(Date.now() / 1000) + 60 * 2;
      
      const tx = await router.swapExactETHForTokens(
        minOut,
        path,
        wallet.address,
        deadline,
        { 
          value: amountIn,
          gasLimit: 500000,
          gasPrice: ethers.utils.parseUnits("20", "gwei"),  // Doubled gas price for higher priority
        }
      );
      
      console.log(`Transaction sent! Hash: ${tx.hash}`);
      await sendNotification(`📝 Transaction sent! Hash: ${tx.hash}`);
      
      await tx.wait();
      console.log("Transaction confirmed! Snipe successful!");
      await sendNotification("✅ Snipe successful! Transaction confirmed!");
      return true;
    } catch (error: any) {
      console.log(`Attempt ${attempt} failed:`, error.message);
      await sendNotification(`❌ Swap attempt ${attempt} failed: ${error.message}`);
      if (attempt === MAX_RETRIES) {
        console.log("Max retry attempts reached");
        await sendNotification("⚠️ Max retry attempts reached, monitoring RPC...");
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  return false;
}

async function main() {
  const ETH_AMOUNT = "0.005";
  console.log("Starting RPC monitor and sniper...");
  await sendNotification("🔄 Starting RPC monitor and sniper...");
  
  // Debug logging
  console.log("Environment variables loaded:", {
    hasPrivateKey: !!process.env.PRIVATE_KEY,
    privateKeyLength: process.env.PRIVATE_KEY?.length
  });
  
  // Use the same network config as hardhat.config.ts
  const provider = new ethers.providers.JsonRpcProvider(NETWORK_CONFIG.url, {
    chainId: NETWORK_CONFIG.chainId,
    name: NETWORK_CONFIG.name
  });

  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY not found in .env file");
  }

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log(`Using wallet address: ${wallet.address}`);
  
  while (true) {
    const isRPCWorking = await isRPCFunctional(provider);
    
    // Only notify on status changes to avoid spam
    if (isRPCWorking !== lastRPCStatus) {
      lastRPCStatus = isRPCWorking;
      if (isRPCWorking) {
        await sendNotification("✅ RPC is now functional! Attempting to snipe...");
      } else {
        await sendNotification("❌ RPC is not functional");
      }
    }
    
    if (isRPCWorking) {
      const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
      const path = [WETH_ADDRESS, TOKEN_ADDRESS];
      const amountIn = ethers.utils.parseEther(ETH_AMOUNT);
      
      if (await attemptSwap(router, path, wallet, amountIn)) {
        process.exit(0);
      }
    } else {
      console.log("RPC not fully functional yet");
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

main().catch((error) => {
  console.error(error);
  sendNotification(`❌ Script error: ${error.message}`).finally(() => process.exit(1));
}); 