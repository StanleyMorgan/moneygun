// Fix: Manually include global type definitions to ensure custom JSX elements are recognized.
/// <reference path="../global.d.ts" />

import React, { useState, useEffect } from 'react';
import { Airdrop, AirdropStatus, AirdropType } from '../types';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { airdropABI, erc20ABI } from '../lib/abi';
// FIX: Import `BaseError` from `viem` to safely check the error type before calling `.walk()`.
import { formatUnits, parseUnits, getAddress, UserRejectedRequestError, BaseError } from 'viem';

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

const getBlockExplorerUrl = (network: string | undefined, address: string | undefined) => {
    if (!network || !address) return '#';
    switch (network) {
        case 'base':
            return `https://basescan.org/address/${address}`;
        case 'base-sepolia':
            return `https://sepolia.basescan.org/address/${address}`;
        default:
            return '#';
    }
};

const truncateAddress = (address: string | undefined) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatNetworkName = (network: string | undefined) => {
    if (!network) return 'Unknown';
    switch (network) {
        case 'base':
            return 'Base';
        case 'base-sepolia':
            return 'Base Sepolia';
        default:
            return network;
    }
};


const AirdropCard: React.FC<AirdropCardProps> = ({ airdrop, onAirdropUpdate, viewAsOwner }) => {
    const { address, isConnected, chain } = useAccount();
    const [claimStatus, setClaimStatus] = useState<'idle' | 'fetching' | 'claiming' | 'waiting' | 'success' | 'error'>('idle');
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [claimError, setClaimError] = useState('');
    const [fundingStatus, setFundingStatus] = useState<'idle' | 'approving' | 'funding' | 'success' | 'error'>('idle');
    const [fundingError, setFundingError] = useState('');
    // FIX: Added 'error' to the status type to allow setting an error state. This resolves multiple downstream type errors.
    const [eligibility, setEligibility] = useState<{ status: 'idle' | 'checking' | 'eligible' | 'ineligible' | 'error', error: string | null }>({ status: 'idle', error: null });

    console.log(`[AirdropCard Render - ${airdrop.name}] Account State:`, { address, isConnected });

    const { data: claimHash, writeContract: claim, error: claimErrorHook } = useWriteContract();
    const { isSuccess: isClaimedSuccess } = useWaitForTransactionReceipt({ hash: claimHash });
    
    const { data: approveHash, writeContract: approve, isPending: isApproving, error: approveError } = useWriteContract();
    const { data: fundHash, writeContract: fund, isPending: isFunding, error: fundError } = useWriteContract();
    const { isSuccess: isApproveSuccess, isLoading: isWaitingForApproval } = useWaitForTransactionReceipt({ hash: approveHash });
    const { isSuccess: isFundSuccess, isLoading: isWaitingForFund } = useWaitForTransactionReceipt({ hash: fundHash });


    const contractReadConfig = {
        address: airdrop.contractAddress ? getAddress(airdrop.contractAddress) : undefined,
        abi: airdropABI,
    }

    const { data: contractBalance, refetch: refetchBalance } = useReadContract({
        ...contractReadConfig,
        functionName: 'balance',
    });

    const { data: claimedCount, refetch: refetchClaimedCount } = useReadContract({
        ...contractReadConfig,
        functionName: 'claimedCount',
    });
    
    // FIX: Removed the deprecated 'enabled' property. `useReadContract` automatically disables the query if `args` or `address` is undefined.
    const { data: hasClaimed, isLoading: isCheckingClaimedStatus, refetch: refetchHasClaimed } = useReadContract({
        ...contractReadConfig,
        functionName: 'claimed',
        args: address ? [address] : undefined,
    });


    // isActualOwner checks if the connected wallet is the creator of this airdrop.
    const isActualOwner = isConnected && address && airdrop.creatorAddress && getAddress(address) === getAddress(airdrop.creatorAddress);
    // showOwnerControls determines if owner UI should be displayed. It's true only
    // if the user is the actual owner AND is on a view where owner actions are expected (like the 'Manage' tab).
    const showOwnerControls = isActualOwner && viewAsOwner;
    const computedStatus = getComputedStatus(airdrop);

    const totalAmountInBaseUnits = parseUnits(String(airdrop.totalAmount), airdrop.tokenDecimals || 18);
    const isFunded = typeof contractBalance === 'bigint' && contractBalance >= totalAmountInBaseUnits;

    const claimed = Number(claimedCount?.toString() || '0');
    const total = airdrop.recipientCount;
    const progressPercentage = total > 0 ? Math.min((claimed / total) * 100, 100) : 0;

    useEffect(() => {
        if (computedStatus === AirdropStatus.InProgress && !showOwnerControls && isConnected && address && airdrop.type === AirdropType.Whitelist) {
            const checkEligibility = async () => {
                setEligibility({ status: 'checking', error: null });
                try {
                    const response = await fetch(`/api/airdrops?airdropId=${airdrop.id}&userAddress=${address}`);
                    if (response.ok) {
                        setEligibility({ status: 'eligible', error: null });
                    } else if (response.status === 404) {
                        setEligibility({ status: 'ineligible', error: null });
                    } else {
                        const { message } = await response.json();
                        throw new Error(message || 'Failed to check eligibility.');
                    }
                } catch (err: any) {
                    setEligibility({ status: 'error', error: err.message });
                }
            };
            checkEligibility();
        } else if (airdrop.type !== AirdropType.Whitelist) {
             setEligibility({ status: 'eligible', error: null });
        }
    }, [airdrop.id, airdrop.type, address, isConnected, computedStatus, showOwnerControls]);

    const handleStatusToggle = async () => {
        if (!isActualOwner || !address) return;

        const newStatus = airdrop.status === AirdropStatus.Draft ? AirdropStatus.Active : AirdropStatus.Draft;
        
        // Prevent activation if the balance is zero
        if (newStatus === AirdropStatus.Active && (typeof contractBalance !== 'bigint' || contractBalance === 0n)) {
            alert("Cannot activate an airdrop with a zero balance. Please load the contract first.");
            return;
        }

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
    
    const handleLoad = async () => {
        setFundingError('');
        if (!isConnected || !address || !chain || !airdrop.contractAddress || !airdrop.tokenAddress) {
            setFundingError('Wallet not connected or contract details missing.');
            return;
        }

        try {
            setFundingStatus('approving');
            approve({
                address: getAddress(airdrop.tokenAddress),
                abi: erc20ABI,
                functionName: 'approve',
                args: [getAddress(airdrop.contractAddress), totalAmountInBaseUnits],
                account: address,
                chain: chain,
            });
        } catch (err: any) {
            console.error('[Funding] Contract write error:', err);
            // Only show user-friendly errors in the UI.
            setFundingError('An unexpected error occurred during approval.');
            setFundingStatus('error');
        }
    };

    useEffect(() => {
        if (isApproveSuccess) {
            setFundingStatus('funding');
            try {
                fund({
                    address: getAddress(airdrop.contractAddress!),
                    abi: airdropABI,
                    functionName: 'fund',
                    args: [totalAmountInBaseUnits],
                    account: address,
                    chain: chain,
                });
            } catch (err: any) {
                console.error('[Funding] Contract write error:', err);
                 // Only show user-friendly errors in the UI.
                setFundingError('An unexpected error occurred during funding.');
                setFundingStatus('error');
            }
        }
    }, [isApproveSuccess, airdrop.contractAddress, airdropABI, totalAmountInBaseUnits, address, chain, fund]);

    useEffect(() => {
        if (isFundSuccess) {
            setFundingStatus('success');
            refetchBalance();
            refetchClaimedCount();
        }
    }, [isFundSuccess, refetchBalance, refetchClaimedCount]);
    
    useEffect(() => {
        const err = approveError || fundError;
        if (err) {
            console.error('[Funding] Contract write error:', err);

            let isUserRejection = false;
            if (err instanceof BaseError) {
                isUserRejection = !!err.walk(e => e instanceof UserRejectedRequestError);
            }

            if (isUserRejection) {
                // If the user rejected the transaction, reset the button to its initial state without an error.
                setFundingStatus('idle');
                setFundingError('');
            } else {
                // For all other errors, show a generic, user-friendly message.
                setFundingError('Transaction failed. Please try again.');
                setFundingStatus('error');
            }
        }
    }, [approveError, fundError]);


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
            
            claim({
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
                refetchHasClaimed();
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
    }, [isClaimedSuccess, airdrop.id, address, refetchHasClaimed]);

    useEffect(() => {
        if (claimErrorHook) {
            console.error('[Claim] Contract write error:', claimErrorHook);
            
            let isUserRejection = false;
            // The error from wagmi can be a viem BaseError or a generic Error.
            // The .walk() method only exists on BaseError instances.
            if (claimErrorHook instanceof BaseError) {
                // FIX: The `walk` method returns the error instance if found (truthy), or null (falsy).
                // This was causing a type error by assigning an Error object to a boolean.
                // Coerce the result to a boolean for the `isUserRejection` flag.
                isUserRejection = !!claimErrorHook.walk(e => e instanceof UserRejectedRequestError);
            }

            if (isUserRejection) {
                // If the user rejected the transaction, just reset the button to its initial state.
                setClaimStatus('idle');
                setClaimError('');
            } else {
                // For all other errors, show a generic, user-friendly message.
                setClaimError('Transaction failed. Please try again.');
                setClaimStatus('error');
            }
        }
    }, [claimErrorHook]);

    const fundingButtonText = () => {
        if (isFunded) return 'Contract Funded';
        if (fundingStatus === 'success') return 'Funded Successfully';
        if (fundingStatus === 'error') return 'Retry Load';
        if (isApproving || fundingStatus === 'approving') return 'Check Wallet for Approval...';
        if (isWaitingForApproval) return 'Approving...';
        if (isFunding || fundingStatus === 'funding') return 'Check Wallet to Fund...';
        if (isWaitingForFund) return 'Funding...';
        return 'Load';
    };
    
    const claimButtonText = () => {
        if (claimStatus === 'success') return 'Claimed!';
        if (claimStatus === 'waiting') return 'Processing...';
        if (claimStatus === 'claiming') return 'Confirm in wallet...';
        if (claimStatus === 'fetching') return 'Preparing...';
        if (claimStatus === 'error') return 'Try Again';
        return 'Claim';
    };

    const isActivatingWithZeroBalance = airdrop.status === AirdropStatus.Draft && (typeof contractBalance !== 'bigint' || contractBalance === 0n);

    const renderClaimAction = () => {
        if (isCheckingClaimedStatus || eligibility.status === 'checking') {
            return (
                <p className="text-xs text-slate-500 animate-pulse">
                    Checking status...
                </p>
            );
        }
        
        if (hasClaimed) {
             return (
                <button disabled className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg cursor-default">
                    Claimed
                </button>
            );
        }
        
        if (airdrop.type === AirdropType.Whitelist && eligibility.status === 'ineligible') {
            return (
                 <button disabled className="px-4 py-2 text-sm font-semibold text-slate-500 bg-slate-200 rounded-lg cursor-default">
                    Not Eligible
                </button>
            )
        }
        
        if (eligibility.status === 'error') {
            return (
                 <p className="text-xs text-red-600 text-center">{eligibility.error}</p>
            )
        }

        if (eligibility.status === 'eligible') {
            return (
                <button 
                    onClick={handleClaim} 
                    disabled={claimStatus !== 'idle' && claimStatus !== 'error'}
                    className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                    {claimButtonText()}
                </button>
            )
        }
        
        return null;
    }


    const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);

    return (
        <div className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-slate-800 truncate">{airdrop.name}</h2>
                    <p className="text-xs text-slate-500 mt-1">{airdrop.description || 'No description'}</p>
                </div>
                <div className="mt-3 sm:mt-0 sm:ml-4 flex items-center gap-4 flex-shrink-0">
                    <StatusBadge status={computedStatus} />
                </div>
            </div>

            {computedStatus === AirdropStatus.InProgress && !showOwnerControls && total > 0 && (
                <div className="space-y-1">
                     <div className="w-full bg-slate-200 rounded-full h-2">
                        <div 
                            className="bg-purple-600 h-2 rounded-full transition-all duration-500" 
                            style={{ width: `${progressPercentage}%` }}
                            role="progressbar"
                            aria-valuenow={progressPercentage}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Airdrop progress: ${progressPercentage.toFixed(0)}% claimed`}
                        ></div>
                    </div>
                </div>
            )}

            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
                <div>
                    <p className="text-slate-500">Network</p>
                    <p className="font-medium text-slate-800">{formatNetworkName(airdrop.network)}</p>
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
                    <p className="text-slate-500">Recipients</p>
                    <p className="font-medium text-slate-800">{formatNumber(airdrop.recipientCount)}</p>
                </div>
                 <div>
                    <p className="text-slate-500">Claimed</p>
                    <p className="font-medium text-slate-800">{claimedCount?.toString() || '0'} / {airdrop.recipientCount}</p>
                </div>
            </div>

            {showOwnerControls && (
                <div className="space-y-3 text-xs bg-slate-50 p-3 rounded-md">
                    <p className="font-medium text-slate-700">Owner Actions</p>
                    <div className="pt-2 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 md:gap-4">
                        {/* Fund Section */}
                        <div className="flex flex-col">
                            <p className="text-slate-600 mb-2 flex-grow">
                                Fund the{' '}
                                <a
                                    href={getBlockExplorerUrl(airdrop.network, airdrop.contractAddress)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-purple-600 hover:text-purple-700 underline transition-colors"
                                    aria-label="View contract on block explorer"
                                >
                                    contract
                                </a>
                                {' '}with {formatNumber(airdrop.totalAmount)} {airdrop.tokenSymbol} to enable claims.
                            </p>
                             <div>
                                <button
                                    onClick={handleLoad}
                                    disabled={isFunded || fundingStatus !== 'idle' && fundingStatus !== 'error'}
                                    className={`w-full px-3 py-1.5 text-xs font-semibold text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed ${
                                        isFunded ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                                    }`}
                                >
                                    {fundingButtonText()}
                                </button>
                                {fundingError && <p className="text-red-600 mt-2 text-center">{fundingError}</p>}
                            </div>
                        </div>
                        {/* Status Toggle Section */}
                        <div className="pt-4 border-t border-slate-200 md:pt-0 md:border-t-0 md:pl-4 md:border-l flex flex-col">
                           <p className="text-slate-600 mb-2 flex-grow">Set airdrop to Active to allow user claims.</p>
                           <div>
                                <button
                                    onClick={handleStatusToggle}
                                    disabled={isUpdatingStatus || isActivatingWithZeroBalance}
                                    className={`w-full px-3 py-1.5 text-xs font-semibold text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed ${
                                        airdrop.status === AirdropStatus.Draft
                                        ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                                        : 'bg-slate-600 hover:bg-slate-700 focus:ring-slate-500'
                                    }`}
                                >
                                    {isUpdatingStatus ? 'Updating...' : (airdrop.status === AirdropStatus.Draft ? 'Activate' : 'Set to Draft')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {computedStatus === AirdropStatus.InProgress && !showOwnerControls && (
                <div className="pt-4 border-t border-slate-100 flex justify-end items-center gap-4">
                     {claimError && <p className="text-xs text-red-600">{claimError}</p>}
                     {renderClaimAction()}
                </div>
            )}
        </div>
    );
};

export default AirdropCard;