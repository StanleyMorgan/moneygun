import React from 'react';
import { createAppKit } from '@reown/appkit';
import { WagmiProvider } from 'wagmi';
// Fix: Import `base` and `celo` from `viem/chains` as they are not exported from `wagmi/chains` in recent versions.
import { base, celo } from 'viem/chains';
// Fix: Import `QueryClient` from `@tanstack/query-core` as it may not be exported from `@tanstack/react-query` in this environment.
import { QueryClientProvider } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/query-core';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';

// 0. Setup queryClient
const queryClient = new QueryClient();

// 1. Get projectId from Vercel env variable via Vite's define
const projectId = process.env.REOWN_PROJECT_ID;

// 2. Create a metadata object - optional
const metadata = {
  name: 'Moneygun',
  description: 'Moneygun for Farcaster',
  url: 'https://moneygun-mini.vercel.app/', // origin must match your domain & subdomain
  icons: ['https://avatars.githubusercontent.com/u/37784886']
};

// 3. Set the networks
// The imported network configurations are readonly. Create a deep mutable copy to satisfy wagmi and appkit types.
const networks = JSON.parse(JSON.stringify([base, celo]));

let wagmiAdapter: WagmiAdapter | null = null;

// Initialize AppKit only if projectId is available. This prevents build errors
// when the environment variable is missing, while allowing the component to
// render a helpful error message.
if (projectId) {
  wagmiAdapter = new WagmiAdapter({
    networks,
    projectId,
    ssr: true
  });

  createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId,
    metadata,
    // Set theme programmatically as per Reown documentation
    themeMode: 'light',
    themeVariables: {
      // FIX: There appears to be a mismatch between the library's TypeScript
      // types and its documentation. Using `as any` to bypass the incorrect
      // type checking and apply theme variables as specified in the docs.
      '--apkt-accent': '#9333ea',
      '--apkt-font-family': 'Inter, sans-serif',
      '--apkt-border-radius-master': '0.5rem'
    } as any,
    features: {
      analytics: true
    }
  });
}


interface AppKitProviderProps {
  children: React.ReactNode;
}

export function AppKitProvider({ children }: AppKitProviderProps) {
  // The runtime check for projectId and the initialized adapter remains.
  // If they are missing, an error message is displayed to the user.
  if (!projectId || !wagmiAdapter) {
    return (
      <div style={{ padding: '20px', margin: '20px', textAlign: 'center', backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba', borderRadius: '8px', fontFamily: 'sans-serif' }}>
        <h2 style={{margin: 0, marginBottom: '10px'}}>Configuration Error</h2>
        <p style={{margin: 0, marginBottom: '5px'}}><code>REOWN_PROJECT_ID</code> is not set.</p>
        <p style={{margin: 0, marginBottom: '15px'}}>Please set this environment variable in your Vercel project settings.</p>
        <code style={{padding: '5px 10px', backgroundColor: '#e9ecef', borderRadius: '4px'}}>REOWN_PROJECT_ID=your_project_id_here</code>
      </div>
    );
  }

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}