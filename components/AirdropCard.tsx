// Fix: Manually include global type definitions to ensure custom JSX elements are recognized.
/// <reference path="../global.d.ts" />

import React, { useState, useEffect, useCallback } from 'react';
import { Airdrop, AirdropStatus, AirdropType } from '../types';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { airdropABI, erc20ABI, questAirdropABI } from '../lib/abi';
import { formatUnits, parseUnits, getAddress, UserRejectedRequestError, BaseError, pad, toHex } from 'viem';
import { InfoIcon } from './icons/InfoIcon';
import { deleteAirdrop, verifyQuest } from '../lib/api';
import { TrashIcon } from './icons/TrashIcon';

export const getComputedStatus = (airdrop: Airdrop, claimedCount?: number, recipientCount?: number): AirdropStatus => {
    if (airdrop.status === AirdropStatus.Failed) {
        return AirdropStatus.Failed;
    }
    if (airdrop.status === AirdropStatus.Draft) {
        return AirdropStatus.Draft;
    }

    if (claimedCount !== undefined && recipientCount !== undefined && recipientCount > 0 && claimedCount >= recipientCount) {
        return AirdropStatus.Ended;
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

const getBlockExplorerUrl = (network: string | undefined, address: string | undefined) => {
    if (!network || !address) return '#';
    switch (network) {
        case 'base':
            return `https://basescan.org/address/${address}`;
        case 'base-sepolia':
            return `https://sepolia.basescan.org/address/${address}`;
        case 'monad-testnet':
            return `https://monad-testnet.socialscan.io/address/${address}`;
        default:
            return '#';
    }
};

const formatNetworkName = (network: string | undefined) => {
    if (!network) return 'Unknown';
    switch (network) {
        case 'base':
            return 'Base';
        case 'base-sepolia':
            return 'Base Sepolia';
        case 'monad-testnet':
            return 'Monad Testnet';
        default:
            return network;
    }
};

const formatDateTime = (date: Date | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};


const AirdropCard: React.FC<AirdropCardProps> = ({ airdrop, onAirdropUpdate, viewAsOwner, onAirdropDelete }) => {
    const { address, isConnected, chain } = useAccount();
    const [claimStatus, setClaimStatus] = useState<'idle' | 'fetching' | 'claiming' | 'waiting' | 'success' | 'error'>('idle');
    const [claimError, setClaimError] = useState('');
    
    // Quest-specific state
    const [questVerifyStatus, setQuestVerifyStatus] = useState<'idle' | 'verifying' | 'verified' | 'error'>('idle');
    const [questSignature, setQuestSignature] = useState<`0x${string}` | null>(null);
    const [questAmount, setQuestAmount] = useState<string | null>(null);
    const [questError, setQuestError] = useState('');
    const [questEligibility, setQuestEligibility] = useState<{ status: 'idle' | 'checking' | 'verified' | 'claimed' | 'not_started' | 'error', error: string | null }>({ status: 'idle', error: null });


    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [fundingStatus, setFundingStatus] = useState<'idle' | 'approving' | 'funding' | 'success' | 'error'>('idle');
    const [fundingError, setFundingError] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting' | 'error'>('idle');
    const [deleteError, setDeleteError] = useState('');
    const [eligibility, setEligibility] = useState<{ status: 'idle' | 'checking' | 'eligible' | 'ineligible' | 'error', error: string | null }>({ status: 'idle', error: null });

    // Withdrawal state
    const [withdrawStatus, setWithdrawStatus] = useState<'idle' | 'withdrawing' | 'waiting' | 'success' | 'error'>('idle');
    const [withdrawError, setWithdrawError] = useState('');

    const { data: claimHash, writeContract: claim, error: claimErrorHook } = useWriteContract();
    const { isSuccess: isClaimedSuccess } = useWaitForTransactionReceipt({ hash: claimHash });
    
    const { data: approveHash, writeContract: approve, isPending: isApproving, error: approveError } = useWriteContract();
    const { data: fundHash, writeContract: fund, isPending: isFunding, error: fundError } = useWriteContract();
    const { isSuccess: isApproveSuccess, isLoading: isWaitingForApproval } = useWaitForTransactionReceipt({ hash: approveHash });
    const { isSuccess: isFundSuccess, isLoading: isWaitingForFund } = useWaitForTransactionReceipt({ hash: fundHash });
    
    const { data: withdrawHash, writeContract: withdraw, error: withdrawErrorHook } = useWriteContract();
    const { isSuccess: isWithdrawSuccess, isLoading: isWaitingForWithdraw } = useWaitForTransactionReceipt({ hash: withdrawHash });


    const contractReadConfig = {
        address: airdrop.contractAddress ? getAddress(airdrop.contractAddress) : undefined,
        abi: airdrop.type === AirdropType.Whitelist ? airdropABI : questAirdropABI,
    }

    const { data: contractBalance, refetch: refetchBalance } = useReadContract({
        // Fix: To read the token balance of the airdrop contract, we must call `balanceOf`
        // on the TOKEN contract (`tokenAddress`), passing it the AIRDROP contract's address (`contractAddress`).
        address: airdrop.tokenAddress ? getAddress(airdrop.tokenAddress) : undefined,
        abi: erc20ABI,
        functionName: 'balanceOf',
        args: airdrop.contractAddress ? [getAddress(airdrop.contractAddress)] : undefined,
    });

    const { data: contractClaimedCount, refetch: refetchClaimedCount } = useReadContract({
        ...contractReadConfig,
        functionName: 'claimedCount',
    });
    
    const { data: hasClaimed, isLoading: isCheckingClaimedStatus, refetch: refetchHasClaimed } = useReadContract({
        ...contractReadConfig,
        functionName: 'claimed',
        args: address ? [address] : undefined,
    });


    const isActualOwner = isConnected && address && airdrop.creatorAddress && getAddress(address) === getAddress(airdrop.creatorAddress);
    const showOwnerControls = isActualOwner && viewAsOwner;

    const totalAmountInBaseUnits = parseUnits(String(airdrop.totalAmount), airdrop.tokenDecimals || 18);
    const isFunded = typeof contractBalance === 'bigint' && contractBalance >= totalAmountInBaseUnits;

    const claimed = contractClaimedCount !== undefined ? Number(contractClaimedCount) : airdrop.claimedCount ?? 0;
    const total = airdrop.recipientCount;
    const progressPercentage = total > 0 ? Math.min((claimed / total) * 100, 100) : 0;
    const computedStatus = getComputedStatus(airdrop, claimed, total);
    const isConsideredFunded = isFunded || claimed > 0;
    const anyError = claimError || fundingError || questError || (eligibility.status === 'error' ? eligibility.error : null) || (questEligibility.status === 'error' ? questEligibility.error : null);
    
    const handleQuestVerify = useCallback(async () => {
        if (!isConnected || !address) {
            setQuestError('Please connect your wallet.');
            return;
        }
        setQuestError('');
        setQuestVerifyStatus('verifying');
        try {
            const { amount, signature } = await verifyQuest(airdrop.id, address);
            setQuestAmount(amount);
            setQuestSignature(signature);
            setQuestVerifyStatus('verified');
        } catch (err: any) {
            setQuestError(err.message);
            setQuestVerifyStatus('error');
        }
    }, [airdrop.id, address, isConnected]);

    // Whitelist eligibility check
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
        }
    }, [airdrop.id, airdrop.type, address, isConnected, computedStatus, showOwnerControls]);

    // Quest eligibility check
    useEffect(() => {
        if (computedStatus === AirdropStatus.InProgress && !showOwnerControls && isConnected && address && airdrop.type === AirdropType.Quest) {
            const checkQuestEligibility = async () => {
                setQuestEligibility({ status: 'checking', error: null });
                try {
                    const response = await fetch(`/api/airdrops?airdropId=${airdrop.id}&userAddress=${address}`);
                    if (response.ok) {
                        const { status } = await response.json(); // 'verified' or 'claimed'
                        setQuestEligibility({ status, error: null });
                        if (status === 'verified' && !questSignature && questVerifyStatus !== 'verifying' && questVerifyStatus !== 'verified') {
                             handleQuestVerify();
                        }
                    } else if (response.status === 404) {
                        setQuestEligibility({ status: 'not_started', error: null });
                    } else {
                        const { message } = await response.json();
                        throw new Error(message || 'Failed to check quest status.');
                    }
                } catch (err: any) {
                    setQuestEligibility({ status: 'error', error: err.message });
                }
            };
            checkQuestEligibility();
        }
    }, [airdrop.id, airdrop.type, address, isConnected, computedStatus, showOwnerControls, questSignature, questVerifyStatus, handleQuestVerify]);


    const handleStatusToggle = async () => {
        if (!isActualOwner || !address) return;
        const newStatus = airdrop.status === AirdropStatus.Draft ? AirdropStatus.Active : AirdropStatus.Draft;
        if (newStatus === AirdropStatus.Active && (typeof contractBalance !== 'bigint' || contractBalance === 0n)) {
            alert("Cannot activate an airdrop with a zero balance. Please load the contract first.");
            return;
        }
        setIsUpdatingStatus(true);
        onAirdropUpdate(airdrop.id, { status: newStatus });
        try {
            const response = await fetch('/api/airdrops', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updateStatus', airdropId: airdrop.id, newStatus, userAddress: address })
            });
            if (!response.ok) throw new Error((await response.json()).message || 'Failed to update status.');
        } catch (error: any) {
            console.error("Failed to update airdrop status:", error);
            onAirdropUpdate(airdrop.id, { status: airdrop.status });
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
                    abi: airdrop.type === AirdropType.Whitelist ? airdropABI : questAirdropABI,
                    functionName: 'fund',
                    args: [totalAmountInBaseUnits],
                    account: address,
                    chain: chain,
                });
            } catch (err: any) {
                console.error('[Funding] Contract write error:', err);
                setFundingError('An unexpected error occurred during funding.');
                setFundingStatus('error');
            }
        }
    }, [isApproveSuccess, airdrop.contractAddress, airdrop.type, totalAmountInBaseUnits, address, chain, fund]);

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
            const isUserRejection = err instanceof BaseError && !!err.walk(e => e instanceof UserRejectedRequestError);
            if (isUserRejection) {
                setFundingStatus('idle');
                setFundingError('');
            } else {
                setFundingError('Transaction failed. Please try again.');
                setFundingStatus('error');
            }
        }
    }, [approveError, fundError]);


    const handleWhitelistClaim = async () => {
        setClaimError('');
        if (!isConnected || !address || !chain || !airdrop.contractAddress) return setClaimError('Wallet not connected or contract details missing.');

        try {
            setClaimStatus('fetching');
            const response = await fetch(`/api/airdrops?airdropId=${airdrop.id}&userAddress=${address}`);
            if (!response.ok) throw new Error((await response.json()).message || 'You are not eligible for this airdrop.');
            
            const { amount, proof } = await response.json();
            setClaimStatus('claiming');
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
            setClaimError(err.message);
            setClaimStatus('error');
        }
    };
    
    const handleQuestClaim = async () => {
        setClaimError('');
        if (!isConnected || !address || !chain || !airdrop.contractAddress || !questSignature || !questAmount) {
            return setClaimError('Claim details are missing. Please verify again.');
        }

        try {
            setClaimStatus('claiming');
            const amountInBaseUnits = parseUnits(questAmount, airdrop.tokenDecimals || 18);
            const questIdBytes32 = pad(toHex(airdrop.id), { size: 32 });
            
            claim({
                address: getAddress(airdrop.contractAddress),
                abi: questAirdropABI,
                functionName: 'claim',
                args: [amountInBaseUnits, questIdBytes32, questSignature],
                account: address,
                chain: chain,
            });
            setClaimStatus('waiting');
        } catch (err: any) {
            console.error('[Quest Claim] Contract write error:', err);
            setClaimError('An unexpected error occurred during claim.');
            setClaimStatus('error');
        }
    };
    
    useEffect(() => {
        const updateClaimInDb = async () => {
            if (isClaimedSuccess && address) {
                setClaimStatus('success');
                refetchHasClaimed();
                try {
                    await fetch('/api/airdrops', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'updateClaim', airdropId: airdrop.id, userAddress: address }),
                    });
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
            const isUserRejection = claimErrorHook instanceof BaseError && !!claimErrorHook.walk(e => e instanceof UserRejectedRequestError);
            if (isUserRejection) {
                setClaimStatus('idle');
                setClaimError('');
            } else {
                setClaimError('Transaction failed. Please try again.');
                setClaimStatus('error');
            }
        }
    }, [claimErrorHook]);

    const handleDelete = async () => {
        if (!isActualOwner || !address) return;
        setDeleteStatus('deleting');
        setDeleteError('');
        try {
            await deleteAirdrop(airdrop.id, address);
            onAirdropDelete(airdrop.id);
        } catch (error: any) {
            console.error("Failed to delete airdrop:", error);
            setDeleteError(error.message || 'Failed to delete airdrop. Please try again.');
            setDeleteStatus('error');
        }
    };

    const handleWithdraw = useCallback(() => {
        setWithdrawError('');
        if (!isActualOwner || !airdrop.contractAddress || !chain) {
            setWithdrawError("Cannot withdraw. Ensure you are the owner and your wallet is connected to the correct network.");
            setWithdrawStatus('error');
            return;
        }
        setWithdrawStatus('withdrawing');
        try {
            withdraw({
                address: getAddress(airdrop.contractAddress),
                abi: airdrop.type === AirdropType.Whitelist ? airdropABI : questAirdropABI,
                functionName: 'emergencyWithdraw',
                account: address,
                chain: chain,
            });
        } catch (err: any) {
            console.error('[Withdraw] Contract write error:', err);
            setWithdrawError('An unexpected error occurred during withdrawal.');
            setWithdrawStatus('error');
        }
    }, [isActualOwner, airdrop.contractAddress, airdrop.type, chain, address, withdraw]);

    useEffect(() => {
        if (isWaitingForWithdraw) {
            setWithdrawStatus('waiting');
        }
    }, [isWaitingForWithdraw]);

    useEffect(() => {
        if (isWithdrawSuccess) {
            setWithdrawStatus('success');
            refetchBalance();
            setTimeout(() => {
                setIsDeleteModalOpen(false);
                setWithdrawStatus('idle');
            }, 2500);
        }
    }, [isWithdrawSuccess, refetchBalance]);

    useEffect(() => {
        if (withdrawErrorHook) {
            console.error('[Withdraw] Transaction error:', withdrawErrorHook);
            const isUserRejection = withdrawErrorHook instanceof BaseError && !!withdrawErrorHook.walk(e => e instanceof UserRejectedRequestError);
            if (isUserRejection) {
                setWithdrawStatus('idle');
                setWithdrawError('');
            } else {
                setWithdrawError('Transaction failed. Please try again.');
                setWithdrawStatus('error');
            }
        }
    }, [withdrawErrorHook]);


    const claimButtonText = () => {
        if (claimStatus === 'success') return 'Claimed!';
        if (claimStatus === 'waiting') return 'Processing...';
        if (claimStatus === 'claiming') return 'Confirm in wallet...';
        if (claimStatus === 'fetching') return 'Preparing...';
        if (claimStatus === 'error') return 'Try Again';
        return 'Claim';
    };
    
    const withdrawButtonText = () => {
        switch (withdrawStatus) {
            case 'success': return 'Success!';
            case 'waiting': return 'Processing...';
            case 'withdrawing': return 'Check Wallet...';
            case 'error': return 'Retry Withdrawal';
            default: return 'Withdraw Funds';
        }
    };

    const renderClaimAction = () => {
        if (isCheckingClaimedStatus) return <p className="text-xs text-slate-500 animate-pulse">Checking status...</p>;
        if (hasClaimed || questEligibility.status === 'claimed') return <button disabled className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg cursor-default">Claimed</button>;

        if (airdrop.type === AirdropType.Whitelist) {
            if (eligibility.status === 'checking') return <p className="text-xs text-slate-500 animate-pulse">Checking eligibility...</p>;
            if (eligibility.status === 'ineligible') return <button disabled className="px-4 py-2 text-sm font-semibold text-slate-500 bg-slate-200 rounded-lg cursor-default">Not Eligible</button>;
            if (eligibility.status === 'eligible' || eligibility.status === 'error') {
                return <button onClick={handleWhitelistClaim} disabled={claimStatus !== 'idle' && claimStatus !== 'error'} className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed">{claimButtonText()}</button>;
            }
        }

        if (airdrop.type === AirdropType.Quest) {
            if (questEligibility.status === 'checking') return <p className="text-xs text-slate-500 animate-pulse">Checking status...</p>;
            if (questVerifyStatus === 'verified' || questSignature) {
                return <button onClick={handleQuestClaim} disabled={claimStatus !== 'idle' && claimStatus !== 'error'} className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed">{claimButtonText()}</button>;
            }
            const verifyText = questVerifyStatus === 'verifying' ? 'Verifying...' : questVerifyStatus === 'error' ? 'Retry Verification' : 'Verify Quest';
            return <button onClick={handleQuestVerify} disabled={questVerifyStatus === 'verifying'} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed">{verifyText}</button>;
        }
        
        return null;
    }

    const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);
    
    let ownerAction;
    if (showOwnerControls) {
        if (airdrop.status === AirdropStatus.Active) {
            ownerAction = { description: "Pause the airdrop by setting it back to Draft.", buttonText: isUpdatingStatus ? 'Updating...' : 'Set to Draft', buttonAction: handleStatusToggle, buttonDisabled: isUpdatingStatus, buttonClassName: 'bg-slate-600 hover:bg-slate-700 focus:ring-slate-500' };
        } else if (isConsideredFunded) {
            ownerAction = { description: "Airdrop is funded. Activate it to allow user claims.", buttonText: isUpdatingStatus ? 'Updating...' : 'Activate', buttonAction: handleStatusToggle, buttonDisabled: isUpdatingStatus, buttonClassName: 'bg-green-600 hover:bg-green-700 focus:ring-green-500' };
        } else {
            const loadButtonText = () => {
                if (fundingStatus === 'success') return 'Funded!';
                if (fundingStatus === 'error') return 'Retry Load';
                if (isApproving || fundingStatus === 'approving') return 'Check Wallet for Approval...';
                if (isWaitingForApproval) return 'Approving...';
                if (isFunding || fundingStatus === 'funding') return 'Check Wallet to Fund...';
                if (isWaitingForFund) return 'Funding...';
                return 'Load';
            };
            ownerAction = {
                description: (<>Fund the <a href={getBlockExplorerUrl(airdrop.network, airdrop.contractAddress)} target="_blank" rel="noopener noreferrer" className="font-medium text-purple-600 hover:text-purple-700 underline transition-colors">contract</a> with {formatNumber(airdrop.totalAmount)} {airdrop.tokenSymbol} to enable claims.</>),
                buttonText: loadButtonText(), buttonAction: handleLoad, buttonDisabled: (fundingStatus !== 'idle' && fundingStatus !== 'error'), buttonClassName: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
            };
        }
    }


    return (
        <div className="relative bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200 space-y-4">
            <div className="flex items-start gap-4">
                <img src={airdrop.image || 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/app/moneygun/money.svg'} alt={`${airdrop.name} airdrop icon`} className="w-12 h-12 rounded-lg object-cover bg-slate-100 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                        <h2 className="text-base font-semibold text-slate-800 truncate pr-2">{airdrop.name}</h2>
                        {showOwnerControls && <button onClick={() => setIsDeleteModalOpen(true)} className="-mt-1 p-1.5 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors" aria-label="Delete airdrop"><TrashIcon className="w-5 h-5" /></button>}
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
                    <div><p className="text-slate-500">Contract Balance</p><p className="font-medium text-slate-800">{typeof contractBalance === 'bigint' ? formatUnits(contractBalance, airdrop.tokenDecimals || 18) : '0'} {airdrop.tokenSymbol}</p></div>
                ) : (
                    <div><p className="text-slate-500">Reward</p><p className="font-medium text-slate-800">{airdrop.maxReward ? `${formatNumber(airdrop.maxReward)} ${airdrop.tokenSymbol}`: 'Varies'}</p></div>
                )}
            </div>

            <div className="pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center min-h-[36px]">
                    <div className="flex items-center gap-2">
                        <TypeBadge type={airdrop.type} />
                        <StatusBadge status={computedStatus} />
                    </div>
                    <div className="flex-shrink-0 flex justify-end">
                        {showOwnerControls && ownerAction ? (
                            <div className="flex items-center gap-2">
                                <div className="relative group flex items-center">
                                    <InfoIcon className="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help" />
                                    <div className="absolute bottom-full right-1/2 translate-x-1/2 mb-2 w-64 p-3 text-xs leading-relaxed text-white bg-slate-800 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 text-center">
                                        {ownerAction.description}
                                        <svg className="absolute text-slate-800 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255" xmlSpace="preserve"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
                                    </div>
                                </div>
                                <button onClick={ownerAction.buttonAction} disabled={ownerAction.buttonDisabled} className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed ${ownerAction.buttonClassName}`}>{ownerAction.buttonText}</button>
                            </div>
                        ) : computedStatus === AirdropStatus.InProgress && !showOwnerControls ? (
                            <div className="flex justify-end items-center gap-4">{renderClaimAction()}</div>
                        ) : null}
                    </div>
                </div>
                {anyError && <p className="text-red-600 text-xs mt-2 text-center w-full">{anyError}</p>}
            </div>
            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm text-center">
                        {/* FIX: Use `typeof` check to narrow `contractBalance` from `unknown` to `bigint` before comparison. */}
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
                                        onClick={() => { setIsDeleteModalOpen(false); setWithdrawStatus('idle'); setWithdrawError(''); }} 
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
                                        {withdrawButtonText()}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h2 id="delete-modal-title" className="text-lg font-semibold text-slate-800">Delete Airdrop?</h2>
                                <p className="mt-2 text-sm text-slate-600">Are you sure you want to permanently delete the <strong className="font-medium">"{airdrop.name}"</strong> airdrop? This action cannot be undone.</p>
                                {deleteError && <p className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-md">{deleteError}</p>}
                                <div className="mt-6 flex justify-end gap-3">
                                    <button onClick={() => { setIsDeleteModalOpen(false); setDeleteError(''); setDeleteStatus('idle'); }} disabled={deleteStatus === 'deleting'} className="px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:opacity-50">Cancel</button>
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