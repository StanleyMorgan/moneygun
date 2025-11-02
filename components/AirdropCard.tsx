import React, { useState, useEffect } from 'react';
import { Airdrop, AirdropStatus, AirdropType } from '../types';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
// Fix: Import `BaseError` for proper error handling.
import { parseEther, formatEther, getAddress, BaseError } from 'viem';
import { baseSepolia } from 'viem/chains';

interface AirdropCardProps {
  airdrop: Airdrop;
}

// --- Contract ABIs ---
const AirdropABI = [
  {"inputs":[{"internalType":"contract IERC20","name":"_token","type":"address"},{"internalType":"address","name":"_owner","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},
  {"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},
  {"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},
  {"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"SafeERC20FailedOperation","type":"error"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Claimed","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Funded","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes32","name":"newRoot","type":"bytes32"}],"name":"MerkleRootUpdated","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},
  {"inputs":[],"name":"balance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes32[]","name":"proof","type":"bytes32[]"}],"name":"claim","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"claimed","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"claimedCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes32[]","name":"proof","type":"bytes32[]"}],"name":"eligible","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"emergencyWithdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"fund","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"merkleRoot","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"bytes32","name":"_root","type":"bytes32"}],"name":"setMerkleRoot","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"token","outputs":[{"internalType":"contract IERC20","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}
];


// --- Helper Functions ---

export const getComputedStatus = (airdrop: Airdrop): AirdropStatus => {
  if (airdrop.status === AirdropStatus.Failed) return AirdropStatus.Failed;
  const now = Date.now();
  const startTime = airdrop.startTime?.getTime();
  const endTime = airdrop.endTime?.getTime();
  if (!startTime) return AirdropStatus.Draft;
  if (now < startTime) return AirdropStatus.Draft;
  if (endTime && now > endTime) return AirdropStatus.Completed;
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

const formatDate = (date?: Date) => {
  if (!date) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

const formatAddress = (address: string) => {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// --- AirdropCard Component ---

const AirdropCard: React.FC<AirdropCardProps> = ({ airdrop }) => {
  const { address } = useAccount();
  const { data: hash, writeContract, isPending, error: claimError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });
  
  const [claimStatus, setClaimStatus] = useState<'idle' | 'fetching' | 'claiming' | 'confirmed' | 'error'>('idle');
  const [claimMessage, setClaimMessage] = useState('');

  const computedStatus = getComputedStatus(airdrop);
  const isClaimable = computedStatus === AirdropStatus.InProgress;
  const isCreator = address && airdrop.creatorAddress && getAddress(address) === getAddress(airdrop.creatorAddress);

  // --- Read Contract Data ---
  const { data: contractBalance } = useReadContract({
    address: airdrop.contractAddress as `0x${string}` | undefined,
    abi: AirdropABI,
    functionName: 'balance',
    chainId: baseSepolia.id,
    query: { enabled: !!airdrop.contractAddress }
  });

  const { data: claimedCount } = useReadContract({
    address: airdrop.contractAddress as `0x${string}` | undefined,
    abi: AirdropABI,
    functionName: 'claimedCount',
    chainId: baseSepolia.id,
    query: { enabled: !!airdrop.contractAddress }
  });

  useEffect(() => {
    if (isPending || isConfirming) {
      setClaimStatus('claiming');
    } else if (isConfirmed) {
      setClaimStatus('confirmed');
      setClaimMessage('Claim successful! Updating status...');
      // Notify backend that the claim was successful
      fetch('/api/airdrops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateClaim',
          airdropId: airdrop.id,
          userAddress: address,
        }),
      }).then(res => {
          if (res.ok) {
            setClaimMessage('Claim successful!');
          } else {
            setClaimMessage('Claim successful! (Failed to update DB status)');
          }
      }).catch(() => {
        setClaimMessage('Claim successful! (Failed to contact server)');
      });

    } else if (claimError) {
      setClaimStatus('error');
      setClaimMessage(claimError instanceof BaseError ? claimError.shortMessage : claimError.message || 'Claim failed.');
    }
  }, [isPending, isConfirming, isConfirmed, claimError, airdrop.id, address]);


  const handleClaim = async () => {
    if (!address || !airdrop.contractAddress) {
        alert("Please connect your wallet.");
        return;
    }

    setClaimStatus('fetching');
    setClaimMessage('Fetching eligibility...');

    try {
        const res = await fetch(`/api/airdrops?airdropId=${airdrop.id}&userAddress=${address}`);
        if (!res.ok) throw new Error('Could not verify eligibility.');
        
        const { amount, proof } = await res.json();
        if (!proof || amount === undefined) throw new Error('You are not on the whitelist.');
        
        const decimals = airdrop.tokenDecimals || 18;
        const amountInBaseUnit = parseEther(String(amount)); // Assumes 18 decimals, should be more robust

        setClaimMessage('Please confirm transaction...');
        // Fix: Pass `chain` and `account` to `writeContract` as required by wagmi v2, and remove deprecated `chainId`.
        // The new ABI's `claim` function does not require the recipient's address.
        writeContract({
            address: airdrop.contractAddress as `0x${string}`,
            abi: AirdropABI,
            functionName: 'claim',
            args: [amountInBaseUnit, proof],
            chain: baseSepolia,
            account: address,
        });

    } catch (err) {
        setClaimStatus('error');
        setClaimMessage(err instanceof Error ? err.message : "An unknown error occurred.");
    }
  };

  const renderClaimButton = () => {
    const baseClasses = "px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2";
    const isDisabled = !isClaimable || claimStatus === 'claiming' || claimStatus === 'confirmed';

    let label = 'Claim';
    if(claimStatus === 'claiming') label = 'Claiming...';
    if(claimStatus === 'confirmed') label = 'Claimed';

    if (airdrop.type !== AirdropType.Whitelist) {
       return <button disabled className={`${baseClasses} bg-slate-200 text-slate-500 cursor-not-allowed`}>Quest Claim</button>;
    }

    return (
      <div>
        <button onClick={handleClaim} disabled={isDisabled} className={`${baseClasses} ${isDisabled ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'text-white bg-purple-600 hover:bg-purple-700'}`}>
          {label}
        </button>
        {claimMessage && <p className={`text-xs mt-1 ${claimStatus === 'error' ? 'text-red-500' : 'text-slate-500'}`}>{claimMessage}</p>}
      </div>
    );
  };
  
  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("Address copied to clipboard!");
    }, (err) => {
      console.error('Could not copy text: ', err);
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-grow min-w-0">
          <h2 className="text-sm font-semibold text-slate-800 truncate" title={airdrop.name}>{airdrop.name}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Up to {new Intl.NumberFormat().format(airdrop.totalAmount)}
            <span className="font-semibold text-slate-700"> ${airdrop.tokenSymbol} </span> 
            on <span className="font-medium text-slate-700">{airdrop.network}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {renderClaimButton()}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
        {/* Details Section */}
        <div className="space-y-2 text-xs">
          {airdrop.description && (
            <p className="line-clamp-3 text-slate-600" title={airdrop.description}>{airdrop.description}</p>
          )}
          {airdrop.startTime && (
            <p className="text-slate-600">
              <span className="text-slate-400 mr-1.5">Time:</span>
              {`${formatDate(airdrop.startTime)} - ${formatDate(airdrop.endTime)}`}
            </p>
          )}
           {airdrop.contractAddress && (
            <p className="text-slate-600">
              <span className="text-slate-400 mr-1.5">Contract:</span>
              <span className="font-mono">{formatAddress(airdrop.contractAddress)}</span>
            </p>
          )}
        </div>

        {/* On-chain data section */}
        {airdrop.contractAddress && (
            <div className="bg-slate-50 p-2 rounded-md text-xs text-slate-700 grid grid-cols-2 gap-2">
                <div>
                    <div className="font-medium">Balance</div>
                    <div>{contractBalance !== undefined ? `${formatEther(contractBalance as bigint)} ${airdrop.tokenSymbol}` : 'Loading...'}</div>
                </div>
                <div>
                    <div className="font-medium">Claims</div>
                    <div>{claimedCount !== undefined ? `${claimedCount.toString()} / ${airdrop.recipientCount}` : 'Loading...'}</div>
                </div>
            </div>
        )}
        
        {/* Creator Actions */}
        {isCreator && airdrop.contractAddress && (
          <div className="bg-purple-50 p-2 rounded-md text-xs">
            <h4 className="font-semibold text-purple-800 mb-1">Creator Panel</h4>
            <p className="text-purple-700 mb-2">Fund this contract by sending {airdrop.tokenSymbol} to the address below:</p>
            <div className="flex items-center gap-2">
              <input type="text" readOnly value={airdrop.contractAddress} className="w-full bg-white font-mono text-xs px-2 py-1 border border-purple-200 rounded-md"/>
              <button onClick={() => handleCopyToClipboard(airdrop.contractAddress!)} className="px-2 py-1 font-medium bg-purple-600 text-white rounded-md hover:bg-purple-700">Copy</button>
            </div>
          </div>
        )}

        {/* Tags and Action Button */}
        <div className="flex justify-between items-center pt-2">
            <div className="flex items-center gap-2">
                <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[computedStatus]}`}>{computedStatus}</div>
                <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[airdrop.type]}`}>{airdrop.type}</div>
            </div>
            {airdrop.action && (
                <a href={airdrop.action.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50">{airdrop.action.text}</a>
            )}
        </div>
      </div>
    </div>
  );
};

export default AirdropCard;