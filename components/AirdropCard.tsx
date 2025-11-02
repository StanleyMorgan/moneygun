

import React, { useState, useEffect } from 'react';
import { Airdrop, AirdropStatus } from '../types';
import { CogIcon } from './icons/CogIcon';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { airdropABI } from '../lib/abi';
import { formatUnits, parseUnits, getAddress } from 'viem';

// This function computes the status based on start and end times if the status is 'In Progress'.
export const getComputedStatus = (airdrop: Airdrop): AirdropStatus => {
  if (airdrop.status !== AirdropStatus.InProgress) {
    return airdrop.status;
  }

  const now = new Date();
  const startTime = airdrop.startTime ? new Date(airdrop.startTime) : null;
  const endTime = airdrop.endTime ? new Date(airdrop.endTime) : null;

  if (startTime && now < startTime) {
    return AirdropStatus.Draft; // Or a new "Scheduled" status if you add one
  }
  if (endTime && now > endTime) {
    return AirdropStatus.Completed;
  }
  return AirdropStatus.InProgress;
};


const StatusBadge: React.FC<{ status: AirdropStatus }> = ({ status }) => {
  const statusClasses = {
    [AirdropStatus.Draft]: 'bg-slate-100 text-slate-600',
    [AirdropStatus.InProgress]: 'bg-blue-100 text-blue-600 animate-pulse',
    [AirdropStatus.Completed]: 'bg-green-100 text-green-600',
    [AirdropStatus.Failed]: 'bg-red-100 text-red-600',
  };
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusClasses[status]}`}>
      {status}
    </span>
  );
};

interface AirdropCardProps {
  airdrop: Airdrop;
}

const AirdropCard: React.FC<AirdropCardProps> = ({ airdrop }) => {
    // Fix: Add `chain` to the `useAccount` hook to explicitly pass it to `writeContract`.
    const { address, isConnected, chain } = useAccount();
    const [claimStatus, setClaimStatus] = useState<'idle' | 'fetching' | 'claiming' | 'waiting' | 'success' | 'error'>('idle');
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
        // Fix: The 'watch' property is deprecated in this version of wagmi's useReadContract hook.
        // The hook automatically updates on new blocks by default.
    });

    const { data: claimedCount } = useReadContract({
        ...contractReadConfig,
        functionName: 'claimedCount',
        // Fix: The 'watch' property is deprecated in this version of wagmi's useReadContract hook.
        // The hook automatically updates on new blocks by default.
    });

    const isOwner = isConnected && address && airdrop.creatorAddress && getAddress(address) === getAddress(airdrop.creatorAddress);
    const computedStatus = getComputedStatus(airdrop);

    const handleClaim = async () => {
        setClaimError('');
        // Fix: Also check for `chain` availability before proceeding.
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
            
            // Fix: Explicitly pass account and chain to `writeContract` as they are not being
            // inferred from the context, causing a TypeScript error.
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
    
    // Effect to update claim status in DB after successful transaction
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
                    // Non-critical error, the user has their tokens. Maybe log this.
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
                    {isOwner && <button className="text-slate-400 hover:text-slate-600"><CogIcon className="w-5 h-5" /></button>}
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

            {isOwner && (
                <div className="text-xs bg-slate-50 p-3 rounded-md">
                    <p className="font-medium text-slate-700">Owner Actions</p>
                    <p className="text-slate-600 mt-1">To fund the airdrop, send {airdrop.tokenSymbol} tokens to this address on {airdrop.network}:</p>
                    <code className="block bg-slate-200 text-slate-800 rounded px-2 py-1 mt-2 text-center break-all">{airdrop.contractAddress}</code>
                </div>
            )}
            
            {computedStatus === AirdropStatus.InProgress && !isOwner && (
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