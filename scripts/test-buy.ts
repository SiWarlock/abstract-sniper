import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const NETWORK_CONFIG = {
    url: "https://abstract.leakedrpc.com",
    chainId: 2741,
    name: "Abstract"
};

const WETH_ADDRESS = "0x3439153eb7af838ad19d56e1571fbd09333c2809";
const ROUTER_ADDRESS = "0xF3d37F357e4E1A7AA87e3F13992c0604AbA6af13";
const TOKEN_ADDRESS = "0xc2EdaeabEB33551774914A6988C20AD7910c4626";

const ROUTER_ABI = [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
];

async function main() {
    console.log("Starting test buy...");
    
    const provider = new ethers.providers.JsonRpcProvider(NETWORK_CONFIG.url, {
        chainId: NETWORK_CONFIG.chainId,
        name: NETWORK_CONFIG.name
    });

    if (!process.env.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY not found in .env file");
    }

    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`Using wallet address: ${wallet.address}`);

    try {
        // Check ETH balance
        const balance = await provider.getBalance(wallet.address);
        console.log(`ETH Balance: ${ethers.utils.formatEther(balance)} ETH`);

        const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
        const path = [WETH_ADDRESS, TOKEN_ADDRESS];
        const amountIn = ethers.utils.parseEther("0.005"); // Test with 0.005 ETH

        // Get expected output amount
        const amounts = await router.getAmountsOut(amountIn, path);
        console.log(`Expected output amount: ${ethers.utils.formatEther(amounts[1])} tokens`);

        // Set 50% slippage
        const minOut = amounts[1].mul(50).div(100);
        const deadline = Math.floor(Date.now() / 1000) + 60 * 2; // 2 minutes

        console.log("Sending transaction...");
        const tx = await router.swapExactETHForTokens(
            minOut,
            path,
            wallet.address,
            deadline,
            {
                value: amountIn,
                gasLimit: 500000,
                gasPrice: ethers.utils.parseUnits("20", "gwei")
            }
        );

        console.log(`Transaction sent! Hash: ${tx.hash}`);
        console.log("Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log("Transaction confirmed! Test buy successful!");
        console.log(`Gas used: ${receipt.gasUsed.toString()}`);
        
    } catch (error: any) {
        console.error("Error during test buy:", error.message);
        if (error.reason) {
            console.error("Error reason:", error.reason);
        }
    }
}

main().catch(console.error); 