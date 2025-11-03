import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { Airdrop, AirdropStatus } from '../types';
import AirdropCard, { getComputedStatus } from './AirdropCard';
import { PlusIcon } from './icons/PlusIcon';
import { getAddress } from 'viem';

interface DashboardProps {
  airdrops: Airdrop[];
  onCreateNew: () => void;
  onAirdropUpdate: (airdropId: number, updatedFields: Partial<Airdrop>) => void;
}

const statusOrder: Record<AirdropStatus, number> = {
  [AirdropStatus.InProgress]: 1,
  [AirdropStatus.Planned]: 2,
  [AirdropStatus.Draft]: 3,
  [AirdropStatus.Ended]: 4,
  [AirdropStatus.Failed]: 5,
  [AirdropStatus.Active]: 6, // Fallback
};

const sortAirdrops = (airdrops: Airdrop[]) => {
  return [...airdrops].sort((a, b) => {
    const statusA = getComputedStatus(a);
    const statusB = getComputedStatus(b);

    const orderA = statusOrder[statusA] ?? 99;
    const orderB = statusOrder[statusB] ?? 99;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
};


const Dashboard: React.FC<DashboardProps> = ({ airdrops, onCreateNew, onAirdropUpdate }) => {
  const [activeTab, setActiveTab] = useState<'earn' | 'manage'>('earn');
  const { address, isConnected } = useAccount();

  const earnAirdrops = sortAirdrops(airdrops.filter(ad => ad.status !== AirdropStatus.Draft));
  const manageAirdrops = sortAirdrops(
    isConnected && address
      ? airdrops.filter(ad => ad.creatorAddress && getAddress(ad.creatorAddress) === getAddress(address))
      : []
  );
  
  const airdropsToDisplay = activeTab === 'earn' ? earnAirdrops : manageAirdrops;
  const showCreateButton = activeTab === 'manage' && isConnected;


  const TabButton: React.FC<{ tab: 'earn' | 'manage', label: string }> = ({ tab, label }) => (
      <button
        onClick={() => setActiveTab(tab)}
        className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
          activeTab === tab 
            ? 'bg-purple-600 text-white' 
            : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        {label}
      </button>
  );
  
  const EmptyState: React.FC = () => {
    if (activeTab === 'earn') {
      return (
         <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-lg">
          <h3 className="text-sm font-medium text-slate-800">No active airdrops right now</h3>
          <p className="mt-1 text-xs text-slate-500">Check back later for new opportunities to earn.</p>
        </div>
      );
    }
    
    if (activeTab === 'manage') {
       if (!isConnected) {
        return (
          <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-lg">
            <h3 className="text-sm font-medium text-slate-800">Connect your wallet</h3>
            <p className="mt-1 text-xs text-slate-500">Connect your wallet to manage your airdrops.</p>
          </div>
        )
       }
       return (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-lg">
          <h3 className="text-sm font-medium text-slate-800">You haven't created any airdrops yet</h3>
          <p className="mt-1 text-xs text-slate-500">Get started by creating a new airdrop.</p>
          <button 
            onClick={onCreateNew}
            className="mt-4 flex items-center mx-auto justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            <PlusIcon className="w-4 h-4" />
            Create First Airdrop
          </button>
        </div>
       )
    }

    return null;
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="bg-slate-200 p-1 rounded-lg flex items-center space-x-1">
            <TabButton tab="earn" label="Earn" />
            <TabButton tab="manage" label="Manage" />
        </div>
        {showCreateButton && (
          <button 
            onClick={onCreateNew}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            <PlusIcon className="w-4 h-4" />
            New Airdrop
          </button>
        )}
      </div>

      <div className="space-y-3">
          <h1 className="text-xl font-semibold text-slate-800">
            {activeTab === 'earn' ? 'Discover Airdrops' : 'My Airdrops'}
          </h1>
          {airdropsToDisplay.length > 0 ? (
              airdropsToDisplay.map(airdrop => (
                <AirdropCard key={airdrop.id} airdrop={airdrop} onAirdropUpdate={onAirdropUpdate} viewAsOwner={activeTab === 'manage'} />
              ))
          ) : (
            <EmptyState />
          )}
      </div>

    </div>
  );
};

export default Dashboard;