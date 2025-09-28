import { ethers } from "ethers";
import { 
  AllowanceProvider, 
  AllowanceTransfer, 
  PermitSingle,
  type PermitBatch,
  type PermitTransferFrom,
  type PermitTransferFromData,
  MaxUint256,
  MaxUint160,
  PERMIT2_ADDRESS
} from "@uniswap/permit2-sdk";
import type { SupportedToken, TokenTransaction, Permit2Signature } from "@shared/schema";

// Chain configurations
export const CHAIN_CONFIGS = {
  1: {
    name: "ethereum",
    rpcUrl: process.env.ETHEREUM_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/",
    chainId: 1,
    permit2Address: PERMIT2_ADDRESS,
    blockExplorer: "https://etherscan.io"
  },
  137: {
    name: "polygon",
    rpcUrl: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
    chainId: 137,
    permit2Address: PERMIT2_ADDRESS,
    blockExplorer: "https://polygonscan.com"
  },
  11155111: { // Sepolia testnet
    name: "sepolia",
    rpcUrl: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
    chainId: 11155111,
    permit2Address: PERMIT2_ADDRESS,
    blockExplorer: "https://sepolia.etherscan.io"
  }
};

// Default supported tokens (can be extended via database)
export const DEFAULT_SUPPORTED_TOKENS: Omit<SupportedToken, "id" | "createdAt">[] = [
  {
    address: "0xA0b86a33E6441036c080047fBD4A1dB085C5e47",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    chainId: 1,
    networkName: "ethereum",
    isActive: true,
    minDistributionAmount: "1000000" // 1 USDC (6 decimals)
  },
  {
    address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    symbol: "USDC",
    name: "USD Coin (PoS)",
    decimals: 6,
    chainId: 137,
    networkName: "polygon",
    isActive: true,
    minDistributionAmount: "1000000" // 1 USDC (6 decimals)
  },
  {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    chainId: 1,
    networkName: "ethereum",
    isActive: true,
    minDistributionAmount: "1000000" // 1 USDT (6 decimals)
  },
  {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    chainId: 1,
    networkName: "ethereum",
    isActive: true,
    minDistributionAmount: "1000000000000000000" // 1 DAI (18 decimals)
  }
];

export class Web3Service {
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();
  private allowanceProvider: AllowanceProvider | null;
  
  constructor() {
    // Initialize providers for each supported chain
    for (const [chainId, config] of Object.entries(CHAIN_CONFIGS)) {
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      this.providers.set(parseInt(chainId), provider);
    }
    
    // Initialize Permit2 allowance provider - we'll initialize it lazily when needed
    // Since AllowanceProvider expects a different Provider interface
    this.allowanceProvider = null as any;
  }

  /**
   * Get provider for a specific chain
   */
  getProvider(chainId: number): ethers.JsonRpcProvider {
    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`Provider not configured for chain ${chainId}`);
    }
    return provider;
  }

  /**
   * Get chain configuration
   */
  getChainConfig(chainId: number) {
    const config = CHAIN_CONFIGS[chainId as keyof typeof CHAIN_CONFIGS];
    if (!config) {
      throw new Error(`Chain ${chainId} not supported`);
    }
    return config;
  }

  /**
   * Check token balance for a given address
   */
  async getTokenBalance(
    tokenAddress: string,
    userAddress: string,
    chainId: number
  ): Promise<string> {
    const provider = this.getProvider(chainId);
    
    // ERC-20 balanceOf function selector
    const contract = new ethers.Contract(
      tokenAddress,
      [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)",
        "function name() view returns (string)"
      ],
      provider
    );

    try {
      const balance = await contract.balanceOf(userAddress);
      return balance.toString();
    } catch (error) {
      console.error(`Error getting token balance: ${error}`);
      throw new Error(`Failed to get token balance for ${tokenAddress}`);
    }
  }

  /**
   * Get token information
   */
  async getTokenInfo(tokenAddress: string, chainId: number) {
    const provider = this.getProvider(chainId);
    
    const contract = new ethers.Contract(
      tokenAddress,
      [
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)",
        "function name() view returns (string)"
      ],
      provider
    );

    try {
      const [decimals, symbol, name] = await Promise.all([
        contract.decimals(),
        contract.symbol(),
        contract.name()
      ]);

      return {
        address: tokenAddress,
        decimals: Number(decimals),
        symbol,
        name,
        chainId
      };
    } catch (error) {
      console.error(`Error getting token info: ${error}`);
      throw new Error(`Failed to get token info for ${tokenAddress}`);
    }
  }

  /**
   * Check Permit2 allowance for a token
   */
  async getPermit2Allowance(
    tokenAddress: string,
    userAddress: string,
    spender: string,
    chainId: number
  ): Promise<{ amount: string; expiration: number; nonce: number }> {
    try {
      const provider = this.getProvider(chainId);
      const permit2Contract = new ethers.Contract(
        PERMIT2_ADDRESS,
        [
          "function allowance(address user, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)"
        ],
        provider
      );

      const result = await permit2Contract.allowance(userAddress, tokenAddress, spender);
      
      return {
        amount: result.amount.toString(),
        expiration: Number(result.expiration),
        nonce: Number(result.nonce)
      };
    } catch (error) {
      console.error(`Error getting Permit2 allowance: ${error}`);
      throw new Error(`Failed to get Permit2 allowance`);
    }
  }

  /**
   * Create a Permit2 signature for token approval
   */
  async createPermit2Signature(
    token: SupportedToken,
    userAddress: string,
    spender: string,
    amount: string,
    deadline: number,
    privateKey?: string // Only for testing, in production this would be done client-side
  ): Promise<{
    signature: string;
    permitData: PermitSingle;
    nonce: number;
  }> {
    const provider = this.getProvider(token.chainId);
    const chainConfig = this.getChainConfig(token.chainId);

    // Get current nonce
    const allowance = await this.getPermit2Allowance(
      token.address,
      userAddress,
      spender,
      token.chainId
    );

    const permitData: PermitSingle = {
      details: {
        token: token.address,
        amount,
        expiration: deadline,
        nonce: allowance.nonce
      },
      spender,
      sigDeadline: deadline
    };

    // In production, this signature would be created client-side
    // Here we're providing the structure for testing purposes
    if (privateKey) {
      const wallet = new ethers.Wallet(privateKey, provider);
      const { domain, types, values } = AllowanceTransfer.getPermitData(
        permitData,
        PERMIT2_ADDRESS,
        token.chainId
      );

      // Convert domain to ethers v6 compatible format
      const ethersV6Domain: ethers.TypedDataDomain = {
        name: domain.name,
        version: domain.version,
        chainId: domain.chainId ? Number(domain.chainId) : token.chainId,
        verifyingContract: domain.verifyingContract
        // Omit salt to avoid type compatibility issues
      };

      const signature = await wallet.signTypedData(ethersV6Domain, types, values);
      
      return {
        signature,
        permitData,
        nonce: allowance.nonce
      };
    }

    // Return structure for client-side signing
    return {
      signature: "", // Would be filled by client
      permitData,
      nonce: allowance.nonce
    };
  }

  /**
   * Execute a token transfer using Permit2
   */
  async executePermit2Transfer(
    token: SupportedToken,
    from: string,
    to: string,
    amount: string,
    permitSignature: {
      signature: string;
      deadline: number;
      nonce: number;
    },
    executorPrivateKey: string // Private key of the address executing the transfer
  ): Promise<{ txHash: string; success: boolean }> {
    try {
      const provider = this.getProvider(token.chainId);
      const executor = new ethers.Wallet(executorPrivateKey, provider);

      const permit2Contract = new ethers.Contract(
        PERMIT2_ADDRESS,
        [
          "function permitTransferFrom(((address token, uint256 amount), address to, uint256 requestedAmount), (address owner, bytes signature)) external"
        ],
        executor
      );

      // Prepare transfer data
      const transferDetails = {
        token: token.address,
        amount
      };

      const permitTransferFrom = {
        permitted: transferDetails,
        to,
        requestedAmount: amount
      };

      const permitData = {
        owner: from,
        signature: permitSignature.signature
      };

      // Execute the transfer
      const tx = await permit2Contract.permitTransferFrom(
        permitTransferFrom,
        permitData,
        {
          gasLimit: 200000 // Adjust as needed
        }
      );

      console.log(`Permit2 transfer initiated: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      return {
        txHash: tx.hash,
        success: receipt.status === 1
      };
    } catch (error) {
      console.error(`Error executing Permit2 transfer: ${error}`);
      throw new Error(`Failed to execute Permit2 transfer: ${error}`);
    }
  }

  /**
   * Execute batch token transfers using Permit2
   */
  async executeBatchPermit2Transfer(
    transfers: Array<{
      token: SupportedToken;
      from: string;
      to: string;
      amount: string;
      permitSignature: {
        signature: string;
        deadline: number;
        nonce: number;
      };
    }>,
    executorPrivateKey: string
  ): Promise<{ txHashes: string[]; successCount: number }> {
    const txHashes: string[] = [];
    let successCount = 0;

    // Execute transfers sequentially (could be optimized for parallel execution)
    for (const transfer of transfers) {
      try {
        const result = await this.executePermit2Transfer(
          transfer.token,
          transfer.from,
          transfer.to,
          transfer.amount,
          transfer.permitSignature,
          executorPrivateKey
        );

        txHashes.push(result.txHash);
        if (result.success) successCount++;
      } catch (error) {
        console.error(`Batch transfer failed for ${transfer.to}: ${error}`);
        txHashes.push(""); // Placeholder for failed transaction
      }
    }

    return { txHashes, successCount };
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: string, chainId: number): Promise<{
    status: 'pending' | 'confirmed' | 'failed';
    blockNumber?: number;
    confirmations?: number;
  }> {
    const provider = this.getProvider(chainId);

    try {
      const tx = await provider.getTransaction(txHash);
      if (!tx) {
        return { status: 'failed' };
      }

      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) {
        return { status: 'pending' };
      }

      const currentBlock = await provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber + 1;

      return {
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        blockNumber: receipt.blockNumber,
        confirmations
      };
    } catch (error) {
      console.error(`Error getting transaction status: ${error}`);
      return { status: 'failed' };
    }
  }

  /**
   * Format token amount for display
   */
  formatTokenAmount(amount: string, decimals: number, precision: number = 4): string {
    const divisor = ethers.parseUnits("1", decimals);
    const formattedAmount = ethers.formatUnits(amount, decimals);
    const num = parseFloat(formattedAmount);
    
    if (num === 0) return "0";
    if (num < Math.pow(10, -precision)) return `<${Math.pow(10, -precision)}`;
    
    return num.toFixed(precision);
  }

  /**
   * Parse token amount from user input
   */
  parseTokenAmount(amount: string, decimals: number): string {
    try {
      return ethers.parseUnits(amount, decimals).toString();
    } catch (error) {
      throw new Error(`Invalid token amount: ${amount}`);
    }
  }

  /**
   * Validate token address
   */
  validateTokenAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * Get gas estimate for Permit2 transfer
   */
  async estimatePermit2Gas(
    token: SupportedToken,
    from: string,
    to: string,
    amount: string
  ): Promise<string> {
    const provider = this.getProvider(token.chainId);
    
    // Rough estimate for Permit2 transfers (actual implementation would simulate the transaction)
    const baseGas = 100000; // Base gas for Permit2 transfer
    const gasPrice = (await provider.getFeeData()).gasPrice || ethers.parseUnits("20", "gwei");
    
    return ethers.formatEther(gasPrice * BigInt(baseGas));
  }
}

// Export singleton instance
export const web3Service = new Web3Service();