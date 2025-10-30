import React from 'react';
import { createAppKit } from '@reown/appkit/react';
import { WagmiProvider } from 'wagmi';
// Fix: Import chains from 'wagmi/chains' as they are not available in '@reown/appkit/networks'.
import { arbitrum, mainnet } from 'wagmi/chains';
// Fix: Import QueryClient from '@tanstack/query-core' to resolve module export issue.
import { QueryClient } from '@tanstack/query-core';
import { QueryClientProvider } from '@tanstack/react-query';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';

// 1. Get projectId from Vercel environment variables
const projectId = process.env.REOWN_PROJECT_ID;

// 0. Setup queryClient - this is needed regardless of AppKit initialization
const queryClient = new QueryClient();

let wagmiAdapterInstance: WagmiAdapter | null = null;

if (projectId) {
  // 2. Create a metadata object
  const metadata = {
    name: 'Moneygun',
    description: 'A mini-app for Farcaster to create and manage token airdrops.',
    url: window.location.origin, // origin must match your domain & subdomain
    icons: ['https://i.imgur.com/7d5h2ko.png']
  };

  // 3. Set the networks
  const networks = [mainnet, arbitrum];

  // 4. Create Wagmi Adapter
  wagmiAdapterInstance = new WagmiAdapter({
    networks,
    projectId,
    ssr: true
  });

  // 5. Create modal
  createAppKit({
    adapters: [wagmiAdapterInstance],
    networks,
    projectId,
    metadata,
    features: {
      analytics: true // Optional - defaults to your Cloud configuration
    }
  });
}

export function AppKitProvider({ children }: { children: React.ReactNode }) {
  if (!wagmiAdapterInstance) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="max-w-md p-6 text-center bg-white border rounded-lg shadow-md border-red-200">
          <h2 className="text-lg font-semibold text-red-800">Configuration Error</h2>
          <p className="mt-2 text-sm text-red-700">
            Reown Project ID is missing. Please set the <code>REOWN_PROJECT_ID</code> environment variable in your Vercel project settings. The application cannot start without it.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <WagmiProvider config={wagmiAdapterInstance.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
