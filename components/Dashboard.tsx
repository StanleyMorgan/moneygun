import React from 'react';
import { useAccount } from 'wagmi';
import { Airdrop, AirdropStatus, Network } from '../types';
import AirdropCard from './AirdropCard';
import { getComputedStatus } from '../hooks/useAirdropCard';
import { getAddress } from 'viem';

interface DashboardProps {
  airdrops: Airdrop[];
  onAirdropUpdate: (airdropId: number, updatedFields: Partial<Airdrop>) => void;
  onAirdropDelete: (airdropId: number) => void;
  activeNetworks: Network[];
  activeTab: 'earn' | 'manage';
}

const statusOrder: Record<AirdropStatus, number> = {
  [AirdropStatus.InProgress]: 1,
  [AirdropStatus.Planned]: 2,
  [AirdropStatus.Draft]: 3,
  [AirdropStatus.Failed]: 4,
  [AirdropStatus.Ended]: 5,
  [AirdropStatus.Active]: 6, // Fallback
};

const sortAirdrops = (airdrops: Airdrop[]) => {
  return [...airdrops].sort((a, b) => {
    const statusA = getComputedStatus(a, a.claimedCount, a.recipientCount);
    const statusB = getComputedStatus(b, b.claimedCount, b.recipientCount);

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


const Dashboard: React.FC<DashboardProps> = ({ airdrops, onAirdropUpdate, onAirdropDelete, activeNetworks, activeTab }) => {
  const { address, isConnected } = useAccount();

  const activeNetworkKeys = new Set(activeNetworks.map(n => n.networkKey));

  const earnAirdrops = sortAirdrops(
    airdrops.filter(ad => 
      ad.status !== AirdropStatus.Draft &&
      ad.network &&
      activeNetworkKeys.has(ad.network)
    )
  );

  const manageAirdrops = sortAirdrops(
    isConnected && address
      ? airdrops.filter(ad => ad.creatorAddress && getAddress(ad.creatorAddress) === getAddress(address))
      : []
  );
  
  const airdropsToDisplay = activeTab === 'earn' ? earnAirdrops : manageAirdrops;
  
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
          <p className="mt-1 text-xs text-slate-500">Get started by using the 'Create' button above.</p>
        </div>
       )
    }

    return null;
  }


  return (
    <div className="space-y-3">
        {airdropsToDisplay.length > 0 ? (
            airdropsToDisplay.map(airdrop => (
              <AirdropCard key={airdrop.id} airdrop={airdrop} onAirdropUpdate={onAirdropUpdate} viewAsOwner={activeTab === 'manage'} onAirdropDelete={onAirdropDelete} />
            ))
        ) : (
          <EmptyState />
        )}
    </div>
  );
};

export default Dashboard;
