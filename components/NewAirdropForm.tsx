import React, { useState, useEffect } from 'react';
import { Airdrop, AirdropType, AirdropStatus, WhitelistEntry } from '../types';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import Papa from 'papaparse';
import { getAddress, isAddress, parseEventLogs } from 'viem';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { airdropFactoryABI, airdropABI, questAirdropFactoryABI } from '../lib/abi';
import { base, baseSepolia } from 'wagmi/chains';
import { getVerifierAddress } from '../lib/api';

// Contract Addresses
const AIRDROP_FACTORY_ADDRESSES: Record<string, `0x${string}`> = {
  'base-sepolia': getAddress('0x6cd36B7DfCdB024CACc4D57Bbc7F3F0dB6af7Ab2'),
  'base': getAddress('0x6cd36B7DfCdB024CACc4D57Bbc7F3F0dB6af7Ab2'), // Placeholder, likely needs a mainnet address
  'monad-testnet': getAddress('0x347319746dc15b955eef0388e73ef2a5973d6703'),
};

const QUEST_AIRDROP_FACTORY_ADDRESSES: Record<string, `0x${string}`> = {
  'base-sepolia': getAddress('0xc9EB956B089680bB3BB2C665DeDE4A9B2CdC8C64'),
  'base': getAddress('0xc9EB956B089680bB3BB2C665DeDE4A9B2CdC8C64'), // Placeholder, likely needs a mainnet address
  'monad-testnet': getAddress('0x24a56e0603e3f6d8458c5030d2c5ff09e3e5c451'),
};


const chainIdMap: Record<string, number> = {
  'base-sepolia': baseSepolia.id,
  'base': base.id,
  'monad-testnet': 10143,
};

const SUPPORTED_NETWORKS: { id: string; name: string; iconUrl: string }[] = [
  { id: 'base-sepolia', name: 'Base Sepolia', iconUrl: 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/chain/base/base.svg' },
  { id: 'base', name: 'Base', iconUrl: 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/chain/base/base.svg' },
  { id: 'monad-testnet', name: 'Monad Testnet', iconUrl: 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/chain/monad/monad.svg' }
];

const SUPPORTED_TOKENS: Record<string, { symbol: string; address: `0x${string}`; decimals: number; iconUrl: string }[]> = {
  'base-sepolia': [
    { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18, iconUrl: 'https://raw.githubusercontent.com/StanleyMorgan/cryptoicons/76fae77d0876d5656f8916cc5b856ce86181eba8/SVG/eth.svg' },
    { symbol: 'USDC', address: '0x4b1a87123583b2E630152668a2c2fABb44b32F36', decimals: 18, iconUrl: 'https://raw.githubusercontent.com/StanleyMorgan/cryptoicons/76fae77d0876d5656f8916cc5b856ce86181eba8/SVG/usdc.svg' },
  ],
  'base': [
    { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18, iconUrl: 'https://raw.githubusercontent.com/StanleyMorgan/cryptoicons/76fae77d0876d5656f8916cc5b856ce86181eba8/SVG/eth.svg' },
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, iconUrl: 'https://raw.githubusercontent.com/StanleyMorgan/cryptoicons/76fae77d0876d5656f8916cc5b856ce86181eba8/SVG/usdc.svg' },
  ],
  'monad-testnet': [
    { symbol: 'USDC', address: '0xca81450762a8163f43740dfd8b49ebafc411dda6', decimals: 18, iconUrl: 'https://raw.githubusercontent.com/StanleyMorgan/cryptoicons/76fae77d0876d5656f8916cc5b856ce86181eba8/SVG/usdc.svg' },
  ],
};


interface NewAirdropFormProps {
  onAddAirdrop: (airdropData: Omit<Airdrop, 'id' | 'createdAt' | 'creatorAddress'>) => void;
  onBack: () => void;
}

type FormStatus = 'idle' | 'generatingMerkle' | 'creatingContract' | 'waitingForCreation' | 'settingMerkle' | 'waitingForMerkle' | 'saving' | 'success' | 'error';

const statusMessages: Record<FormStatus, string> = {
    idle: 'Create Airdrop',
    generatingMerkle: 'Generating proof...',
    creatingContract: 'Check wallet to create contract...',
    waitingForCreation: 'Deploying contract...',
    settingMerkle: 'Check wallet to set proof...',
    waitingForMerkle: 'Finalizing contract...',
    saving: 'Saving airdrop...',
    success: 'Airdrop Created!',
    error: 'Try Again',
};

const NewAirdropForm: React.FC<NewAirdropFormProps> = ({ onAddAirdrop, onBack }) => {
  const [airdropType, setAirdropType] = useState<AirdropType>(AirdropType.Whitelist);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [network, setNetwork] = useState('base-sepolia');
  const [selectedTokenAddress, setSelectedTokenAddress] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [whitelistCsv, setWhitelistCsv] = useState('');
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  
  // Quest-specific fields
  // Fix: Renamed `targetContractAddress` to `targetContract` to match the updated, more concise database schema.
  const [targetContract, setTargetContract] = useState('');
  const [topic0, setTopic0] = useState('');
  const [userTopicIndex, setUserTopicIndex] = useState<1 | 2 | 3>(2);
  const [fetchedVerifierAddress, setFetchedVerifierAddress] = useState<`0x${string}` | null>(null);
  const [recipientCount, setRecipientCount] = useState(0);
  const [maxReward, setMaxReward] = useState(0);

  const [totalAmount, setTotalAmount] = useState(0);
  const [error, setError] = useState('');
  
  const [status, setStatus] = useState<FormStatus>('idle');
  const [merkleRoot, setMerkleRoot] = useState<`0x${string}` | null>(null);
  const [newAirdropAddress, setNewAirdropAddress] = useState<`0x${string}` | null>(null);

  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  
  // Whitelist contract hooks
  const { data: createAirdropHash, writeContract: createAirdropContract, error: createError } = useWriteContract();
  const { data: setMerkleHash, writeContract: setMerkleContract, error: setMerkleError } = useWriteContract();
  const { isSuccess: isCreateSuccess, data: createReceipt } = useWaitForTransactionReceipt({ hash: createAirdropHash });
  const { isSuccess: isSetMerkleSuccess } = useWaitForTransactionReceipt({ hash: setMerkleHash });

  // Quest contract hooks
  const { data: createQuestHash, writeContract: createQuestContract, error: createQuestError } = useWriteContract();
  const { isSuccess: isCreateQuestSuccess, data: createQuestReceipt } = useWaitForTransactionReceipt({ hash: createQuestHash });

  
  const currentTokens = SUPPORTED_TOKENS[network] || [];
  const selectedToken = currentTokens.find(t => t.address === selectedTokenAddress);

  useEffect(() => {
    // Automatically switch to the default network on component mount if a wallet is connected
    if (isConnected && chain?.id !== chainIdMap[network] && switchChain) {
        switchChain({ chainId: chainIdMap[network] });
    }
  }, [isConnected, chain, network, switchChain]);
  
  useEffect(() => {
    if (airdropType === AirdropType.Quest && !fetchedVerifierAddress) {
      const fetchAddress = async () => {
        try {
          const address = await getVerifierAddress();
          setFetchedVerifierAddress(address);
        } catch (err) {
          console.error("Failed to fetch verifier address:", err);
          setError("Could not load verifier configuration. Please try again.");
        }
      };
      fetchAddress();
    }
  }, [airdropType, fetchedVerifierAddress]);

  useEffect(() => {
    // Calculate total amount based on type
    if (airdropType === AirdropType.Whitelist) {
      const newTotal = whitelist.reduce((sum, entry) => sum + Number(entry.amount), 0);
      setTotalAmount(newTotal);
    } else { // Quest
      setTotalAmount(recipientCount * maxReward);
    }
  }, [whitelist, recipientCount, maxReward, airdropType]);


  const handleNetworkSelect = (newNetwork: string) => {
      setNetwork(newNetwork);
      setSelectedTokenAddress(''); // Reset token selection on network change
      if (switchChain && chainIdMap[newNetwork]) {
          switchChain({ chainId: chainIdMap[newNetwork] });
      }
  };

  const handleWhitelistParse = () => {
    if (airdropType !== AirdropType.Whitelist || !whitelistCsv.trim()) {
      setWhitelist([]);
      setError('');
      return;
    }

    Papa.parse<string[]>(whitelistCsv, {
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
            const firstError = results.errors[0];
            if (firstError) {
                const lineInfo = firstError.row !== undefined ? `on line ${firstError.row + 1}` : 'in an unknown row';
                setError(`CSV parsing error ${lineInfo}: ${firstError.message}`);
            } else {
                setError('An unknown CSV parsing error occurred.');
            }
            setWhitelist([]);
            return;
        }
        
        const newWhitelist: WhitelistEntry[] = [];
        let parseError = '';

        for (const [index, row] of results.data.entries()) {
          const [address, amount] = row.map(v => v ? v.trim() : '');
          if (row.length !== 2 || !address || !amount) {
            parseError = `Error on line ${index + 1}: Each line must have two values: address,amount.`;
            break;
          }
          if (!isAddress(address)) {
            parseError = `Error on line ${index + 1}: Invalid address format "${address}".`;
            break;
          }
          const amountNum = Number(amount);
          if (isNaN(amountNum) || amountNum <= 0) {
            parseError = `Error on line ${index + 1}: Invalid amount "${amount}". Must be a positive number.`;
            break;
          }
          newWhitelist.push({ address: getAddress(address), amount: String(amountNum) });
        }

        if (parseError) {
          setError(parseError);
          setWhitelist([]);
        } else {
          setError('');
          setWhitelist(newWhitelist);
        }
      },
    });
  };

  const commonValidation = () => {
    if (!isConnected || !address) {
      setError("Please connect your wallet first.");
      return false;
    }
    if (!selectedToken) {
      setError('Please select a token.');
      return false;
    }
    if (!name || !description || !startTime || !endTime) {
      setError('Please fill all required fields.');
      return false;
    }
    if (name.length > 30) {
      setError('Name cannot exceed 30 characters.');
      return false;
    }
    if (description.length > 140) {
      setError('Description cannot exceed 140 characters.');
      return false;
    }
    return true;
  };

  const handleWhitelistSubmit = async () => {
    if (!commonValidation()) return;
    if (whitelist.length === 0) {
      setError('Whitelist cannot be empty.');
      return;
    }
    
    try {
        setStatus('generatingMerkle');
        const merkleResponse = await fetch('/api/airdrops', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'generateMerkle', whitelist, tokenDecimals: selectedToken!.decimals }),
        });
        if (!merkleResponse.ok) throw new Error('Failed to generate Merkle root.');
        const { merkleRoot: newMerkleRoot } = await merkleResponse.json();
        setMerkleRoot(newMerkleRoot);
        setStatus('creatingContract');
    } catch (err: any) {
        console.error("Whitelist creation process failed:", err);
        setError(err.message || 'An unknown error occurred.');
        setStatus('error');
    }
  };

  const handleQuestSubmit = async () => {
    if (!commonValidation()) return;
    if (!fetchedVerifierAddress) {
      setError('Verifier address could not be loaded. Please wait or refresh.');
      return;
    }
    if (!targetContract || !isAddress(targetContract)) {
      setError('Please provide a valid target contract address.');
      return;
    }
    if (!topic0.trim()) {
      setError('Please provide the event signature.');
      return;
    }
    if (recipientCount <= 0 || maxReward <= 0) {
      setError('Recipient count and reward must be greater than zero.');
      return;
    }
    
    try {
      setStatus('creatingContract');
      createQuestContract({
        address: QUEST_AIRDROP_FACTORY_ADDRESSES[network],
        abi: questAirdropFactoryABI,
        functionName: 'createQuestAirdrop',
        args: [getAddress(selectedToken!.address), address!, fetchedVerifierAddress],
        account: address,
        chain: chain,
      });
      setStatus('waitingForCreation');
    } catch (err: any) {
      console.error("Quest creation process failed:", err);
      setError(err.message || 'An unknown error occurred.');
      setStatus('error');
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('idle');
    if (airdropType === AirdropType.Whitelist) {
      await handleWhitelistSubmit();
    } else {
      await handleQuestSubmit();
    }
  };

  // Whitelist Effect: Create Airdrop Contract
  useEffect(() => {
    if (status === 'creatingContract' && airdropType === AirdropType.Whitelist && merkleRoot && address && chain && selectedToken) {
        createAirdropContract({
            address: AIRDROP_FACTORY_ADDRESSES[network],
            abi: airdropFactoryABI,
            functionName: 'createAirdrop',
            args: [getAddress(selectedToken.address), address],
            account: address,
            chain: chain,
        });
        setStatus('waitingForCreation');
    }
  }, [status, airdropType, merkleRoot, address, selectedToken, createAirdropContract, chain, network]);

  // Whitelist/Quest Effect: Parse contract address from logs
  useEffect(() => {
    const isWhitelist = airdropType === AirdropType.Whitelist;
    const receipt = isWhitelist ? createReceipt : createQuestReceipt;
    const isSuccess = isWhitelist ? isCreateSuccess : isCreateQuestSuccess;

    if (isSuccess && receipt) {
        try {
            // Fix: Split the logic to ensure TypeScript can correctly infer the log argument types.
            if (isWhitelist) {
                const logs = parseEventLogs({
                    abi: airdropFactoryABI,
                    logs: receipt.logs,
                    eventName: 'AirdropCreated',
                });
                if (logs.length === 0) throw new Error('AirdropCreated event not found.');
                
                const newAddress = logs[0].args.airdrop;
                if (!newAddress) throw new Error("Parsed log is missing the new contract address argument.");
                
                setNewAirdropAddress(newAddress);
                setStatus('settingMerkle');
            } else { // It's a Quest airdrop
                const logs = parseEventLogs({
                    abi: questAirdropFactoryABI,
                    logs: receipt.logs,
                    eventName: 'QuestAirdropCreated',
                });
                if (logs.length === 0) throw new Error('QuestAirdropCreated event not found.');
                
                const newAddress = logs[0].args.quest;
                if (!newAddress) throw new Error("Parsed log is missing the new contract address argument.");
                
                setNewAirdropAddress(newAddress);
                setStatus('saving');
            }
        } catch (err) {
            console.error('Failed to parse airdrop address from logs:', err);
            setError('Could not find new airdrop address in transaction logs.');
            setStatus('error');
        }
    }
  }, [isCreateSuccess, createReceipt, isCreateQuestSuccess, createQuestReceipt, airdropType]);


  // Whitelist Effect: Set Merkle Root
  useEffect(() => {
    if (status === 'settingMerkle' && airdropType === AirdropType.Whitelist && newAirdropAddress && merkleRoot && address && chain) {
        setMerkleContract({
            address: newAirdropAddress,
            abi: airdropABI,
            functionName: 'setMerkleRoot',
            args: [merkleRoot],
            account: address,
            chain: chain,
        });
        setStatus('waitingForMerkle');
    }
  }, [status, airdropType, newAirdropAddress, merkleRoot, setMerkleContract, address, chain]);

  // Whitelist Effect for final save (after Merkle is set)
  useEffect(() => {
    if (isSetMerkleSuccess && airdropType === AirdropType.Whitelist) {
      setStatus('saving');
    }
  }, [isSetMerkleSuccess, airdropType]);

  // Combined Save to DB Effect
  useEffect(() => {
    const saveAirdrop = async () => {
        if (status !== 'saving' || !newAirdropAddress || !selectedToken) return;

        try {
            let payload: Omit<Airdrop, 'id' | 'createdAt' | 'creatorAddress' | 'verifierAddress'> & { whitelist?: WhitelistEntry[] };

            if (airdropType === AirdropType.Whitelist) {
                payload = {
                    name, description, image, type: AirdropType.Whitelist,
                    tokenAddress: selectedToken.address, tokenSymbol: selectedToken.symbol, tokenDecimals: selectedToken.decimals,
                    network, totalAmount, status: AirdropStatus.Draft,
                    startTime: new Date(startTime), endTime: new Date(endTime),
                    whitelist, contractAddress: newAirdropAddress, merkleRoot: merkleRoot!,
                    recipientCount: whitelist.length,
                };
            } else { // Quest
                payload = {
                    name, description, image, type: AirdropType.Quest,
                    tokenAddress: selectedToken.address, tokenSymbol: selectedToken.symbol, tokenDecimals: selectedToken.decimals,
                    network, totalAmount, status: AirdropStatus.Draft,
                    startTime: new Date(startTime), endTime: new Date(endTime),
                    contractAddress: newAirdropAddress,
                    recipientCount: Number(recipientCount), maxReward: Number(maxReward),
                    targetContract: getAddress(targetContract),
                    topic0: topic0.trim(),
                    userTopicIndex: userTopicIndex,
                };
            }

            await onAddAirdrop(payload);
            setStatus('success');
        } catch (err: any) {
            console.error('Failed to save airdrop to DB:', err);
            setError(`On-chain actions succeeded, but failed to save to DB: ${err.message}`);
            setStatus('error');
        }
    };
    saveAirdrop();
  }, [status, newAirdropAddress, selectedToken, airdropType]);


  useEffect(() => {
      const anyError = createError || setMerkleError || createQuestError;
      if (anyError) {
          setError(`Transaction failed: ${anyError.message}`);
          setStatus('error');
      }
  }, [createError, setMerkleError, createQuestError]);

  const renderWhitelistFields = () => (
    <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-700">Whitelist</h2>
        <div>
            <label htmlFor="whitelist" className="block text-xs font-medium text-slate-600 mb-1">Recipients & Amounts (CSV)</label>
            <p className="text-xs text-slate-500 mb-2">Enter one recipient per line in the format: <code>address,amount</code></p>
            <textarea id="whitelist" value={whitelistCsv} onChange={e => setWhitelistCsv(e.target.value)} onBlur={handleWhitelistParse} rows={8} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono" placeholder="0x...,100&#10;0x...,250"/>
        </div>
        {whitelist.length > 0 && (
            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-md">
                <p><strong>Recipients:</strong> {whitelist.length}</p>
                <p><strong>Total Amount:</strong> {totalAmount.toLocaleString()} {selectedToken?.symbol || ''}</p>
            </div>
        )}
    </div>
  );

  const renderQuestFields = () => (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-slate-700">Quest Details</h2>
      <div>
          <label htmlFor="targetContract" className="block text-xs font-medium text-slate-600 mb-1">Target Contract Address</label>
           <p className="text-xs text-slate-500 mb-2">The contract address to monitor for quest events.</p>
          <input type="text" id="targetContract" value={targetContract} onChange={e => setTargetContract(e.target.value)} required className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono" placeholder="0x..."/>
      </div>
      <div>
          <label htmlFor="topic0" className="block text-xs font-medium text-slate-600 mb-1">Event Signature (topic0)</label>
          <p className="text-xs text-slate-500 mb-2">The event signature hash to track on-chain.</p>
          <input type="text" id="topic0" value={topic0} onChange={e => setTopic0(e.target.value)} required className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono" placeholder="0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"/>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">User Address Location</label>
        <p className="text-xs text-slate-500 mb-2">In which topic is the user's indexed address located?</p>
        <div className="flex flex-wrap gap-2 mt-2">
            {( [1, 2, 3] as const ).map(index => (
                <button
                    type="button"
                    key={index}
                    onClick={() => setUserTopicIndex(index)}
                    aria-pressed={userTopicIndex === index}
                    className={`px-3 py-1.5 border rounded-lg text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                        userTopicIndex === index
                            ? 'border-purple-600 bg-purple-50 text-slate-800'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                >
                    Topic {index}
                </button>
            ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
            <label htmlFor="recipientCount" className="block text-xs font-medium text-slate-600 mb-1">Max Recipients</label>
            <input type="number" id="recipientCount" value={recipientCount || ''} onChange={e => setRecipientCount(Number(e.target.value))} required className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"/>
        </div>
         <div>
            <label htmlFor="maxReward" className="block text-xs font-medium text-slate-600 mb-1">Reward Per Recipient</label>
            <input type="number" id="maxReward" value={maxReward || ''} onChange={e => setMaxReward(Number(e.target.value))} required className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"/>
        </div>
      </div>
      {totalAmount > 0 && (
          <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-md">
              <p><strong>Total Amount:</strong> {totalAmount.toLocaleString()} {selectedToken?.symbol || ''}</p>
          </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1 rounded-md hover:bg-slate-100">
          <ArrowLeftIcon className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-xl font-semibold text-slate-800">New Airdrop</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
        
        <div className="space-y-4">
            <h2 className="text-base font-semibold text-slate-700">Airdrop Details</h2>
            <div>
                <label htmlFor="name" className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} required maxLength={30} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                <p className="text-right text-xs text-slate-500 mt-1">{name.length} / 30</p>
            </div>
            <div>
                <label htmlFor="description" className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={3} required maxLength={140} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                <p className="text-right text-xs text-slate-500 mt-1">{description.length} / 140</p>
            </div>
            <div>
              <label htmlFor="image" className="block text-xs font-medium text-slate-600 mb-1">Airdrop Icon URL (Optional)</label>
              <div className="flex items-center gap-4">
                <input
                  type="url"
                  id="image"
                  value={image}
                  onChange={e => setImage(e.target.value)}
                  placeholder="https://.../icon.svg"
                  className="flex-grow px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <img
                  src={image || 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/app/moneygun/money.svg'}
                  alt="Airdrop icon preview"
                  className="w-12 h-12 rounded-lg object-cover bg-slate-100 flex-shrink-0"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src !== 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/app/moneygun/money.svg') {
                      target.src = 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/app/moneygun/money.svg';
                    }
                  }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Provide a URL to an SVG or image file. If blank, a default icon is used.</p>
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Airdrop Type</label>
                <div className="flex flex-wrap gap-2 mt-2">
                    <button
                        type="button"
                        onClick={() => setAirdropType(AirdropType.Whitelist)}
                        aria-pressed={airdropType === AirdropType.Whitelist}
                        className={`flex items-center justify-center gap-2 px-3 py-1.5 border rounded-lg text-left transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                            airdropType === AirdropType.Whitelist
                                ? 'border-purple-600 bg-purple-50'
                                : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
                        }`}
                    >
                        <span className="font-semibold text-sm text-slate-800">Whitelist</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setAirdropType(AirdropType.Quest)}
                        aria-pressed={airdropType === AirdropType.Quest}
                        className={`flex items-center justify-center gap-2 px-3 py-1.5 border rounded-lg text-left transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                            airdropType === AirdropType.Quest
                                ? 'border-purple-600 bg-purple-50'
                                : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
                        }`}
                    >
                        <span className="font-semibold text-sm text-slate-800">Quest</span>
                    </button>
                </div>
            </div>
        </div>
        <div className="space-y-4">
            <h2 className="text-base font-semibold text-slate-700">Token & Network</h2>
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Network</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {SUPPORTED_NETWORKS.map(net => (
                            <button
                                type="button"
                                key={net.id}
                                onClick={() => handleNetworkSelect(net.id)}
                                aria-pressed={network === net.id}
                                className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-left transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                                    network === net.id
                                        ? 'border-purple-600 bg-purple-50'
                                        : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
                                }`}
                            >
                                <img src={net.iconUrl} alt={`${net.name} logo`} className="w-5 h-5" />
                                <span className="font-semibold text-sm text-slate-800">{net.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Token</label>
                    {currentTokens.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {currentTokens.map(token => (
                                <button
                                    type="button"
                                    key={token.address}
                                    onClick={() => setSelectedTokenAddress(token.address)}
                                    aria-pressed={selectedTokenAddress === token.address}
                                    className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-left transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                                        selectedTokenAddress === token.address
                                            ? 'border-purple-600 bg-purple-50'
                                            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
                                    }`}
                                >
                                    <img src={token.iconUrl} alt={`${token.symbol} logo`} className="w-5 h-5" />
                                    <span className="font-semibold text-sm text-slate-800">{token.symbol}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                       <div className="mt-2 p-4 text-center border-2 border-dashed border-slate-200 rounded-lg">
                           <p className="text-xs text-slate-500">Select a network to see available tokens.</p>
                       </div>
                    )}
                </div>
            </div>
        </div>

        {airdropType === AirdropType.Whitelist ? renderWhitelistFields() : renderQuestFields()}

        <div className="space-y-4">
            <h2 className="text-base font-semibold text-slate-700">Schedule</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="startTime" className="block text-xs font-medium text-slate-600 mb-1">Start Time (UTC)</label>
                    <input type="datetime-local" id="startTime" value={startTime} onChange={e => setStartTime(e.target.value)} required className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                </div>
                <div>
                    <label htmlFor="endTime" className="block text-xs font-medium text-slate-600 mb-1">End Time (UTC)</label>
                    <input type="datetime-local" id="endTime" value={endTime} onChange={e => setEndTime(e.target.value)} required className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                </div>
            </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end pt-4">
            <button 
              type="submit" 
              className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed"
              disabled={status !== 'idle' && status !== 'error'}
            >
              {statusMessages[status]}
            </button>
        </div>
      </form>
    </div>
  );
};

export default NewAirdropForm;