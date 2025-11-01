import React from 'react';
import { Airdrop, AirdropStatus, AirdropType } from '../types';

interface AirdropCardProps {
  airdrop: Airdrop;
}

export const getComputedStatus = (airdrop: Airdrop): AirdropStatus => {
  // A 'Failed' status is permanent and overrides any time-based logic.
  if (airdrop.status === AirdropStatus.Failed) {
    return AirdropStatus.Failed;
  }

  const now = Date.now();
  const startTime = airdrop.startTime?.getTime();
  const endTime = airdrop.endTime?.getTime();

  // If there's no start time, it's considered a draft.
  if (!startTime) {
    return AirdropStatus.Draft;
  }

  // Scheduled for the future.
  if (now < startTime) {
    return AirdropStatus.Draft; 
  }

  // Airdrop has ended.
  if (endTime && now > endTime) {
    return AirdropStatus.Completed;
  }
  
  // If it has started and not yet ended (or has no end date), it's in progress.
  return AirdropStatus.InProgress;
};


const statusColors: { [key in AirdropStatus]: string } = {
  [AirdropStatus.Draft]: 'bg-slate-100 text-slate-600',
  [AirdropStatus.InProgress]: 'bg-blue-100 text-blue-600',
  [AirdropStatus.Completed]: 'bg-green-100 text-green-600',
  [AirdropStatus.Failed]: 'bg-red-100 text-red-600',
};

const typeColors: { [key in AirdropType]: string } = {
  [AirdropType.Whitelist]: 'bg-purple-100 text-purple-600',
  [AirdropType.Quest]: 'bg-amber-100 text-amber-700',
};

const formatDate = (date: Date) => {
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
};

const formatAddress = (address: string) => {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const AirdropCard: React.FC<AirdropCardProps> = ({ airdrop }) => {
  const computedStatus = getComputedStatus(airdrop);
  const isClaimable = computedStatus === AirdropStatus.InProgress;

  const renderClaimButton = () => {
    const baseClasses = "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2";

    if (isClaimable) {
      return (
        <button className={`${baseClasses} text-white bg-purple-600 hover:bg-purple-700`}>
          Claim
        </button>
      );
    } else {
      return (
        <button disabled className={`${baseClasses} bg-slate-200 text-slate-500 cursor-not-allowed`}>
          Claim
        </button>
      );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-grow min-w-0">
          <h2 className="text-sm font-semibold text-slate-800 truncate" title={airdrop.name}>{airdrop.name}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {airdrop.tokenSymbol && airdrop.network ? (
              <span className="truncate">
                Up to {new Intl.NumberFormat().format(airdrop.totalAmount)}
                <span className="font-semibold text-slate-700"> ${airdrop.tokenSymbol} </span> 
                on <span className="font-medium text-slate-700">{airdrop.network}</span>
              </span>
            ) : (
              <>
                Token: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">{airdrop.tokenAddress.slice(0,10)}...</span>
              </>
            )}
          </p>
          {airdrop.creatorAddress && (
            <p className="text-xs text-slate-500 mt-1">
              From: <span className="font-mono text-slate-600" title={airdrop.creatorAddress}>
                {formatAddress(airdrop.creatorAddress)}
              </span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {renderClaimButton()}
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100">
        <div className="space-y-2 text-xs mb-4">
          {airdrop.description && (
            <div className="flex items-start">
              <span className="text-slate-400 mr-1.5 flex-shrink-0">Description:</span>
              <p className="break-words line-clamp-3 text-slate-600" title={airdrop.description}>
                {airdrop.description}
              </p>
            </div>
          )}
        
          {airdrop.startTime && airdrop.endTime && (
            <div className="flex items-start">
              <span className="text-slate-400 mr-1.5 flex-shrink-0">Time:</span>
              <p className="text-slate-600">
                {`${formatDate(airdrop.startTime)} - ${formatDate(airdrop.endTime)}`}
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[computedStatus]}`}>
                    {computedStatus}
                </div>
                <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[airdrop.type]}`}>
                    {airdrop.type}
                </div>
            </div>
            <div className="flex-shrink-0">
            {airdrop.action && (
                <a
                    href={airdrop.action.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                    {airdrop.action.text}
                </a>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default AirdropCard;