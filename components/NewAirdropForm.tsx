import React, { useState, useEffect } from 'react';
import { Airdrop, AirdropType, AirdropStatus, WhitelistEntry, Network, Token } from '../types';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import Papa from 'papaparse';
import { getAddress, isAddress, parseEventLogs } from 'viem';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { airdropFactoryABI, airdropABI, questAirdropFactoryABI } from '../lib/abi';
import * as api from '../lib/api';

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
  const [action, setAction] = useState('');
  
  const [networks, setNetworks] = useState<Network[]>([]);
  const [network, setNetwork] = useState('');
  
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [selectedTokenAddress, setSelectedTokenAddress] = useState('');
  
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [whitelistCsv, setWhitelistCsv] = useState('');
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  
  // Quest-specific fields
  const [targetContract, setTargetContract] = useState('');
  const [topic0, setTopic0] = useState('');
  const [userTopicIndex, setUserTopicIndex] = useState<1 | 2 | 3>(1);
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

  const selectedToken = tokens.find(t => t.contractAddress === selectedTokenAddress);
  const selectedNetwork = networks.find(n => n.networkKey === network);
  
  // Effect 1: Fetch networks and set initial state ONCE.
  useEffect(() => {
    const fetchAndSetInitialNetwork = async () => {
      try {
        const nets = await api.getNetworks();
        setNetworks(nets);
        if (nets.length > 0) {
          // Check if the currently connected chain is one of the supported ones
          const connectedNetwork = isConnected && chain ? nets.find(n => n.chainId === chain.id) : undefined;
          
          if (connectedNetwork) {
            // If wallet is connected to a supported network, sync the form to it.
            setNetwork(connectedNetwork.networkKey);
          } else {
            // Otherwise, default to the first network in the list (Base).
            setNetwork(nets[0].networkKey);
          }
        }
      } catch (error) {
        console.error("Failed to fetch networks", error);
        setError("Could not load network configurations. Please refresh.");
      }
    };
    fetchAndSetInitialNetwork();
  }, []); // <-- Empty dependency array means this runs only once on mount.

  // Effect 2: Sync form state when the wallet's chain changes.
  useEffect(() => {
    if (isConnected && chain && networks.length > 0) {
        const currentNetworkInWallet = networks.find(n => n.chainId === chain.id);
        if (currentNetworkInWallet && currentNetworkInWallet.networkKey !== network) {
            setNetwork(currentNetworkInWallet.networkKey);
        }
    }
  }, [chain, isConnected, networks]);


  useEffect(() => {
    if (!network) {
        setTokens([]);
        return;
    }
    const fetchTokens = async () => {
        setIsLoadingTokens(true);
        setSelectedTokenAddress(''); // Reset selection
        try {
            const fetchedTokens = await api.getTokens(network);
            setTokens(fetchedTokens);
        } catch (err) {
            console.error(`Failed to fetch tokens for ${network}:`, err);
            setError('Could not load tokens for the selected network.');
            setTokens([]);
        } finally {
            setIsLoadingTokens(false);
        }
    };
    fetchTokens();
  }, [network]);

  useEffect(() => {
    if (airdropType === AirdropType.Quest && !fetchedVerifierAddress) {
      const fetchAddress = async () => {
        try {
          const address = await api.getVerifierAddress();
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
    if (airdropType === AirdropType.Whitelist) {
      const newTotal = whitelist.reduce((sum, entry) => sum + Number(entry.amount), 0);
      setTotalAmount(newTotal);
    } else {
      setTotalAmount(recipientCount * maxReward);
    }
  }, [whitelist, recipientCount, maxReward, airdropType]);

  const handleNetworkSelect = (newNetworkKey: string) => {
      setNetwork(newNetworkKey);
      const selectedNet = networks.find(n => n.networkKey === newNetworkKey);
      if (switchChain && selectedNet) {
          switchChain({ chainId: selectedNet.chainId });
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
    if (!selectedToken || !selectedNetwork) {
      setError('Please select a token and network.');
      return false;
    }
    if (chain?.id !== selectedNetwork.chainId) {
        setError(`Please switch your wallet to the ${selectedNetwork.name} network.`);
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
    if (action && !action.startsWith('https://farcaster.xyz/') && !action.startsWith('https://base.app/')) {
      setError('Action URL must be a valid farcaster.xyz or base.app link.');
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
        address: selectedNetwork!.questFactoryAddress,
        abi: questAirdropFactoryABI,
        functionName: 'createQuestAirdrop',
        args: [getAddress(selectedToken!.contractAddress), address!, fetchedVerifierAddress],
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
    if (status === 'creatingContract' && airdropType === AirdropType.Whitelist && merkleRoot && address && chain && selectedToken && selectedNetwork) {
        createAirdropContract({
            address: selectedNetwork.whitelistFactoryAddress,
            abi: airdropFactoryABI,
            functionName: 'createAirdrop',
            args: [getAddress(selectedToken.contractAddress), address],
            account: address,
            chain: chain,
        });
        setStatus('waitingForCreation');
    }
  }, [status, airdropType, merkleRoot, address, selectedToken, createAirdropContract, chain, selectedNetwork]);

  // Whitelist/Quest Effect: Parse contract address from logs
  useEffect(() => {
    const isWhitelist = airdropType === AirdropType.Whitelist;
    const receipt = isWhitelist ? createReceipt : createQuestReceipt;
    const isSuccess = isWhitelist ? isCreateSuccess : isCreateQuestSuccess;

    if (isSuccess && receipt) {
        try {
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
                const whitelistMaxReward = whitelist.reduce((max, entry) => Math.max(max, Number(entry.amount)), 0);
                payload = {
                    name, description, image, action, type: AirdropType.Whitelist,
                    tokenAddress: selectedToken.contractAddress, tokenSymbol: selectedToken.symbol, tokenDecimals: selectedToken.decimals,
                    network, totalAmount, status: AirdropStatus.Draft,
                    startTime: new Date(startTime), endTime: new Date(endTime),
                    whitelist, contractAddress: newAirdropAddress, merkleRoot: merkleRoot!,
                    recipientCount: whitelist.length,
                    maxReward: whitelistMaxReward,
                };
            } else { // Quest
                payload = {
                    name, description, image, action, type: AirdropType.Quest,
                    tokenAddress: selectedToken.contractAddress, tokenSymbol: selectedToken.symbol, tokenDecimals: selectedToken.decimals,
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
  }, [status, newAirdropAddress, selectedToken, airdropType, action, description, endTime, image, maxReward, merkleRoot, name, network, onAddAirdrop, recipientCount, startTime, targetContract, topic0, totalAmount, userTopicIndex, whitelist]);


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
        <label htmlFor="userTopicIndex" className="block text-xs font-medium text-slate-600 mb-1">User Address Location</label>
        <p className="text-xs text-slate-500 mb-2">In which topic is the user's indexed address located?</p>
        <select
            id="userTopicIndex"
            value={userTopicIndex}
            onChange={e => setUserTopicIndex(Number(e.target.value) as 1 | 2 | 3)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
        >
            <option value={1}>Topic 1</option>
            <option value={2}>Topic 2</option>
            <option value={3}>Topic 3</option>
        </select>
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
              <label htmlFor="action" className="block text-xs font-medium text-slate-600 mb-1">Action URL (Optional)</label>
                <input
                    type="url"
                    id="action"
                    value={action}
                    onChange={e => setAction(e.target.value)}
                    placeholder="https://farcaster.xyz/..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-slate-500 mt-1">Must be a link to <code>farcaster.xyz</code> or <code>base.app</code>.</p>
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
                     {networks.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {networks.map(net => (
                                <button
                                    type="button"
                                    key={net.networkKey}
                                    onClick={() => handleNetworkSelect(net.networkKey)}
                                    aria-pressed={network === net.networkKey}
                                    className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-left transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                                        network === net.networkKey
                                            ? 'border-purple-600 bg-purple-50'
                                            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
                                    }`}
                                >
                                    <img src={net.iconUrl} alt={`${net.name} logo`} className="w-5 h-5" />
                                    <span className="font-semibold text-sm text-slate-800">{net.name}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-2 p-4 text-center border-2 border-dashed border-slate-200 rounded-lg">
                           <p className="text-xs text-slate-500 animate-pulse">Loading networks...</p>
                       </div>
                    )}
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Token</label>
                    {isLoadingTokens ? (
                         <div className="mt-2 p-4 text-center border-2 border-dashed border-slate-200 rounded-lg">
                           <p className="text-xs text-slate-500 animate-pulse">Loading tokens...</p>
                       </div>
                    ) : tokens.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {tokens.map(token => (
                                <button
                                    type="button"
                                    key={token.contractAddress}
                                    onClick={() => setSelectedTokenAddress(token.contractAddress)}
                                    aria-pressed={selectedTokenAddress === token.contractAddress}
                                    className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-left transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                                        selectedTokenAddress === token.contractAddress
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
              disabled={(status !== 'idle' && status !== 'error') || networks.length === 0}
            >
              {statusMessages[status]}
            </button>
        </div>
      </form>
    </div>
  );
};

export default NewAirdropForm;