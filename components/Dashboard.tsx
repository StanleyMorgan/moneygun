import React from 'react';
import { Airdrop, AirdropStatus } from '../types';
import AirdropCard, { getComputedStatus } from './AirdropCard';
import { PlusIcon } from './icons/PlusIcon';

interface DashboardProps {
  airdrops: Airdrop[];
  onCreateNew: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ airdrops, onCreateNew }) => {
  // Sort airdrops: 'In Progress' first, then by most recent, based on computed status
  const sortedAirdrops = [...airdrops].sort((a, b) => {
    const statusA = getComputedStatus(a);
    const statusB = getComputedStatus(b);

    if (statusA === AirdropStatus.InProgress && statusB !== AirdropStatus.InProgress) {
      return -1;
    }
    if (statusA !== AirdropStatus.InProgress && statusB === AirdropStatus.InProgress) {
      return 1;
    }
    // For items with the same status, sort by creation date (newest first)
    return b.createdAt.getTime() - a.createdAt.getTime();
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
            <AirdropCard key={airdrop.id} airdrop={airdrop} />
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