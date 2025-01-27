import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const provider = new ethers.providers.JsonRpcProvider("https://api.mainnet.abs.xyz", {
        chainId: 2741,
        name: 'Abstract'
    });

    if (!process.env.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY not found in .env file");
    }

    // Remove 0x prefix if present and ensure proper length
    let privateKey = process.env.PRIVATE_KEY;
    if (!privateKey.startsWith("0x")) {
        privateKey = "0x" + privateKey;
    }
    
    try {
        const wallet = new ethers.Wallet(privateKey, provider);
        const ethBalance = await provider.getBalance(wallet.address);
        console.log(`Network: Abstract (Chain ID: 2741)`);
        console.log(`Wallet Address: ${wallet.address}`);
        console.log(`ETH Balance: ${ethers.utils.formatEther(ethBalance)} ETH`);
    } catch (error) {
        console.error("Error fetching balance:", error);
    }
}

main().catch(console.error);