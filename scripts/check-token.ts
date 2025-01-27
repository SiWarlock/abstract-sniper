import { ethers } from "ethers";
import * as dotenv from "dotenv";

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
    }
];

const TOKEN_ADDRESS = "0xdFF5feb9B6AF999e7F1f1e64B6E4Dae30a9FaEaF";

// ERC20 ABI - only the functions we need
const TOKEN_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

async function main() {
    if (!process.env.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY not found in .env file");
    }

    console.log("\nChecking token balance on Abstract network...");

    // Try each RPC until one works
    for (const config of NETWORK_CONFIGS) {
        try {
            console.log(`\nTrying ${config.name}...`);
            const provider = new ethers.providers.JsonRpcProvider(config.url, {
                chainId: config.chainId,
                name: config.name
            });

            // Test if RPC is responsive
            await provider.getBlockNumber();

            const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, wallet);

            // Get token details
            const [balance, decimals, symbol] = await Promise.all([
                token.balanceOf(wallet.address),
                token.decimals(),
                token.symbol()
            ]);

            console.log("\nToken Balance:");
            console.log(`- Address: ${wallet.address}`);
            console.log(`- Balance: ${ethers.utils.formatUnits(balance, decimals)} ${symbol}`);
            console.log(`- Raw Balance: ${balance.toString()}`);
            
            // Successfully got balance, exit
            process.exit(0);
        } catch (error: any) {
            console.log(`Failed to check balance using ${config.name}: ${error.message}`);
            // Continue to next RPC if this one failed
            continue;
        }
    }

    console.error("Failed to check balance using any RPC");
    process.exit(1);
}

main().catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
}); 