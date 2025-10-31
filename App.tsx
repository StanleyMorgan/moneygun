

import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import NewAirdropForm from './components/NewAirdropForm';
import { Airdrop, AirdropStatus } from './types';
import { sdk } from '@farcaster/miniapp-sdk';

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'new-airdrop'>('dashboard');
  const [airdrops, setAirdrops] = useState<Airdrop[]>([
    {
      id: '1',
      name: 'Initial $DEGEN Drop',
      tokenAddress: '0x4ed4E862860beD51a957029679E281e3E1deE594',
      totalAmount: 1000000,
      status: AirdropStatus.Completed,
      eligibility: { type: 'followers', value: 'dwr.eth' },
      recipientCount: 1250,
      createdAt: new Date('2024-07-15T10:00:00Z'),
    },
    {
      id: '2',
      name: 'Early Casters Reward',
      tokenAddress: '0x5471ea8f73142279182911d837ca7c852a4a2b85',
      totalAmount: 500000,
      status: AirdropStatus.InProgress,
      eligibility: { type: 'cast_likers', value: 'https://warpcast.com/dwr/0x1a2b3c' },
      recipientCount: 480,
      createdAt: new Date('2024-07-28T14:30:00Z'),
    },
    {
      id: '3',
      name: 'Next Meme Token',
      tokenAddress: 'TBD',
      totalAmount: 10000000,
      status: AirdropStatus.Draft,
      eligibility: { type: 'custom_list', value: '12 addresses' },
      recipientCount: 12,
      createdAt: new Date(),
    },
  ]);

  useEffect(() => {
    // Signal to the Farcaster client that the mini app is ready to be displayed.
    sdk.actions.ready();
  }, []);

  const handleAddAirdrop = useCallback((airdrop: Omit<Airdrop, 'id' | 'createdAt' | 'recipientCount'>) => {
    setAirdrops(prevAirdrops => [
      {
        ...airdrop,
        id: (prevAirdrops.length + 1).toString(),
        createdAt: new Date(),
        recipientCount: Math.floor(Math.random() * 1000) + 10 // Mock recipient count
      },
      ...prevAirdrops
    ]);
    setView('dashboard');
  }, []);

  const handleCreateNew = () => setView('new-airdrop');
  const handleBackToDashboard = () => setView('dashboard');

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      <Header />
      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 w-full flex-grow">
        {view === 'dashboard' && <Dashboard airdrops={airdrops} onCreateNew={handleCreateNew} />}
        {view === 'new-airdrop' && <NewAirdropForm onAddAirdrop={handleAddAirdrop} onBack={handleBackToDashboard} />}
      </main>
    </div>
  );
};

export default App;