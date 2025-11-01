


import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import NewAirdropForm from './components/NewAirdropForm';
import { Airdrop } from './types';
import { sdk } from '@farcaster/miniapp-sdk';
import Footer from './components/Footer';

// Define a type for the raw airdrop data from JSON, where createdAt is a string
type AirdropFromJSON = Omit<Airdrop, 'createdAt'> & { createdAt: string };

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'new-airdrop'>('dashboard');
  const [airdrops, setAirdrops] = useState<Airdrop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Signal to the Farcaster client that the mini app is ready to be displayed.
    sdk.actions.ready();

    // Fetch the list of airdrops from the index file
    fetch('/airdrops/index.json')
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to fetch airdrops index');
        }
        return res.json();
      })
      .then((data: AirdropFromJSON[]) => {
        // Convert createdAt string to Date object
        const formattedAirdrops = data.map(airdrop => ({
          ...airdrop,
          createdAt: new Date(airdrop.createdAt),
        }));
        setAirdrops(formattedAirdrops);
      })
      .catch(error => {
        console.error("Error loading airdrops:", error);
        // Handle error state, maybe show a message to the user
      })
      .finally(() => {
        setIsLoading(false);
      });

  }, []);

  const handleAddAirdrop = useCallback((airdrop: Omit<Airdrop, 'id' | 'createdAt' | 'recipientCount'>) => {
    // This function would now need to update a remote source or is just for local state management during a session
    // For this example, we'll just add it to the local state
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