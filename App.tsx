
import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import NewAirdropForm from './components/NewAirdropForm';
import { Airdrop } from './types';
import { sdk } from '@farcaster/miniapp-sdk';
import Footer from './components/Footer';
import { getAirdrops, createAirdrop } from './lib/api';
import { useAccount } from 'wagmi';

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'new-airdrop'>('dashboard');
  const [airdrops, setAirdrops] = useState<Airdrop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { address } = useAccount();

  useEffect(() => {
    // Signal to the Farcaster client that the mini app is ready to be displayed.
    sdk.actions.ready();

    const loadAirdrops = async () => {
      try {
        const fetchedAirdrops = await getAirdrops();
        setAirdrops(fetchedAirdrops);
      } catch (error) {
        console.error("Error loading airdrops:", error);
        // Handle error state, maybe show a message to the user
      } finally {
        setIsLoading(false);
      }
    };

    loadAirdrops();

  }, []);

  const handleAddAirdrop = useCallback(async (airdropData: Omit<Airdrop, 'id' | 'createdAt' | 'recipientCount' | 'creatorAddress'>) => {
    if (!address) {
      alert("Please connect your wallet to create an airdrop.");
      return;
    }
    try {
      const airdropPayload = {
        ...airdropData,
        creatorAddress: address,
      };
      const newAirdrop = await createAirdrop(airdropPayload);
      setAirdrops(prevAirdrops => [newAirdrop, ...prevAirdrops]);
      setView('dashboard');
    } catch (error) {
      console.error("Failed to create airdrop:", error);
      // Optionally show an error message to the user
    }
  }, [address]);

  const handleCreateNew = () => setView('new-airdrop');
  const handleBackToDashboard = () => setView('dashboard');

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="text-center py-16">
          <p className="text-slate-500 animate-pulse">Loading airdrops...</p>
        </div>
      );
    }

    if (view === 'dashboard') {
      return <Dashboard airdrops={airdrops} onCreateNew={handleCreateNew} />;
    }

    if (view === 'new-airdrop') {
      return <NewAirdropForm onAddAirdrop={handleAddAirdrop} onBack={handleBackToDashboard} />;
    }

    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      <Header />
      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 w-full flex-grow">
        {renderContent()}
      </main>
      <Footer />
    </div>
  );
};

export default App;
