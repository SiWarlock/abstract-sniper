import { ethers } from "ethers";
import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

// Network Configuration with multiple RPCs
const NETWORK_CONFIGS = [
    {
        url: "https://eth.llamarpc.com",
        chainId: 1,
        name: "Ethereum (LlamaRPC)"
    },
    {
        url: "https://rpc.ankr.com/eth",
        chainId: 1,
        name: "Ethereum (Ankr)"
    }
];

// Ethereum Mainnet Uniswap V2 Contracts
const FACTORY_ADDRESS = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const TOKEN_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC
const MAX_RETRIES = 5;
const FIVE_MINUTES = 5 * 60 * 1000;
const NTFY_URL = 'https://ntfy.sh/absnipe';

let lastRPCStatus = false;

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
        console.log(`${rpcName} - RPC check failed - ${error.message || 'Unknown error'}`);
        return false;
    }
}

async function attemptSwap(router: ethers.Contract, path: string[], wallet: ethers.Wallet, amountIn: ethers.BigNumber): Promise<boolean> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`Swap attempt ${attempt}/${MAX_RETRIES}`);
            await sendNotification(`🚀 Attempting swap ${attempt}/${MAX_RETRIES}`);
            
            const amounts = await router.getAmountsOut(amountIn, path);
            console.log(`Expected output amount: ${ethers.utils.formatUnits(amounts[1], 6)} USDC`); // USDC has 6 decimals
            
            const minOut = amounts[1].mul(50).div(100);
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
                    gasLimit: 300000,
                    gasPrice: ethers.utils.parseUnits("10", "gwei"),
                    nonce: nonce // Explicitly set the nonce
                }
            );
            
            console.log(`Transaction sent! Hash: ${tx.hash}`);
            await sendNotification(`📝 Transaction sent! Hash: ${tx.hash}`);
            
            await tx.wait();
            console.log("Transaction confirmed! Test swap successful!");
            await sendNotification("✅ Test swap successful! Transaction confirmed!");
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
    const ETH_AMOUNT = "0.001"; // Small amount for testing
    console.log("Starting Ethereum test sniper...");
    await sendNotification("🔄 Starting Ethereum test sniper...");
    
    if (!process.env.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY not found in .env file");
    }

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