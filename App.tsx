
import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import NewAirdropForm from './components/NewAirdropForm';
import { Airdrop, WhitelistEntry, Network } from './types';
import { sdk } from '@farcaster/miniapp-sdk';
import Footer from './components/Footer';
import { getAirdrops, createAirdrop, getNetworks, getCreatorStatus } from './lib/api';
import { useAccount } from 'wagmi';

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'new-airdrop'>('dashboard');
  const [dashboardTab, setDashboardTab] = useState<'earn' | 'manage'>('earn');
  const [airdrops, setAirdrops] = useState<Airdrop[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // State for creator permissions
  const [creatorStatus, setCreatorStatus] = useState<{ allowed: boolean; limit: number; count: number }>({ allowed: false, limit: 0, count: 0 });
  
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
  
  // Fetch creator status when address changes
  useEffect(() => {
      const fetchStatus = async () => {
          if (isConnected && address) {
              try {
                  const status = await getCreatorStatus(address);
                  setCreatorStatus(status);
              } catch (error) {
                  console.error("Failed to fetch creator status:", error);
                  setCreatorStatus({ allowed: false, limit: 0, count: 0 });
              }
          } else {
              setCreatorStatus({ allowed: false, limit: 0, count: 0 });
          }
      };
      fetchStatus();
  }, [address, isConnected]);

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
      // Update local creator count immediately to reflect the new creation in UI state
      setCreatorStatus(prev => ({ ...prev, count: prev.count + 1 }));
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
    // Decrease local count if deleted (optional, strict consistency might require refetch)
    setCreatorStatus(prev => ({ ...prev, count: Math.max(0, prev.count - 1) }));
  }, []);

  const canCreate = isConnected && creatorStatus.allowed && (creatorStatus.count < creatorStatus.limit);
  const canManage = isConnected && creatorStatus.allowed;

  const handleCreateNew = () => {
    if (canCreate) {
      setView('new-airdrop');
    } else if (!creatorStatus.allowed) {
        alert("You are not whitelisted to create airdrops.");
    } else {
        alert(`You reached your creation limit of ${creatorStatus.limit}.`);
    }
  };

  const handleEarnClick = () => {
    setView('dashboard');
    setDashboardTab('earn');
  };
  const handleManageClick = () => {
    if (canManage) {
        setView('dashboard');
        setDashboardTab('manage');
    }
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
          disabled={!canManage}
          title={!canManage ? "Only whitelisted creators can manage airdrops" : ""}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
            view === 'dashboard' && dashboardTab === 'manage'
              ? 'bg-purple-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          } ${!canManage ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Manage
        </button>
        {isConnected && (
          <button
            onClick={handleCreateNew}
            disabled={!canCreate}
            title={!creatorStatus.allowed ? "Not whitelisted" : (creatorStatus.count >= creatorStatus.limit ? "Limit reached" : "Create a new airdrop")}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
              view === 'new-airdrop'
                ? 'bg-purple-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            } ${!canCreate ? 'opacity-50 cursor-not-allowed' : ''}`}
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
