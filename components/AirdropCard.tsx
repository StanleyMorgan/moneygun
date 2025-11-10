
import React from 'react';
import { Airdrop, AirdropStatus, AirdropType } from '../types';
import { useAirdropCard, getBlockExplorerUrl, formatNetworkName, formatDateTime } from '../hooks/useAirdropCard';
import { ArrowUpRightIcon } from './icons/ArrowUpRightIcon';
import { CogIcon } from './icons/CogIcon';
import { TrashIcon } from './icons/TrashIcon';
import { InfoIcon } from './icons/InfoIcon';

interface AirdropCardProps {
  airdrop: Airdrop;
  onAirdropUpdate: (airdropId: number, updatedFields: Partial<Airdrop>) => void;
  viewAsOwner: boolean;
  onAirdropDelete: (airdropId: number) => void;
}

const AirdropCard: React.FC<AirdropCardProps> = (props) => {
  const {
    // State and Computed Values
    computedStatus,
    progressPercentage,
    claimed,
    total,
    contractBalance,
    isBalanceLoading,
    isConsideredFunded,
    anyError,
    showOwnerControls,
    ownerAction,
    // Claiming
    isCheckingClaimedStatus,
    hasClaimed,
    eligibility,
    claimStatus,
    claimButtonText,
    // Quest
    questEligibility,
    questVerifyStatus,
    questSignature,
    questButtonText,
    isQuestButtonDisabled,
    // Deleting
    isDeleteModalOpen,
    deleteStatus,
    deleteError,
    // Withdrawing
    withdrawStatus,
    withdrawError,
    withdrawButtonText,
    // Handlers
    handleClaim,
    handleQuestVerify,
    handleDelete,
    handleWithdraw,
    openDeleteModal,
    closeDeleteModal,
  } = useAirdropCard(props);
  const { airdrop } = props;


  const StatusBadge: React.FC<{ status: AirdropStatus }> = ({ status }) => {
    const statusStyles: Record<AirdropStatus, { text: string; bg: string, dot: string }> = {
      [AirdropStatus.InProgress]: { text: 'text-green-700', bg: 'bg-green-100', dot: 'bg-green-500' },
      [AirdropStatus.Planned]: { text: 'text-blue-700', bg: 'bg-blue-100', dot: 'bg-blue-500' },
      [AirdropStatus.Ended]: { text: 'text-slate-700', bg: 'bg-slate-100', dot: 'bg-slate-500' },
      [AirdropStatus.Draft]: { text: 'text-yellow-700', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
      [AirdropStatus.Failed]: { text: 'text-red-700', bg: 'bg-red-100', dot: 'bg-red-500' },
      [AirdropStatus.Active]: { text: 'text-green-700', bg: 'bg-green-100', dot: 'bg-green-500' }, // Fallback
    };
    const { text, bg, dot } = statusStyles[status] || statusStyles[AirdropStatus.Ended];
    return (
      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${text} ${bg}`}>
        <span className={`w-2 h-2 mr-1.5 rounded-full ${dot}`}></span>
        {status.replace('_', ' ')}
      </span>
    );
  };
  
  const formattedTotalAmount = new Intl.NumberFormat().format(airdrop.totalAmount);
  const formattedBalance = contractBalance != null 
    ? parseFloat((Number(contractBalance) / (10 ** (airdrop.tokenDecimals || 18))).toFixed(4))
    : 0;

  const renderClaimerAction = () => {
    if (showOwnerControls) return null;
    if (hasClaimed) {
        return <div className="text-sm text-center font-medium text-green-600 bg-green-50 p-3 rounded-lg">You have already claimed this airdrop.</div>
    }
    if (computedStatus !== AirdropStatus.InProgress) {
        return <div className="text-sm text-center font-medium text-slate-500 bg-slate-50 p-3 rounded-lg">This airdrop is not active for claims.</div>
    }
    if (airdrop.type === AirdropType.Whitelist) {
        if (isCheckingClaimedStatus || eligibility.status === 'checking') return <div className="text-sm text-center animate-pulse">Checking eligibility...</div>
        if (eligibility.status === 'eligible') {
            return (
                 <button onClick={handleClaim} disabled={claimStatus !== 'idle' && claimStatus !== 'error'} className="w-full bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-purple-700 disabled:bg-purple-300 transition-colors">
                    {claimButtonText}
                </button>
            )
        }
        if (eligibility.status === 'ineligible') {
            return <div className="text-sm text-center font-medium text-slate-500 bg-slate-50 p-3 rounded-lg">You are not eligible for this airdrop.</div>
        }
    }
    if (airdrop.type === AirdropType.Quest) {
        if (questEligibility.status === 'checking') return <div className="text-sm text-center animate-pulse">Checking quest status...</div>
        if (questEligibility.status === 'claimed') return <div className="text-sm text-center text-green-600 bg-green-50 p-3 rounded-lg">Quest reward already claimed.</div>
        if (questEligibility.status === 'not_started' || questVerifyStatus === 'idle' || questVerifyStatus === 'error') {
            return (
                <button onClick={handleQuestVerify} disabled={isQuestButtonDisabled} className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors">
                    {questButtonText}
                </button>
            )
        }
        if (questVerifyStatus === 'verifying') {
             return <div className="text-sm text-center animate-pulse">Verifying quest completion...</div>
        }
        if (questVerifyStatus === 'verified' && questSignature) {
             return (
                 <button onClick={handleClaim} disabled={claimStatus !== 'idle' && claimStatus !== 'error'} className="w-full bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-purple-700 disabled:bg-purple-300 transition-colors">
                    {claimButtonText}
                </button>
            )
        }
    }
    return null;
  }
  
  const renderOwnerAction = () => {
    if (!showOwnerControls || !ownerAction) return null;

    return (
        <div className="bg-slate-50 p-3 rounded-lg text-center">
            <p className="text-xs text-slate-600 mb-2">{ownerAction.description}</p>
            <button
                onClick={ownerAction.buttonAction}
                disabled={ownerAction.buttonDisabled}
                className={`w-full text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 ${ownerAction.buttonClassName}`}
            >
                {ownerAction.buttonText}
            </button>
        </div>
    );
  };
  
  const DeleteModal = () => {
    if (!isDeleteModalOpen) return null;
    const hasBalance = contractBalance != null && contractBalance > 0;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-sm m-4">
          <h3 className="text-lg font-bold">Delete Airdrop</h3>
          <p className="text-sm text-slate-600 mt-2">
            {hasBalance ? 'This contract still holds funds.' : 'Are you sure you want to permanently delete this airdrop? This action cannot be undone.'}
          </p>
          
          {hasBalance && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs p-3 rounded-lg">
                <p className="font-semibold mb-1 flex items-center gap-1.5"><InfoIcon className="w-4 h-4" /> Important</p>
                To delete this airdrop, you must first withdraw the remaining <span className="font-bold">{formattedBalance} {airdrop.tokenSymbol}</span>.
                Withdrawing is an on-chain transaction.
            </div>
          )}

          {withdrawError && <div className="mt-2 text-xs text-red-600">{withdrawError}</div>}
          {deleteError && <div className="mt-2 text-xs text-red-600">{deleteError}</div>}
          
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={closeDeleteModal} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">
              Cancel
            </button>
            {hasBalance ? (
                <button
                    onClick={handleWithdraw}
                    disabled={withdrawStatus !== 'idle' && withdrawStatus !== 'error'}
                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-blue-300"
                >
                    {withdrawButtonText}
                </button>
            ) : (
                <button
                    onClick={handleDelete}
                    disabled={deleteStatus === 'deleting'}
                    className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:bg-red-300"
                >
                    {deleteStatus === 'deleting' ? 'Deleting...' : 'Delete Airdrop'}
                </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-4">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-800">{airdrop.name}</h2>
          <div className="flex items-center text-xs text-slate-500 gap-2">
            <span>{formatNetworkName(airdrop.network)}</span>
            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
            <span>{formattedTotalAmount} <span className="font-medium">{airdrop.tokenSymbol}</span></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <StatusBadge status={computedStatus} />
            {showOwnerControls && (
                 <div className="relative group">
                    <button className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-full"><CogIcon className="w-5 h-5" /></button>
                     <div className="absolute top-full right-0 mt-1 bg-white border rounded-md shadow-lg w-40 z-10 hidden group-hover:block">
                        <button onClick={openDeleteModal} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                            <TrashIcon className="w-4 h-4" /> Delete Airdrop
                        </button>
                    </div>
                 </div>
            )}
        </div>
      </div>
      
      {airdrop.description && <p className="text-xs text-slate-600">{airdrop.description}</p>}
      
      {airdrop.type === AirdropType.Quest && airdrop.questUrl && (
         <a href={airdrop.questUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
            View Quest <ArrowUpRightIcon className="w-3 h-3" />
        </a>
      )}

      <div>
        <div className="flex justify-between items-center text-xs mb-1">
          <span className="font-medium text-slate-600">Claims</span>
          <span className="text-slate-500">{new Intl.NumberFormat().format(claimed)} / {new Intl.NumberFormat().format(total)}</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${progressPercentage}%` }}></div>
        </div>
      </div>
      
      <div className="border-t border-slate-200 pt-3">
          {renderClaimerAction()}
          {renderOwnerAction()}
      </div>

      {anyError && <div className="text-xs text-red-600 bg-red-50 p-2 rounded-md">{anyError}</div>}
      
       <div className="text-xs text-slate-400 flex items-center justify-between">
           <div>
            {airdrop.startTime && <span>Starts: {formatDateTime(airdrop.startTime)}</span>}
            {airdrop.endTime && <span className="ml-2">Ends: {formatDateTime(airdrop.endTime)}</span>}
           </div>
           {airdrop.contractAddress && (
             <a href={getBlockExplorerUrl(airdrop.network, airdrop.contractAddress)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                Contract <ArrowUpRightIcon className="w-3 h-3" />
             </a>
            )}
      </div>

       {showOwnerControls && (
            <div className={`text-xs p-2 rounded-md ${isConsideredFunded ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                Contract Balance: {isBalanceLoading ? 'Loading...' : `${new Intl.NumberFormat().format(formattedBalance)} ${airdrop.tokenSymbol}`}
            </div>
        )}
      <DeleteModal />
    </div>
  );
};

export default AirdropCard;
