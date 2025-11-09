import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getAddress, formatUnits, parseUnits, UserRejectedRequestError, BaseError, pad, toHex } from 'viem';
import { Airdrop, AirdropStatus, AirdropType } from '../types';
import { airdropABI, erc20ABI, questAirdropABI } from '../lib/abi';
import { deleteAirdrop, verifyQuest } from '../lib/api';

// --- Helper Functions (moved from component) ---

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

export const getBlockExplorerUrl = (network: string | undefined, address: string | undefined) => {
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

export const formatNetworkName = (network: string | undefined) => {
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

export const formatDateTime = (date: Date | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

// --- Hook Definition ---

interface UseAirdropCardProps {
  airdrop: Airdrop;
  onAirdropUpdate: (airdropId: number, updatedFields: Partial<Airdrop>) => void;
  viewAsOwner: boolean;
  onAirdropDelete: (airdropId: number) => void;
}

export const useAirdropCard = ({ airdrop, onAirdropUpdate, viewAsOwner, onAirdropDelete }: UseAirdropCardProps) => {
    const { address, isConnected, chain } = useAccount();

    // State management
    const [claimStatus, setClaimStatus] = useState<'idle' | 'fetching' | 'claiming' | 'waiting' | 'success' | 'error'>('idle');
    const [claimError, setClaimError] = useState('');
    const [questVerifyStatus, setQuestVerifyStatus] = useState<'idle' | 'verifying' | 'verified' | 'error'>('idle');
    const [questSignature, setQuestSignature] = useState<`0x${string}` | null>(null);
    const [questAmount, setQuestAmount] = useState<string | null>(null);
    const [questError, setQuestError] = useState('');
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [fundingStatus, setFundingStatus] = useState<'idle' | 'approving' | 'funding' | 'success' | 'error'>('idle');
    const [fundingError, setFundingError] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteStatus, setDeleteStatus] = useState<'idle' | 'deleting' | 'error'>('idle');
    const [deleteError, setDeleteError] = useState('');
    const [withdrawStatus, setWithdrawStatus] = useState<'idle' | 'withdrawing' | 'waiting' | 'success' | 'error'>('idle');
    const [withdrawError, setWithdrawError] = useState('');
    const [eligibility, setEligibility] = useState<{ status: 'idle' | 'checking' | 'eligible' | 'ineligible' | 'error', error: string | null }>({ status: 'idle', error: null });
    const [questEligibility, setQuestEligibility] = useState<{ status: 'idle' | 'checking' | 'verified' | 'claimed' | 'not_started' | 'error', error: string | null }>({ status: 'idle', error: null });

    // Wagmi hooks
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
    };

    const { data: contractBalance, refetch: refetchBalance } = useReadContract({
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

    // Computed state
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

    // Handlers
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

    const handleStatusToggle = useCallback(async () => {
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
    }, [isActualOwner, address, airdrop.id, airdrop.status, onAirdropUpdate, contractBalance]);
    
    const handleLoad = useCallback(async () => {
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
    }, [isConnected, address, chain, airdrop.contractAddress, airdrop.tokenAddress, totalAmountInBaseUnits, approve]);

    const handleWhitelistClaim = useCallback(async () => {
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
    }, [isConnected, address, chain, airdrop, claim]);
    
    const handleQuestClaim = useCallback(async () => {
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
    }, [isConnected, address, chain, airdrop, questSignature, questAmount, claim]);

    const handleClaim = airdrop.type === AirdropType.Whitelist ? handleWhitelistClaim : handleQuestClaim;

    const handleDelete = useCallback(async () => {
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
    }, [isActualOwner, address, airdrop.id, onAirdropDelete]);

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

    // Side Effects
    useEffect(() => { // Whitelist eligibility
        if (computedStatus === AirdropStatus.InProgress && !showOwnerControls && isConnected && address && airdrop.type === AirdropType.Whitelist) {
            const checkEligibility = async () => {
                setEligibility({ status: 'checking', error: null });
                try {
                    const response = await fetch(`/api/airdrops?airdropId=${airdrop.id}&userAddress=${address}`);
                    if (response.ok) setEligibility({ status: 'eligible', error: null });
                    else if (response.status === 404) setEligibility({ status: 'ineligible', error: null });
                    else {
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

    useEffect(() => { // Quest eligibility
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

    useEffect(() => { // Handle approval success
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

    useEffect(() => { // Handle funding success
        if (isFundSuccess) {
            setFundingStatus('success');
            refetchBalance();
            refetchClaimedCount();
        }
    }, [isFundSuccess, refetchBalance, refetchClaimedCount]);
    
    useEffect(() => { // Handle funding errors
        const err = approveError || fundError;
        if (err) {
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

    useEffect(() => { // Handle claim success
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

    useEffect(() => { // Handle claim error
        if (claimErrorHook) {
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

    useEffect(() => { // Handle withdraw waiting
        if (isWaitingForWithdraw) setWithdrawStatus('waiting');
    }, [isWaitingForWithdraw]);

    useEffect(() => { // Handle withdraw success
        if (isWithdrawSuccess) {
            setWithdrawStatus('success');
            refetchBalance();
            setTimeout(() => {
                setIsDeleteModalOpen(false);
                setWithdrawStatus('idle');
            }, 2500);
        }
    }, [isWithdrawSuccess, refetchBalance]);

    useEffect(() => { // Handle withdraw error
        if (withdrawErrorHook) {
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

    // UI Derived State & Functions
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

    const loadButtonText = () => {
        if (fundingStatus === 'success') return 'Funded!';
        if (fundingStatus === 'error') return 'Retry Load';
        if (isApproving || fundingStatus === 'approving') return 'Check Wallet for Approval...';
        if (isWaitingForApproval) return 'Approving...';
        if (isFunding || fundingStatus === 'funding') return 'Check Wallet to Fund...';
        if (isWaitingForFund) return 'Funding...';
        return 'Load';
    };

    const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);
    
    let ownerAction;
    if (showOwnerControls) {
        if (airdrop.status === AirdropStatus.Active) {
            ownerAction = { description: "Pause the airdrop by setting it back to Draft.", buttonText: isUpdatingStatus ? 'Updating...' : 'Set to Draft', buttonAction: handleStatusToggle, buttonDisabled: isUpdatingStatus, buttonClassName: 'bg-slate-600 hover:bg-slate-700 focus:ring-slate-500' };
        } else if (isConsideredFunded) {
            ownerAction = { description: "Airdrop is funded. Activate it to allow user claims.", buttonText: isUpdatingStatus ? 'Updating...' : 'Activate', buttonAction: handleStatusToggle, buttonDisabled: isUpdatingStatus, buttonClassName: 'bg-green-600 hover:bg-green-700 focus:ring-green-500' };
        } else {
            ownerAction = {
                // FIX: Replaced JSX with a template string to resolve syntax errors in the .ts file.
                description: `Fund the contract with ${formatNumber(airdrop.totalAmount)} ${airdrop.tokenSymbol} to enable claims.`,
                buttonText: loadButtonText(), buttonAction: handleLoad, buttonDisabled: (fundingStatus !== 'idle' && fundingStatus !== 'error'), buttonClassName: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
            };
        }
    }

    return {
        // State and Computed Values
        address,
        computedStatus,
        progressPercentage,
        claimed,
        total,
        contractBalance,
        isConsideredFunded,
        anyError,
        showOwnerControls,
        ownerAction,

        // Claiming
        isCheckingClaimedStatus,
        hasClaimed,
        eligibility,
        claimStatus,
        claimButtonText: claimButtonText(),
        
        // Quest
        questEligibility,
        questVerifyStatus,
        questSignature,
        
        // Deleting
        isDeleteModalOpen,
        deleteStatus,
        deleteError,

        // Withdrawing
        withdrawStatus,
        withdrawError,
        withdrawButtonText: withdrawButtonText(),
        
        // Handlers
        handleClaim,
        handleQuestVerify,
        handleDelete,
        handleWithdraw,
        openDeleteModal: () => setIsDeleteModalOpen(true),
        closeDeleteModal: () => {
            setIsDeleteModalOpen(false);
            setDeleteError('');
            setDeleteStatus('idle');
            setWithdrawError('');
            setWithdrawStatus('idle');
        },
    };
};
