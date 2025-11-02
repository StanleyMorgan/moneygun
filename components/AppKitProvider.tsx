// Fix: The provider has been completely rewritten to follow the official @reown/appkit documentation.
// This resolves critical issues with wallet state synchronization and contract calls.
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import type { Chain } from 'viem';

// 1. Define Project ID and Networks
const projectId = process.env.REOWN_PROJECT_ID || 'd3141a65525d9b62939886a110b64d30';
if (!projectId) {
  throw new Error('REOWN_PROJECT_ID is not defined. Please set it in your environment.');
}
const networks: [Chain, ...Chain[]] = [base, baseSepolia];

// 2. Create the Wagmi Adapter, which will generate the wagmiConfig
// Fix: The adapter is created first, and it generates the config, not the other way around.
const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  ssr: false, // This is a client-side app, so SSR is disabled.
});

// 3. Define App Metadata
const metadata = {
  name: 'Moneygun',
  description: 'A mini-app for Farcaster to create and manage token airdrops.',
  url: 'https://moneygun-mini.vercel.app/',
  icons: ['https://moneygun-mini.vercel.app/logo128.png'],
};

// 4. Initialize AppKit
// Fix: This crucial step was missing. It registers web components and sets up the kit.
createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  defaultNetwork: base,
  metadata,
});

// 5. Create a QueryClient instance
const queryClient = new QueryClient();

// 6. Export the provider component
export const AppKitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log('[AppKitProvider] Initialized with new configuration.');
  
  // Fix: The application must be wrapped in both WagmiProvider and QueryClientProvider.
  // The wagmiConfig is retrieved from the adapter instance.
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
};
