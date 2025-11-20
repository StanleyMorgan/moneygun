
import React from 'react';
import { Airdrop, AirdropStatus, AirdropType } from '../types';
import { formatUnits } from 'viem';
import { useAirdropCard, formatDateTime, formatNetworkName } from '../hooks/useAirdropCard';
import { TrashIcon } from './icons/TrashIcon';
import { ArrowUpRightIcon } from './icons/ArrowUpRightIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';

const StatusBadge: React.FC<{ status: AirdropStatus }> = ({ status }) => {
  const statusClasses: Record<AirdropStatus, string> = {
    [AirdropStatus.Draft]: 'bg-slate-100 text-slate-600',
    [AirdropStatus.Planned]: 'bg-yellow-100 text-yellow-600',
    [AirdropStatus.InProgress]: 'bg-green-100 text-green-600 animate-pulse',
    [AirdropStatus.Ended]: 'bg-red-100 text-red-600',
    [AirdropStatus.Failed]: 'bg-red-100 text-red-600',
    [AirdropStatus.Active]: 'bg-purple-100 text-purple-600', // Fallback
  };
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusClasses[status]}`}>
      {status}
    </span>
  );
};

const TypeBadge: React.FC<{ type: AirdropType }> = ({ type }) => {
  const typeClasses: Record<AirdropType, string> = {
    [AirdropType.Whitelist]: 'bg-slate-100 text-slate-600',
    [AirdropType.Quest]: 'bg-indigo-100 text-indigo-600',
  };
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${typeClasses[type]}`}>
      {type}
    </span>
  );
};


interface AirdropCardProps {
  airdrop: Airdrop;
  onAirdropUpdate: (airdropId: number, updatedFields: Partial<Airdrop>) => void;
  viewAsOwner: boolean;
  onAirdropDelete: (airdropId: number) => void;
}

const AirdropCard: React.FC<AirdropCardProps> = (props) => {
    const {
        computedStatus,
        progressPercentage,
        claimed,
        total,
        contractBalance,
        isBalanceLoading,
        anyError,
        showOwnerControls,
        ownerAction,
        isCheckingClaimedStatus,
        hasClaimed,
        eligibility,
        claimStatus,
        claimButtonText,
        questEligibility,
        questSignature,
        isDeleteModalOpen,
        deleteStatus,
        deleteError,
        withdrawStatus,
        withdrawError,
        withdrawButtonText,
        questButtonText,
        isQuestButtonDisabled,
        isSuccessModalOpen,
        handleClaim,
        handleQuestVerify,
        handleDelete,
        handleWithdraw,
        openDeleteModal,
        closeDeleteModal,
        closeSuccessModal,
        handleActionClick,
    } = useAirdropCard(props);
    
    const { airdrop, viewAsOwner } = props;

    const renderClaimAction = () => {
        if (isCheckingClaimedStatus) return <p className="text-xs text-slate-500 animate-pulse">Checking status...</p>;
        
        // Claimed state: Gray button
        if (hasClaimed || questEligibility.status === 'claimed') {
            return <button disabled className="px-4 py-2 text-sm font-semibold text-slate-500 bg-slate-200 rounded-lg cursor-default">Claimed</button>;
        }

        if (airdrop.type === AirdropType.Whitelist) {
            if (eligibility.status === 'checking') return <p className="text-xs text-slate-500 animate-pulse">Checking eligibility...</p>;
            if (eligibility.status === 'ineligible') return <button disabled className="px-4 py-2 text-sm font-semibold text-slate-500 bg-slate-200 rounded-lg cursor-default">Not Eligible</button>;
            if (eligibility.status === 'eligible' || eligibility.status === 'error') {
                // Claim button: Green
                return <button onClick={handleClaim} disabled={claimStatus !== 'idle' && claimStatus !== 'error'} className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed">{claimButtonText}</button>;
            }
        }

        if (airdrop.type === AirdropType.Quest) {
            if (questEligibility.status === 'checking') return <p className="text-xs text-slate-500 animate-pulse">Checking status...</p>;
            if (questEligibility.status === 'verified' || questSignature) {
                // Claim button (after verification): Green
                return <button onClick={handleClaim} disabled={claimStatus !== 'idle' && claimStatus !== 'error'} className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed">{claimButtonText}</button>;
            }
            // Verify button: Purple
            return <button onClick={handleQuestVerify} disabled={isQuestButtonDisabled} className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed">{questButtonText}</button>;
        }
        
        return null;
    }

    const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);
    
    // Improved share text generation
    let rewardString = 'a reward';
    if (airdrop.maxReward && airdrop.tokenSymbol) {
      rewardString = `${formatNumber(airdrop.maxReward)} ${airdrop.tokenSymbol}`;
    } else if (airdrop.tokenSymbol) {
      rewardString = `some ${airdrop.tokenSymbol}`;
    }

    const shareText = `Claimed ${rewardString} in "${airdrop.name}" — Moneygun makes it fun.`;
    const shareUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(`${window.location.origin}/api/share/frame/${airdrop.id}`)}`;


    return (
        <div className="relative bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200 space-y-4">
            <div className="flex items-start gap-4">
                <img src={airdrop.image || 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/app/moneygun/money.svg'} alt={`${airdrop.name} airdrop icon`} className="w-12 h-12 rounded-lg object-cover bg-slate-100 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                        <h2 className="text-base font-semibold text-slate-800 truncate pr-2">{airdrop.name}</h2>
                        {showOwnerControls && (computedStatus === AirdropStatus.Draft || computedStatus === AirdropStatus.Ended) && <button onClick={openDeleteModal} className="-mt-1 p-1.5 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" aria-label="Delete airdrop"><TrashIcon className="w-5 h-5" /></button>}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{airdrop.description || 'No description'}</p>
                </div>
            </div>
            
            <div className="flex items-start text-xs">
                <div className="w-1/2"><p className="text-slate-500">Start Time</p><p className="font-medium text-slate-800">{formatDateTime(airdrop.startTime)}</p></div>
                <div className="w-1/2"><p className="text-slate-500">End Time</p><p className="font-medium text-slate-800">{formatDateTime(airdrop.endTime)}</p></div>
            </div>

            {computedStatus === AirdropStatus.InProgress && total > 0 && (
                <div className="w-full bg-slate-200 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }} role="progressbar" aria-valuenow={progressPercentage} aria-valuemin={0} aria-valuemax={100} aria-label={`Airdrop progress: ${progressPercentage.toFixed(0)}% claimed`}></div>
                </div>
            )}
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div><p className="text-slate-500">Network</p><p className="font-medium text-slate-800">{formatNetworkName(airdrop.network)}</p></div>
                <div><p className="text-slate-500">Total Amount</p><p className="font-medium text-slate-800">{formatNumber(airdrop.totalAmount)} {airdrop.tokenSymbol}</p></div>
                <div><p className="text-slate-500">Claimed / Total</p><p className="font-medium text-slate-800">{`${claimed} / ${total}`}</p></div>
                {viewAsOwner ? (
                    <div>
                        <p className="text-slate-500">Contract Balance</p>
                        <p className="font-medium text-slate-800">
                            {isBalanceLoading ? (
                                <span className="animate-pulse">...</span>
                            ) : (
                                <>
                                    {typeof contractBalance === 'bigint' ? formatUnits(contractBalance, airdrop.tokenDecimals || 18) : 'N/A'} {airdrop.tokenSymbol}
                                </>
                            )}
                        </p>
                    </div>
                ) : (
                    <div><p className="text-slate-500">Reward</p><p className="font-medium text-slate-800">{airdrop.maxReward ? `Up to ${formatNumber(airdrop.maxReward)} ${airdrop.tokenSymbol}`: 'Varies'}</p></div>
                )}
            </div>

            <div className="pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center min-h-[36px]">
                    <div className="flex items-center gap-2">
                        <TypeBadge type={airdrop.type} />
                        <StatusBadge status={computedStatus} />
                    </div>
                    <div className="flex-shrink-0 flex justify-end items-center gap-2">
                        {airdrop.action && (
                            <a 
                                href={airdrop.action}
                                onClick={handleActionClick}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2.5 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                                aria-label="View details"
                            >
                                <ArrowUpRightIcon className="w-4 h-4" />
                            </a>
                        )}

                        {showOwnerControls && ownerAction ? (
                             <div className="relative group">
                                <button onClick={ownerAction.buttonAction} disabled={ownerAction.buttonDisabled} className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed ${ownerAction.buttonClassName}`}>{ownerAction.buttonText}</button>
                                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 text-xs leading-tight text-white bg-slate-800 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20 text-center">
                                    {ownerAction.description}
                                    <div className="absolute top-full right-4 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-slate-800"></div>
                                </div>
                            </div>
                        ) : computedStatus === AirdropStatus.InProgress && !showOwnerControls ? (
                           renderClaimAction()
                        ) : null}
                    </div>
                </div>
                {anyError && <p className="text-red-600 text-xs mt-2 text-center w-full">{anyError}</p>}
            </div>
            
            {isSuccessModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="success-modal-title">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
                        <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h2 id="success-modal-title" className="text-xl font-semibold text-slate-800">Congratulations!</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            You have successfully claimed your airdrop.
                        </p>
                        
                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button 
                                onClick={closeSuccessModal} 
                                className="w-full px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                            >
                                Close
                            </button>
                            <a 
                                href={shareUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={closeSuccessModal}
                                className="w-full px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 flex items-center justify-center"
                            >
                               Share
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
                        {typeof contractBalance === 'bigint' && contractBalance > 0n ? (
                             <>
                                <h2 id="delete-modal-title" className="text-lg font-semibold text-slate-800">Contract Has Funds</h2>
                                <p className="mt-2 text-sm text-slate-600">
                                    This contract still holds{' '}
                                    <strong className="font-medium">
                                        {formatUnits(contractBalance, airdrop.tokenDecimals || 18)} {airdrop.tokenSymbol}
                                    </strong>.
                                    You should withdraw these funds to your wallet before deleting.
                                </p>
                                <p className="mt-2 text-xs text-slate-500">
                                    Deleting this entry only removes it from the dashboard. It does not affect the on-chain contract.
                                </p>
                                
                                {withdrawError && <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-md">{withdrawError}</p>}
                                
                                {withdrawStatus === 'success' && (
                                    <p className="mt-4 text-sm text-green-600 bg-green-50 p-3 rounded-md">
                                        Withdrawal successful! Closing modal...
                                    </p>
                                )}

                                <div className="mt-6 flex justify-end gap-3">
                                    <button 
                                        onClick={closeDeleteModal} 
                                        disabled={withdrawStatus === 'waiting' || withdrawStatus === 'withdrawing' || withdrawStatus === 'success'}
                                        className="px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleWithdraw} 
                                        disabled={withdrawStatus === 'waiting' || withdrawStatus === 'withdrawing' || withdrawStatus === 'success'}
                                        className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400 disabled:cursor-wait"
                                    >
                                        {withdrawButtonText}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h2 id="delete-modal-title" className="text-lg font-semibold text-slate-800">Delete Airdrop?</h2>
                                <p className="mt-2 text-sm text-slate-600">Are you sure you want to permanently delete the <strong className="font-medium">"{airdrop.name}"</strong> airdrop? This action cannot be undone.</p>
                                {deleteError && <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-md">{deleteError}</p>}
                                <div className="mt-6 flex justify-end gap-3">
                                    <button onClick={closeDeleteModal} disabled={deleteStatus === 'deleting'} className="px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:opacity-50">Cancel</button>
                                    <button onClick={handleDelete} disabled={deleteStatus === 'deleting'} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-red-400 disabled:cursor-wait">{deleteStatus === 'deleting' ? 'Deleting...' : 'Delete'}</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AirdropCard;
