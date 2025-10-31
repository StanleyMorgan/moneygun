

import React, { useState, useEffect } from 'react';
import { Airdrop, AirdropStatus, AirdropConfig } from '../types';

interface AirdropCardProps {
  airdrop: Airdrop;
}

const statusColors: { [key in AirdropStatus]: string } = {
  [AirdropStatus.Draft]: 'bg-slate-100 text-slate-600',
  [AirdropStatus.InProgress]: 'bg-blue-100 text-blue-600',
  [AirdropStatus.Completed]: 'bg-green-100 text-green-600',
  [AirdropStatus.Failed]: 'bg-red-100 text-red-600',
};

const getEligibilityText = (eligibility: Airdrop['eligibility']) => {
    switch (eligibility.type) {
        case 'followers': return `Followers of ${eligibility.value}`;
        case 'cast_likers': return `Likers of cast...${eligibility.value.slice(-6)}`;
        case 'channel_casters': return `Casters in /${eligibility.value}`;
        case 'nft_holders': return `Holders of ${eligibility.value.slice(0, 6)}...`;
        case 'custom_list': return `Custom list (${eligibility.value})`;
    }
}

const AirdropCard: React.FC<AirdropCardProps> = ({ airdrop }) => {
  const [config, setConfig] = useState<AirdropConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (airdrop.configUrl) {
      setIsLoading(true);
      fetch(airdrop.configUrl)
        .then((res) => {
          if (!res.ok) {
            throw new Error('Network response was not ok');
          }
          return res.json();
        })
        .then((data: AirdropConfig) => {
          setConfig(data);
        })
        .catch((error) => {
          console.error(`Failed to fetch config for ${airdrop.name}:`, error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [airdrop.configUrl, airdrop.name]);


  const renderClaimButton = () => {
    const baseClasses = "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2";
    
    switch (airdrop.status) {
      case AirdropStatus.InProgress:
        return (
          <button
            className={`${baseClasses} text-white bg-purple-600 hover:bg-purple-700`}
          >
            Claim
          </button>
        );
      case AirdropStatus.Completed:
        return (
          <button
            disabled
            className={`${baseClasses} bg-slate-200 text-slate-500 cursor-not-allowed`}
          >
            Ended
          </button>
        );
      case AirdropStatus.Failed:
        return (
          <button
            disabled
            className={`${baseClasses} bg-slate-200 text-slate-500 cursor-not-allowed`}
          >
            Failed
          </button>
        );
      case AirdropStatus.Draft:
        return (
          <button
            disabled
            className={`${baseClasses} bg-slate-200 text-slate-500 cursor-not-allowed`}
          >
            Not Started
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-grow min-w-0">
          <h2 className="text-sm font-semibold text-slate-800 truncate" title={airdrop.name}>{airdrop.name}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Token: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">{airdrop.tokenAddress.slice(0,10)}...</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {renderClaimButton()}
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-end gap-4">
        <div className="space-y-2 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className={`px-2 py-0.5 rounded-full font-medium ${statusColors[airdrop.status]}`}>
              {airdrop.status}
            </div>
            <div>
              <span className="text-slate-400">Amount: </span> 
              {new Intl.NumberFormat().format(airdrop.totalAmount)}
            </div>
            <div>
              <span className="text-slate-400">Recipients: </span> 
              {airdrop.recipientCount}
            </div>
            <div className="text-slate-400">
              {airdrop.createdAt.toLocaleDateString()}
            </div>
          </div>
          <div>
            <span className="text-slate-400">Description: </span> 
            {isLoading ? (
              <span className="animate-pulse bg-slate-200 rounded w-48 h-3.5 inline-block align-middle"></span>
            ) : config?.description ? (
              config.description
            ) : (
              getEligibilityText(airdrop.eligibility)
            )}
          </div>
        </div>
        <div className="flex-shrink-0">
          {config?.action && (
              <a
                href={config.action.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              >
                {config.action.text}
              </a>
            )}
        </div>
      </div>
    </div>
  );
};

export default AirdropCard;
