import { ethers } from "ethers";
import axios from "axios";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Network Configuration with multiple RPCs
const NETWORK_CONFIGS = [
    {
        url: "https://abstract.leakedrpc.com",
        chainId: 2741,
        name: "Abstract (Leaked RPC)"
    },
    {
        url: "https://api.abs.xyz",
        chainId: 2741,
        name: "Abstract (Official RPC)"
    },
    {
        url: "https://api.mainnet.abs.xyz",
        chainId: 2741,
        name: "Abstract (Mainnet RPC)"
    },
    {
        url: "https://abs.xyz",
        chainId: 2741,
        name: "Abstract (Base RPC)"
    },
    {
        url: "https://abstract-mainnet.public.blastapi.io",
        chainId: 2741,
        name: "Abstract (Blast API)"
    }
];

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

async function isRPCFunctional(provider: ethers.providers.JsonRpcProvider, rpcName: string): Promise<boolean> {
  console.log(`\nChecking ${rpcName}...`);
  try {
    const blockNumber = await provider.getBlockNumber();
    console.log(`${rpcName} - Block number: ${blockNumber}`);

    const latestBlock = await provider.getBlock(blockNumber);
    if (!latestBlock) {
      console.log(`${rpcName} - Failed to get latest block details`);
      return false;
    }

    const blockTimestamp = Number(latestBlock.timestamp) * 1000;
    const now = Date.now();
    
    if (now - blockTimestamp > FIVE_MINUTES) {
      console.log(`${rpcName} - Chain appears stale - last block too old`);
      return false;
    }

    console.log(`${rpcName} - RPC is functional!`);
    return true;
  } catch (error: any) {
    // Handle error gracefully without full stack trace
    console.log(`${rpcName} - RPC check failed - ${error.message || 'Unknown error'}`);
    return false;
  }
}

async function attemptSwap(router: ethers.Contract, path: string[], wallet: ethers.Wallet, amountIn: ethers.BigNumber): Promise<boolean> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Check balance before attempting swap
            const balance = await wallet.getBalance();
            if (balance.lt(amountIn)) {
                console.log(`\nInsufficient balance for swap:`);
                console.log(`- Required: ${ethers.utils.formatEther(amountIn)} ETH`);
                console.log(`- Current: ${ethers.utils.formatEther(balance)} ETH`);
                await sendNotification(`⚠️ Insufficient balance: ${ethers.utils.formatEther(balance)} ETH / ${ethers.utils.formatEther(amountIn)} ETH required`);
                
                // Wait for sufficient balance before next attempt
                while ((await wallet.getBalance()).lt(amountIn)) {
                    console.log("Waiting for sufficient balance...");
                    await new Promise(resolve => setTimeout(resolve, 2500)); // Wait 5 seconds
                }
                console.log("\nSufficient balance now available!");
                await sendNotification("✅ Sufficient balance now available for swap");
            }

            console.log(`Swap attempt ${attempt}/${MAX_RETRIES}`);
            await sendNotification(`🚀 Attempting swap ${attempt}/${MAX_RETRIES}`);
            
            const amounts = await router.getAmountsOut(amountIn, path);
            console.log(`Expected output amount: ${ethers.utils.formatUnits(amounts[1], 18)}`);
            
            const minOut = amounts[1].mul(1).div(100);
            const deadline = Math.floor(Date.now() / 1000) + 60 * 2;
            
            // Get the next available nonce (including pending transactions)
            const nonce = await wallet.getTransactionCount("pending");
            console.log(`Using nonce: ${nonce}`);
            
            const tx = await router.swapExactETHForTokens(
                minOut,
                path,
                wallet.address,
                deadline,
                { 
                    value: amountIn,
                    gasLimit: 500000,
                    gasPrice: ethers.utils.parseUnits("20", "gwei"),
                    nonce: nonce
                }
            );
            
            console.log(`Transaction sent! Hash: ${tx.hash}`);
            await sendNotification(`📝 Transaction sent! Hash: ${tx.hash}`);
            
            await tx.wait();
            console.log("Transaction confirmed! Swap successful!");
            await sendNotification("✅ Swap successful! Transaction confirmed!");
            return true;
        } catch (error: any) {
            // More detailed error logging
            console.log(`\nAttempt ${attempt} failed with error:`);
            console.log(`- Message: ${error.message}`);
            if (error.transaction) {
                console.log(`- From: ${error.transaction.from}`);
                console.log(`- To: ${error.transaction.to}`);
                console.log(`- Gas Price: ${ethers.utils.formatUnits(error.transaction.gasPrice || "0", "gwei")} gwei`);
                console.log(`- Nonce: ${error.transaction.nonce}`);
            }
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
  const ETH_AMOUNT = "0.2";
  console.log("Starting RPC monitor and sniper...");
  await sendNotification("🔄 Starting RPC monitor and sniper...");
  
  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY not found in .env file");
  }

  // Create providers for each RPC
  const providers = NETWORK_CONFIGS.map(config => ({
    provider: new ethers.providers.JsonRpcProvider(config.url, {
      chainId: config.chainId,
      name: config.name
    }),
    name: config.name,
    url: config.url
  }));

  let lastWorkingRPC = "";

  while (true) {
    console.log("\n--- Checking RPCs ---");
    // Check all RPCs
    for (const { provider, name, url } of providers) {
      const isRPCWorking = await isRPCFunctional(provider, name);
      
      if (isRPCWorking) {
        if (lastWorkingRPC !== url) {
          lastWorkingRPC = url;
          console.log(`\n🟢 ${name} is now functional and will be used for transactions`);
          await sendNotification(`✅ Using ${name} for transactions`);
        }
        
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
        const path = [WETH_ADDRESS, TOKEN_ADDRESS];
        const amountIn = ethers.utils.parseEther(ETH_AMOUNT);
        
        if (await attemptSwap(router, path, wallet, amountIn)) {
          process.exit(0);
        }
      } else {
        if (lastWorkingRPC === url) {
          lastWorkingRPC = "";
          await sendNotification(`❌ ${name} is no longer functional`);
        }
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

main().catch((error) => {
  console.error(error);
  sendNotification(`❌ Script error: ${error.message}`).finally(() => process.exit(1));
});