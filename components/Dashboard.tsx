import React from 'react';
import { Airdrop, AirdropStatus } from '../types';
import AirdropCard, { getComputedStatus } from './AirdropCard';
import { PlusIcon } from './icons/PlusIcon';

interface DashboardProps {
  airdrops: Airdrop[];
  onCreateNew: () => void;
  onAirdropUpdate: (airdropId: number, updatedFields: Partial<Airdrop>) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ airdrops, onCreateNew, onAirdropUpdate }) => {
  const statusOrder: Record<AirdropStatus, number> = {
    [AirdropStatus.InProgress]: 1,
    [AirdropStatus.Planned]: 2,
    [AirdropStatus.Draft]: 3,
    [AirdropStatus.Ended]: 4,
    [AirdropStatus.Failed]: 5,
    [AirdropStatus.Active]: 6, // Fallback
  };

  const sortedAirdrops = [...airdrops].sort((a, b) => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Airdrops</h1>
        <button 
          onClick={onCreateNew}
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
        >
          <PlusIcon className="w-4 h-4" />
          New Airdrop
        </button>
      </div>
      {sortedAirdrops.length > 0 ? (
        <div className="space-y-3">
          {sortedAirdrops.map(airdrop => (
            <AirdropCard key={airdrop.id} airdrop={airdrop} onAirdropUpdate={onAirdropUpdate} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-lg">
          <h3 className="text-sm font-medium text-slate-800">No airdrops yet</h3>
          <p className="mt-1 text-xs text-slate-500">Get started by creating a new airdrop.</p>
          <button 
            onClick={onCreateNew}
            className="mt-4 flex items-center mx-auto justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            <PlusIcon className="w-4 h-4" />
            Create First Airdrop
          </button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;