

import React, { useState, useMemo, useEffect } from 'react';
import { Airdrop, AirdropStatus, AirdropType, WhitelistEntry } from '../types';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { baseSepolia } from 'viem/chains';
import { decodeEventLog, Hex, keccak256, toHex, BaseError } from 'viem';

interface NewAirdropFormProps {
  onAddAirdrop: (airdrop: Omit<Airdrop, 'id' | 'createdAt' | 'recipientCount' | 'creatorAddress'> & { whitelist?: WhitelistEntry[], contractAddress?: string, merkleRoot?: string }) => void;
  onBack: () => void;
}

// --- CONSTANTS & ABI ---
const AIRDROP_FACTORY_ADDRESS: Hex = '0x942253e6A252Dc4193851b32A24783358a55428B'; // Deployed on Base Sepolia for this app
const AirdropFactoryABI = [
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"airdrop","type":"address"},{"indexed":true,"internalType":"address","name":"token","type":"address"},{"indexed":true,"internalType":"address","name":"owner","type":"address"}],"name":"AirdropCreated","type":"event"},
  {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"allAirdrops","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"count","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"address","name":"owner","type":"address"}],"name":"createAirdrop","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"getAllAirdrops","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"}
];

const AirdropABI = [
  {"inputs":[{"internalType":"bytes32","name":"_root","type":"bytes32"}],"name":"setMerkleRoot","outputs":[],"stateMutability":"nonpayable","type":"function"}
];

const MAX_DESC_LENGTH = 140;
const tokensByNetwork: { [key: string]: { symbol: string; address: `0x${string}`; decimals: number }[] } = {
  'Base': [
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18 }
  ],
  'Base Sepolia': [
    { symbol: 'USDC', address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', decimals: 6 },
    { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18 }
  ]
};

type CreationStatus = 'idle' | 'generating_proof' | 'creating_contract' | 'waiting_for_creation' | 'setting_merkle_root' | 'waiting_for_merkle' | 'saving' | 'error' | 'success';

const NewAirdropForm: React.FC<NewAirdropFormProps> = ({ onAddAirdrop, onBack }) => {
  const { address, chain } = useAccount();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [network, setNetwork] = useState('Base Sepolia');
  const [tokenAddress, setTokenAddress] = useState<string>(tokensByNetwork['Base Sepolia'][0].address);
  const [tokenSymbol, setTokenSymbol] = useState<string | undefined>(tokensByNetwork['Base Sepolia'][0].symbol);
  const [tokenDecimals, setTokenDecimals] = useState<number | undefined>(tokensByNetwork['Base Sepolia'][0].decimals);
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [airdropType, setAirdropType] = useState<AirdropType>(AirdropType.Whitelist);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([{ address: '', amount: '' }]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [timeError, setTimeError] = useState('');

  // Creation process state
  const [status, setStatus] = useState<CreationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [newContractAddress, setNewContractAddress] = useState<Hex | null>(null);
  const [merkleRootForSaving, setMerkleRootForSaving] = useState<Hex | null>(null);


  // Wagmi hooks
  const { data: createTxHash, writeContract: createAirdrop, error: createAirdropError, reset: resetCreate } = useWriteContract();
  const { data: setMerkleTxHash, writeContract: setMerkleRoot, error: setMerkleRootError, reset: resetSetMerkle } = useWriteContract();

  const { data: creationReceipt, isSuccess: isCreationSuccess } = useWaitForTransactionReceipt({ hash: createTxHash });
  const { isSuccess: isMerkleSuccess } = useWaitForTransactionReceipt({ hash: setMerkleTxHash });

  // --- Multi-step transaction flow using useEffect ---

  // Step 2: After the contract is created, set the merkle root
  useEffect(() => {
    if (isCreationSuccess && creationReceipt && merkleRootForSaving && address) {
      setStatus('waiting_for_creation');
      const airdropCreatedLog = creationReceipt.logs.find(
        (log: any) => log.topics[0] === keccak256(toHex('AirdropCreated(address,address,address)'))
      );

      if (airdropCreatedLog) {
        const decodedLog = decodeEventLog({ abi: AirdropFactoryABI, eventName: 'AirdropCreated', data: airdropCreatedLog.data as Hex, topics: airdropCreatedLog.topics as any });
        const newAddress = (decodedLog.args as any).airdrop as Hex;
        setNewContractAddress(newAddress); // Save address for the final step

        setStatus('setting_merkle_root');
        setMerkleRoot({
          address: newAddress,
          abi: AirdropABI,
          functionName: 'setMerkleRoot',
          args: [merkleRootForSaving],
          chain: baseSepolia,
          account: address
        });
      } else {
        setStatus('error');
        setErrorMessage('Could not find AirdropCreated event log.');
      }
    }
  }, [isCreationSuccess, creationReceipt, merkleRootForSaving, address, setMerkleRoot]);

  // Step 3: After the merkle root is set, save everything to the database
  useEffect(() => {
    if (isMerkleSuccess && newContractAddress && merkleRootForSaving) {
      setStatus('saving');
      onAddAirdrop({
        name, description: description || undefined,
        action: link ? { text: "Link", url: link } : undefined,
        type: airdropType, tokenAddress, tokenSymbol, tokenDecimals,
        network: network, totalAmount: Number(totalAmount),
        status: AirdropStatus.Draft,
        startTime: new Date(startTime), endTime: new Date(endTime),
        whitelist: airdropType === AirdropType.Whitelist ? whitelist : undefined,
        contractAddress: newContractAddress,
        merkleRoot: merkleRootForSaving,
      });
      setStatus('success');
    }
  }, [isMerkleSuccess, newContractAddress, merkleRootForSaving]);

  // Handle errors from either transaction
  useEffect(() => {
    const contractError = createAirdropError || setMerkleRootError;
    if (contractError) {
      setStatus('error');
      setErrorMessage(contractError instanceof BaseError ? contractError.shortMessage : 'An unexpected error occurred.');
    }
  }, [createAirdropError, setMerkleRootError]);


  // Step 1: Handle form submission and kick off the process
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !address) {
      alert('Please fill out all fields correctly and connect your wallet.');
      return;
    }
    if (chain?.id !== baseSepolia.id) {
        alert('Please switch to Base Sepolia network to create an airdrop.');
        return;
    }

    setErrorMessage('');
    resetCreate();
    resetSetMerkle();
    setNewContractAddress(null);
    setMerkleRootForSaving(null);

    try {
      if (airdropType === AirdropType.Whitelist) {
        setStatus('generating_proof');
        const merkleRes = await fetch('/api/airdrops', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'generateMerkle', whitelist, tokenDecimals }),
        });
        if (!merkleRes.ok) throw new Error('Failed to generate Merkle proof.');
        const { merkleRoot } = await merkleRes.json();
        setMerkleRootForSaving(merkleRoot); // Store merkle root to be used in the useEffect chain

        setStatus('creating_contract');
        createAirdrop({
            address: AIRDROP_FACTORY_ADDRESS,
            abi: AirdropFactoryABI,
            functionName: 'createAirdrop',
            args: [tokenAddress as Hex, address as Hex],
            chain: baseSepolia,
            account: address
        });
        // The rest of the flow is now handled by the useEffect hooks
      } else {
        alert("Quest airdrops are not yet implemented with on-chain creation.");
        return;
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'An unexpected error occurred during setup.');
    }
  };
  
  const statusMessages: { [key in CreationStatus]: string } = {
    idle: 'Create Airdrop',
    generating_proof: 'Generating proof...',
    creating_contract: 'Check wallet to create contract...',
    waiting_for_creation: 'Creating contract on-chain...',
    setting_merkle_root: 'Check wallet to set proof...',
    waiting_for_merkle: 'Setting proof on-chain...',
    saving: 'Saving airdrop...',
    success: 'Airdrop Created!',
    error: 'Try Again'
  };


  // --- FORM UTILS (UNCHANGED) ---
  useEffect(() => {
    const availableTokens = tokensByNetwork[network];
    if (availableTokens && availableTokens.length > 0) {
      setTokenAddress(availableTokens[0].address); setTokenSymbol(availableTokens[0].symbol); setTokenDecimals(availableTokens[0].decimals);
    } else {
      setTokenAddress(''); setTokenSymbol(undefined); setTokenDecimals(undefined);
    }
  }, [network]);

  const handleLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value; setLink(url);
    if (url && !url.startsWith('https://farcaster.xyz')) { setLinkError('Link must start with https://farcaster.xyz'); } else { setLinkError(''); }
  };
  const handleTimeChange = (field: 'start' | 'end', value: string) => {
    const currentStart = field === 'start' ? value : startTime; const currentEnd = field === 'end' ? value : endTime;
    if (field === 'start') setStartTime(value); if (field === 'end') setEndTime(value);
    if (currentStart && currentEnd && new Date(currentEnd) <= new Date(currentStart)) { setTimeError('End time must be after start time.'); } else { setTimeError(''); }
  };
  const handleWhitelistChange = (index: number, field: keyof WhitelistEntry, value: string) => {
    const updatedWhitelist = [...whitelist]; updatedWhitelist[index][field] = value; setWhitelist(updatedWhitelist);
  };
  const addWhitelistRow = () => { setWhitelist([...whitelist, { address: '', amount: '' }]); };
  const removeWhitelistRow = (index: number) => { if (whitelist.length > 1) { setWhitelist(whitelist.filter((_, i) => i !== index)); } };
  const handleTokenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedToken = tokensByNetwork[network].find(t => t.address === e.target.value);
    if (selectedToken) { setTokenAddress(selectedToken.address); setTokenSymbol(selectedToken.symbol); setTokenDecimals(selectedToken.decimals); }
  };
  const whitelistTotal = useMemo(() => whitelist.reduce((sum, row) => sum + (Number(row.amount) || 0), 0), [whitelist]);
  const isWhitelistSumValid = useMemo(() => Math.abs(whitelistTotal - (Number(totalAmount) || 0)) < 1e-9, [totalAmount, whitelistTotal]);
  const isWhitelistDataValid = useMemo(() => whitelist.every(row => row.address.trim() !== '' && Number(row.amount) > 0), [whitelist]);
  const isFormValid = useMemo(() => {
    const baseValid = name && tokenAddress && Number(totalAmount) > 0 && !linkError && startTime && endTime && !timeError;
    if (!baseValid) return false;
    if (airdropType === AirdropType.Whitelist) return isWhitelistSumValid && isWhitelistDataValid;
    return true;
  }, [name, tokenAddress, totalAmount, linkError, startTime, endTime, timeError, airdropType, isWhitelistSumValid, isWhitelistDataValid]);

  const isProcessRunning = status !== 'idle' && status !== 'error' && status !== 'success';

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
       <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
            <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold text-slate-800">New Airdrop</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 text-sm">
        <fieldset disabled={isProcessRunning}>
            {/* Basic Info */}
            <div>
              <label htmlFor="name" className="block text-xs font-medium text-slate-600 mb-1">Airdrop Name</label>
              <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Early $DEGEN Casters" className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" required />
            </div>
            <div>
                <label htmlFor="description" className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Briefly describe your airdrop and its eligibility criteria." rows={3} maxLength={MAX_DESC_LENGTH} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
                <p className="text-xs text-right text-slate-400 mt-1">{description.length}/{MAX_DESC_LENGTH}</p>
            </div>
            <div>
                <label htmlFor="link" className="block text-xs font-medium text-slate-600 mb-1">Link (Optional)</label>
                <input type="url" id="link" value={link} onChange={handleLinkChange} placeholder="https://farcaster.xyz/..." className={`w-full px-3 py-1.5 bg-white border ${linkError ? 'border-red-500' : 'border-slate-300'} rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500`} />
                {linkError && <p className="text-xs text-red-500 mt-1">{linkError}</p>}
            </div>
            <div className="space-y-4">
                <div>
                  <label htmlFor="network" className="block text-xs font-medium text-slate-600 mb-1">Network</label>
                  <select id="network" value={network} onChange={(e) => setNetwork(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500">
                      {Object.keys(tokensByNetwork).map((net) => ( <option key={net} value={net}>{net}</option> ))}
                  </select>
                </div>
                <div>
                    <label htmlFor="rewardsToken" className="block text-xs font-medium text-slate-600 mb-1">Rewards token</label>
                    <select id="rewardsToken" value={tokenAddress} onChange={handleTokenChange} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500">
                        {(tokensByNetwork[network] || []).map((token) => ( <option key={token.address} value={token.address}>{token.symbol}</option> ))}
                    </select>
                </div>
                <div>
                  <label htmlFor="totalAmount" className="block text-xs font-medium text-slate-600 mb-1">Total Airdrop Amount {tokenSymbol ? `(in ${tokenSymbol})` : ''}</label>
                  <input type="number" id="totalAmount" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g., 1000000" min="0" step="any" className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" required />
                </div>
            </div>
            {/* Time Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startTime" className="block text-xs font-medium text-slate-600 mb-1">Start Time (UTC)</label>
                <input type="datetime-local" id="startTime" value={startTime} onChange={(e) => handleTimeChange('start', e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" required />
              </div>
              <div>
                <label htmlFor="endTime" className="block text-xs font-medium text-slate-600 mb-1">End Time (UTC)</label>
                <input type="datetime-local" id="endTime" value={endTime} onChange={(e) => handleTimeChange('end', e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" required />
              </div>
              {timeError && <p className="text-xs text-red-500 mt-1 md:col-span-2">{timeError}</p>}
            </div>
            {/* Airdrop Type Toggle */}
            <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Airdrop Type</label>
                <div className="flex gap-2">
                     <button type="button" onClick={() => setAirdropType(AirdropType.Whitelist)} className={`px-3 py-1.5 text-xs font-medium rounded-md border text-center transition-colors w-full ${airdropType === AirdropType.Whitelist ? 'bg-purple-50 text-purple-700 border-purple-300 ring-1 ring-purple-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Whitelist</button>
                     <button type="button" onClick={() => setAirdropType(AirdropType.Quest)} className={`px-3 py-1.5 text-xs font-medium rounded-md border text-center transition-colors w-full ${airdropType === AirdropType.Quest ? 'bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Quest</button>
                </div>
                 <p className="text-xs text-slate-500 mt-1.5 px-1">{airdropType === AirdropType.Whitelist ? 'Users can claim tokens directly if they are on the list.' : 'Users must complete a task to be eligible for the reward.'}</p>
            </div>
            {/* Conditional UI */}
            {airdropType === AirdropType.Whitelist && (
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Recipients & Amounts</label>
                    <div className="space-y-2">
                        {whitelist.map((row, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input type="text" value={row.address} onChange={(e) => handleWhitelistChange(index, 'address', e.target.value)} placeholder="0x... or ENS" className="w-2/3 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono" />
                                <input type="number" value={row.amount} onChange={(e) => handleWhitelistChange(index, 'amount', e.target.value)} placeholder="Amount" min="0" step="any" className="w-1/3 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500" />
                                <button type="button" onClick={() => removeWhitelistRow(index)} className={`p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500 ${whitelist.length <= 1 && 'opacity-50 cursor-not-allowed'}`} disabled={whitelist.length <= 1}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                    <button type="button" onClick={addWhitelistRow} className="mt-2 text-xs font-medium text-purple-600 hover:text-purple-800">+ Add Row</button>
                    <div className={`mt-3 p-2 rounded-md text-xs border ${isWhitelistSumValid ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                        <div className="flex justify-between"><span>Total in table:</span> <span className="font-mono">{whitelistTotal.toLocaleString()}</span></div>
                        <div className="flex justify-between mt-1"><span>Required total:</span> <span className="font-mono">{(Number(totalAmount) || 0).toLocaleString()}</span></div>
                    </div>
                </div>
            )}
        </fieldset>

        <div className="pt-3 flex flex-col items-end">
            <button type="submit" disabled={!isFormValid || isProcessRunning} className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed w-full sm:w-auto">
                {statusMessages[status]}
            </button>
            {errorMessage && <p className="text-xs text-red-500 mt-2 text-right">{errorMessage}</p>}
        </div>
      </form>
    </div>
  );
};

export default NewAirdropForm;