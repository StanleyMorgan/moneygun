

import React, { useState, useEffect } from 'react';
import { Airdrop, AirdropStatus, AirdropConfig, AirdropType } from '../types';

interface AirdropCardProps {
  airdrop: Airdrop;
}

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

const getEligibilityText = (eligibility: Airdrop['eligibility']) => {
    switch (eligibility.type) {
        case 'followers': return `Followers of ${eligibility.value}`;
        case 'cast_likers': return `Likers of cast...${eligibility.value.slice(-6)}`;
        case 'channel_casters': return `Casters in /${eligibility.value}`;
        case 'nft_holders': return `Holders of ${eligibility.value.slice(0, 6)}...`;
        case 'custom_list': return `Custom list (${eligibility.value})`;
    }
}

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return dateString;
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
};

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

    // These statuses are final and override any time-based logic.
    if (airdrop.status === AirdropStatus.Failed) {
      return (
        <button disabled className={`${baseClasses} bg-slate-200 text-slate-500 cursor-not-allowed`}>
          Failed
        </button>
      );
    }

    if (airdrop.status === AirdropStatus.Draft) {
      return (
        <button disabled className={`${baseClasses} bg-slate-200 text-slate-500 cursor-not-allowed`}>
          Not Started
        </button>
      );
    }
    
    // If we have a config with schedule, it's the source of truth for time.
    if (config?.schedule?.startTime && config.schedule.endTime) {
      const now = Date.now();
      const startTime = Date.parse(config.schedule.startTime);
      const endTime = Date.parse(config.schedule.endTime);

      if (now < startTime) {
        return (
          <button disabled className={`${baseClasses} bg-slate-200 text-slate-500 cursor-not-allowed`}>
            Not Started
          </button>
        );
      }
      
      if (now > endTime) {
        return (
          <button disabled className={`${baseClasses} bg-slate-200 text-slate-500 cursor-not-allowed`}>
            Ended
          </button>
        );
      }

      // If we are within the time range, the drop is active.
      return (
        <button className={`${baseClasses} text-white bg-purple-600 hover:bg-purple-700`}>
          {airdrop.type === AirdropType.Quest ? 'Start Quest' : 'Claim'}
        </button>
      );
    }

    // Fallback logic for when config is loading, or failed to load, or has no schedule.
    // We can use the status from the main airdrop object as a best-effort display.
    if (isLoading) {
       return (
          <button disabled className={`${baseClasses} bg-slate-200 text-slate-500 cursor-not-allowed`}>
            ...
          </button>
        );
    }

    // Fallback to status if config is not available after loading.
    switch (airdrop.status) {
      case AirdropStatus.InProgress:
        return (
          <button className={`${baseClasses} text-white bg-purple-600 hover:bg-purple-700`}>
            {airdrop.type === AirdropType.Quest ? 'Start Quest' : 'Claim'}
          </button>
        );
      case AirdropStatus.Completed:
        return (
          <button disabled className={`${baseClasses} bg-slate-200 text-slate-500 cursor-not-allowed`}>
            Ended
          </button>
        );
      default:
        // Covers cases where config failed to load for an unknown status
        return null;
    }
  };

  const descriptionText = airdrop.description || config?.description;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-grow min-w-0">
          <h2 className="text-sm font-semibold text-slate-800 truncate" title={airdrop.name}>{airdrop.name}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isLoading && !config ? (
              <span className="animate-pulse bg-slate-200 rounded w-40 h-4 inline-block" />
            ) : config ? (
              <span className="truncate">
                Up to {new Intl.NumberFormat().format(airdrop.totalAmount)}
                <span className="font-semibold text-slate-700"> ${config.token.symbol} </span> 
                on <span className="font-medium text-slate-700">{config.network}</span>
              </span>
            ) : (
              <>
                Token: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">{airdrop.tokenAddress.slice(0,10)}...</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {renderClaimButton()}
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-100">
        <div className="space-y-2 text-xs text-slate-600 mb-4">
          <div>
            <span className="text-slate-400">Description: </span> 
            {isLoading && !descriptionText ? (
              <span className="animate-pulse bg-slate-200 rounded w-48 h-3.5 inline-block align-middle"></span>
            ) : descriptionText ? (
              descriptionText
            ) : (
              getEligibilityText(airdrop.eligibility)
            )}
          </div>
        
          {/* Time: loading state */}
          {isLoading && !config &&(
            <div>
              <span className="text-slate-400">Time: </span>
              <span className="animate-pulse bg-slate-200 rounded w-48 h-3.5 inline-block align-middle"></span>
            </div>
          )}
          {/* Time: loaded state */}
          {!isLoading && config?.schedule?.startTime && config.schedule.endTime && (
            <div>
              <span className="text-slate-400">Time: </span>
              {`${formatDate(config.schedule.startTime)} - ${formatDate(config.schedule.endTime)}`}
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[airdrop.status]}`}>
                    {airdrop.status}
                </div>
                <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[airdrop.type]}`}>
                    {airdrop.type}
                </div>
            </div>
            <div className="flex-shrink-0">
            {(airdrop.action || config?.action) && (
                <a
                    href={airdrop.action?.url || config?.action?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                    {airdrop.action?.text || config?.action?.text}
                </a>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default AirdropCard;
