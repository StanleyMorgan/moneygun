import React from 'react';
import { createAppKit } from '@reown/appkit';
import { WagmiProvider } from 'wagmi';
import { arbitrum, mainnet } from '@reown/appkit/networks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';

// 0. Setup queryClient
const queryClient = new QueryClient();

// 1. Get projectId from Vite env
const projectId = import.meta.env.VITE_REOWN_PROJECT_ID;

// 2. Create a metadata object - optional
const metadata = {
  name: 'Moneygun',
  description: 'Moneygun for Farcaster',
  url: 'https://web3modal.com', // origin must match your domain & subdomain
  icons: ['https://avatars.githubusercontent.com/u/37784886']
};

// 3. Set the networks
// Fix: Use 'as const' to satisfy the non-empty array type requirement for networks.
const networks = [mainnet, arbitrum] as const;

// 4. Create Wagmi Adapter
const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: true
});

// 5. Create modal
createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: true
  }
});

interface AppKitProviderProps {
  children: React.ReactNode;
}

export function AppKitProvider({ children }: AppKitProviderProps) {
  if (!projectId) {
    return (
      <div style={{ padding: '20px', margin: '20px', textAlign: 'center', backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #ffeeba', borderRadius: '8px', fontFamily: 'sans-serif' }}>
        <h2 style={{margin: 0, marginBottom: '10px'}}>Configuration Error</h2>
        <p style={{margin: 0, marginBottom: '5px'}}><code>VITE_REOWN_PROJECT_ID</code> is not set.</p>
        <p style={{margin: 0, marginBottom: '15px'}}>Please create a <code>.env</code> file in the root of your project and add your project ID.</p>
        <code style={{padding: '5px 10px', backgroundColor: '#e9ecef', borderRadius: '4px'}}>VITE_REOWN_PROJECT_ID=your_project_id_here</code>
      </div>
    );
  }

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
