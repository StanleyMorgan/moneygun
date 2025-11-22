
import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import NewAirdropForm from './components/NewAirdropForm';
import { Airdrop, WhitelistEntry, Network } from './types';
import { sdk } from '@farcaster/miniapp-sdk';
import Footer from './components/Footer';
import { getAirdrops, createAirdrop, getNetworks } from './lib/api';
import { useAccount } from 'wagmi';
import { getAddress } from 'viem';

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'new-airdrop'>('dashboard');
  const [dashboardTab, setDashboardTab] = useState<'earn' | 'manage'>('earn');
  const [airdrops, setAirdrops] = useState<Airdrop[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { address, isConnected } = useAccount();

  useEffect(() => {
    // Signal to the Farcaster client that the mini app is ready to be displayed.
    sdk.actions.ready();

    // Smart prompt to add the app to favorites.
    // FOR TESTING: We bypass the localStorage check to prompt every time.
    const addedToFavoritesKey = 'moneygun_hasAddedToFavorites';
    
    const promptToAdd = async () => {
      try {
        await sdk.actions.addMiniApp();
        // Only mark as added if the user accepts (promise resolves)
        localStorage.setItem(addedToFavoritesKey, 'true');
      } catch (error) {
        // If the user rejects or an error occurs, we do NOT set the flag.
        console.warn("User declined to add Mini App or error occurred:", error);
      }
    };
    
    // Give the app a moment to render before showing a system prompt for better UX.
    setTimeout(promptToAdd, 1500); 

    const loadData = async () => {
      try {
        const [fetchedAirdrops, fetchedNetworks] = await Promise.all([
          getAirdrops(),
          getNetworks()
        ]);
        setAirdrops(fetchedAirdrops);
        setNetworks(fetchedNetworks);
      } catch (error) {
        console.error("Error loading data:", error);
        // Handle error state, maybe show a message to the user
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

  }, []);
  
  const userAirdropsCount = isConnected && address
    ? airdrops.filter(ad => ad.creatorAddress && getAddress(ad.creatorAddress) === getAddress(address)).length
    : 0;
  // FIX: Temporarily disabled creation by setting limit to 0 (was 3).
  const canCreateAirdrop = userAirdropsCount < 0;


  const handleAddAirdrop = useCallback(async (airdropData: Omit<Airdrop, 'id' | 'createdAt' | 'creatorAddress'> & { whitelist?: WhitelistEntry[] }) => {
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
      setDashboardTab('manage');
    } catch (error) {
      console.error("Failed to create airdrop:", error);
      alert(`Failed to create airdrop: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [address]);
  
  const handleAirdropUpdate = useCallback((airdropId: number, updatedFields: Partial<Airdrop>) => {
    setAirdrops(prevAirdrops =>
      prevAirdrops.map(ad =>
        ad.id === airdropId ? { ...ad, ...updatedFields } : ad
      )
    );
  }, []);

  const handleDeleteAirdrop = useCallback((airdropId: number) => {
    setAirdrops(prevAirdrops => prevAirdrops.filter(ad => ad.id !== airdropId));
  }, []);

  const handleCreateNew = () => {
    if (canCreateAirdrop) {
      setView('new-airdrop');
    } else {
      alert("You’ve reached the maximum limit of 3 airdrops.");
    }
  };

  const handleEarnClick = () => {
    setView('dashboard');
    setDashboardTab('earn');
  };
  const handleManageClick = () => {
    setView('dashboard');
    setDashboardTab('manage');
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="text-center py-16">
          <p className="text-slate-500 animate-pulse">Loading airdrops...</p>
        </div>
      );
    }

    if (view === 'dashboard') {
      return <Dashboard airdrops={airdrops} onAirdropUpdate={handleAirdropUpdate} onAirdropDelete={handleDeleteAirdrop} activeNetworks={networks} activeTab={dashboardTab} />;
    }

    if (view === 'new-airdrop') {
      return <NewAirdropForm onAddAirdrop={handleAddAirdrop} />;
    }

    return null;
  }

  const TabSwitcher = () => (
    <div className="flex items-center justify-center mb-6">
      <div className="bg-slate-200 p-1 rounded-lg flex items-center space-x-1">
        <button
          onClick={handleEarnClick}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
            view === 'dashboard' && dashboardTab === 'earn'
              ? 'bg-purple-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Earn
        </button>
        <button
          onClick={handleManageClick}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
            view === 'dashboard' && dashboardTab === 'manage'
              ? 'bg-purple-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Manage
        </button>
        {isConnected && (
          <button
            onClick={handleCreateNew}
            disabled={!canCreateAirdrop}
            title={!canCreateAirdrop ? "You’ve reached the maximum limit of 3 airdrops." : "Create a new airdrop"}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
              view === 'new-airdrop'
                ? 'bg-purple-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            } ${!canCreateAirdrop ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Create
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      <Header />
      <main className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 w-full flex-grow">
        <TabSwitcher />
        {renderContent()}
      </main>
      <Footer />
    </div>
  );
};

export default App;
