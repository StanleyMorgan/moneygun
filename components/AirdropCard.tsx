import React, { useState, useEffect } from 'react';
import { Airdrop, AirdropStatus } from '../types';
import { CogIcon } from './icons/CogIcon';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { airdropABI } from '../lib/abi';
import { formatUnits, parseUnits, getAddress } from 'viem';

export const getComputedStatus = (airdrop: Airdrop): AirdropStatus => {
    if (airdrop.status === AirdropStatus.Failed) {
        return AirdropStatus.Failed;
    }
    if (airdrop.status === AirdropStatus.Draft) {
        return AirdropStatus.Draft;
    }

    if (airdrop.status === AirdropStatus.Active) {
        const now = new Date();
        const startTime = airdrop.startTime ? new Date(airdrop.startTime) : null;
        const endTime = airdrop.endTime ? new Date(airdrop.endTime) : null;

        if (startTime && now < startTime) {
            return AirdropStatus.Planned;
        }
        if (endTime && now > endTime) {
            return AirdropStatus.Ended;
        }
        if (startTime && now >= startTime && (!endTime || now <= endTime)) {
            return AirdropStatus.InProgress;
        }
    }
    return airdrop.status;
};


const StatusBadge: React.FC<{ status: AirdropStatus }> = ({ status }) => {
  const statusClasses: Record<AirdropStatus, string> = {
    [AirdropStatus.Draft]: 'bg-slate-100 text-slate-600',
    [AirdropStatus.Planned]: 'bg-yellow-100 text-yellow-600',
    [AirdropStatus.InProgress]: 'bg-blue-100 text-blue-600 animate-pulse',
    [AirdropStatus.Ended]: 'bg-green-100 text-green-600',
    [AirdropStatus.Failed]: 'bg-red-100 text-red-600',
    [AirdropStatus.Active]: 'bg-purple-100 text-purple-600', // Fallback
  };
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusClasses[status]}`}>
      {status}
    </span>
  );
};

interface AirdropCardProps {
  airdrop: Airdrop;
  onAirdropUpdate: (airdropId: number, updatedFields: Partial<Airdrop>) => void;
  viewAsOwner: boolean;
}

const AirdropCard: React.FC<AirdropCardProps> = ({ airdrop, onAirdropUpdate, viewAsOwner }) => {
    const { address, isConnected, chain } = useAccount();
    const [claimStatus, setClaimStatus] = useState<'idle' | 'fetching' | 'claiming' | 'waiting' | 'success' | 'error'>('idle');
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [claimError, setClaimError] = useState('');

    console.log(`[AirdropCard Render - ${airdrop.name}] Account State:`, { address, isConnected });

    const { data: writeHash, writeContract, error: writeError } = useWriteContract();
    const { isSuccess: isClaimedSuccess } = useWaitForTransactionReceipt({ hash: writeHash });

    const contractReadConfig = {
        address: airdrop.contractAddress ? getAddress(airdrop.contractAddress) : undefined,
        abi: airdropABI,
    }

    const { data: contractBalance } = useReadContract({
        ...contractReadConfig,
        functionName: 'balance',
    });

    const { data: claimedCount } = useReadContract({
        ...contractReadConfig,
        functionName: 'claimedCount',
    });

    // isActualOwner checks if the connected wallet is the creator of this airdrop.
    const isActualOwner = isConnected && address && airdrop.creatorAddress && getAddress(address) === getAddress(airdrop.creatorAddress);
    // showOwnerControls determines if owner UI should be displayed. It's true only
    // if the user is the actual owner AND is on a view where owner actions are expected (like the 'Manage' tab).
    const showOwnerControls = isActualOwner && viewAsOwner;
    const computedStatus = getComputedStatus(airdrop);

    const handleStatusToggle = async () => {
        if (!isActualOwner || !address) return;

        const newStatus = airdrop.status === AirdropStatus.Draft ? AirdropStatus.Active : AirdropStatus.Draft;
        
        setIsUpdatingStatus(true);
        // Optimistic UI update
        onAirdropUpdate(airdrop.id, { status: newStatus });

        try {
            const response = await fetch('/api/airdrops', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'updateStatus', 
                    airdropId: airdrop.id, 
                    newStatus, 
                    userAddress: address 
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update status.');
            }
        } catch (error: any) {
            console.error("Failed to update airdrop status:", error);
            // Revert on error
            onAirdropUpdate(airdrop.id, { status: airdrop.status });
            // Optionally show an error message to the user
            alert(`Error: ${error.message}`);
        } finally {
            setIsUpdatingStatus(false);
        }
    };


    const handleClaim = async () => {
        setClaimError('');
        if (!isConnected || !address || !chain) {
            setClaimError('Please connect your wallet.');
            console.error('[Claim Button Clicked] Error: Wallet not connected or chain not available.');
            return;
        }
        if (!airdrop.contractAddress) {
            setClaimError('Airdrop contract not available.');
            return;
        }

        try {
            setClaimStatus('fetching');
            console.log('[Claim] Step 1: Fetching proof for user:', address);
            const response = await fetch(`/api/airdrops?airdropId=${airdrop.id}&userAddress=${address}`);
            if (!response.ok) {
                const { message } = await response.json();
                throw new Error(message || 'You are not eligible for this airdrop.');
            }
            const { amount, proof } = await response.json();
            console.log('[Claim] Step 1 Success:', { amount, proof });
            
            setClaimStatus('claiming');
            console.log('[Claim] Step 2: Calling "claim" on contract...');
            const amountInBaseUnits = parseUnits(amount, airdrop.tokenDecimals || 18);
            
            writeContract({
                address: getAddress(airdrop.contractAddress),
                abi: airdropABI,
                functionName: 'claim',
                args: [amountInBaseUnits, proof],
                account: address,
                chain: chain,
            });
            setClaimStatus('waiting');
        } catch (err: any) {
            console.error('[Claim] Fetching proof failed:', err);
            setClaimError(err.message);
            setClaimStatus('error');
        }
    };
    
    useEffect(() => {
        const updateClaimInDb = async () => {
            if (isClaimedSuccess && address) {
                console.log('[Claim] Step 2 Success: Transaction confirmed.');
                setClaimStatus('success');
                try {
                    console.log('[Claim] Step 3: Updating claim status in DB...');
                    await fetch('/api/airdrops', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'updateClaim', airdropId: airdrop.id, userAddress: address }),
                    });
                    console.log('[Claim] Step 3 Success: DB updated.');
                } catch (dbError) {
                    console.error('[Claim] Failed to update DB:', dbError);
                }
            }
        };
        updateClaimInDb();
    }, [isClaimedSuccess, airdrop.id, address]);

    useEffect(() => {
        if(writeError) {
            console.error('[Claim] Contract write error:', writeError);
            setClaimError(writeError.message);
            setClaimStatus('error');
        }
    }, [writeError]);


    const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);

    return (
        <div className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-slate-800 truncate">{airdrop.name}</h2>
                    <p className="text-xs text-slate-500 mt-1">{airdrop.description || 'No description'}</p>
                </div>
                <div className="mt-3 sm:mt-0 sm:ml-4 flex items-center gap-4">
                    <StatusBadge status={computedStatus} />
                    {showOwnerControls && <button className="text-slate-400 hover:text-slate-600"><CogIcon className="w-5 h-5" /></button>}
                </div>
            </div>

            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                    <p className="text-slate-500">Recipients</p>
                    <p className="font-medium text-slate-800">{formatNumber(airdrop.recipientCount)}</p>
                </div>
                <div>
                    <p className="text-slate-500">Total Amount</p>
                    <p className="font-medium text-slate-800">{formatNumber(airdrop.totalAmount)} {airdrop.tokenSymbol}</p>
                </div>
                <div>
                    <p className="text-slate-500">Contract Balance</p>
                    <p className="font-medium text-slate-800">{typeof contractBalance === 'bigint' ? formatUnits(contractBalance, airdrop.tokenDecimals || 18) : '0'} {airdrop.tokenSymbol}</p>
                </div>
                 <div>
                    <p className="text-slate-500">Claimed</p>
                    <p className="font-medium text-slate-800">{claimedCount?.toString() || '0'} / {airdrop.recipientCount}</p>
                </div>
            </div>

            {showOwnerControls && (
                <div className="space-y-3 text-xs bg-slate-50 p-3 rounded-md">
                    <div>
                        <p className="font-medium text-slate-700">Owner Actions</p>
                        <p className="text-slate-600 mt-1">To fund the airdrop, send {airdrop.tokenSymbol} tokens to this address on {airdrop.network}:</p>
                        <code className="block bg-slate-200 text-slate-800 rounded px-2 py-1 mt-2 text-center break-all">{airdrop.contractAddress}</code>
                    </div>
                    <div className="pt-2 border-t border-slate-200">
                        <p className="text-slate-600">Change status. Active airdrops can be claimed by users during the scheduled time.</p>
                        <button
                            onClick={handleStatusToggle}
                            disabled={isUpdatingStatus}
                            className={`mt-2 w-full px-3 py-1.5 text-xs font-semibold text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed ${
                                airdrop.status === AirdropStatus.Draft
                                ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                                : 'bg-slate-600 hover:bg-slate-700 focus:ring-slate-500'
                            }`}
                        >
                            {isUpdatingStatus ? 'Updating...' : (airdrop.status === AirdropStatus.Draft ? 'Activate Airdrop' : 'Set to Draft')}
                        </button>
                    </div>
                </div>
            )}
            
            {computedStatus === AirdropStatus.InProgress && !showOwnerControls && (
                <div className="pt-4 border-t border-slate-100">
                    <button 
                        onClick={handleClaim} 
                        disabled={claimStatus !== 'idle' && claimStatus !== 'error'}
                        className="w-full px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed"
                    >
                        {claimStatus === 'idle' && 'Claim My Tokens'}
                        {claimStatus === 'fetching' && 'Checking eligibility...'}
                        {claimStatus === 'claiming' && 'Check wallet to confirm...'}
                        {claimStatus === 'waiting' && 'Processing transaction...'}
                        {claimStatus === 'success' && 'Tokens Claimed!'}
                        {claimStatus === 'error' && 'Try Again'}
                    </button>
                    {claimError && <p className="text-xs text-red-600 text-center mt-2">{claimError}</p>}
                </div>
            )}
        </div>
    );
};

export default AirdropCard;