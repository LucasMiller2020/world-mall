import { MiniKit } from "@worldcoin/minikit-js";

// Initialize MiniKit with environment configuration
const miniKitConfig = {
  appId: import.meta.env.VITE_MINIKIT_APP_ID || "app_staging_12345",
  defaultStage: "staging" as const,
};

// Check if we're running in World App
export const isWorldApp = () => {
  return MiniKit.isInstalled();
};

// Get app configuration for deep links and sharing
export const getAppConfig = () => {
  const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  
  return {
    baseUrl,
    deepLinkUrl: `worldapp://mini-app?app-id=${miniKitConfig.appId}`,
    shareUrl: `${baseUrl}/?ref=share`,
  };
};

// Helper to generate World App install instructions
export const getWorldAppInstructions = () => {
  return {
    title: "Open in World App",
    description: "This app requires World App for human verification. Download World App and open this link there.",
    downloadUrl: "https://worldcoin.org/download-app",
    steps: [
      "Download World App from the app store",
      "Complete your World ID verification", 
      "Open this link in World App to access all features"
    ]
  };
};

// Error handling for MiniKit operations
export class MiniKitError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'MiniKitError';
  }
}

// Retry mechanism for MiniKit operations
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw new MiniKitError(
          `Operation failed after ${maxRetries} attempts: ${lastError.message}`,
          'MAX_RETRIES_EXCEEDED',
          lastError
        );
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError!;
};

export default MiniKit;
