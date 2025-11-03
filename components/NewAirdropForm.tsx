import React, { useState, useEffect } from 'react';
import { Airdrop, AirdropType, AirdropStatus, WhitelistEntry } from '../types';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import Papa from 'papaparse';
import { getAddress, isAddress, parseEventLogs } from 'viem';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { airdropFactoryABI, airdropABI } from '../lib/abi';
import { base, baseSepolia } from 'wagmi/chains';

// Base Sepolia Airdrop Factory Contract Address
const AIRDROP_FACTORY_ADDRESS = getAddress('0x6cd36B7DfCdB024CACc4D57Bbc7F3F0dB6af7Ab2');

const chainIdMap: Record<string, number> = {
  'base-sepolia': baseSepolia.id,
  'base': base.id,
};

const SUPPORTED_TOKENS: Record<string, { symbol: string; address: `0x${string}`; decimals: number; iconUrl: string }[]> = {
  'base-sepolia': [
    { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18, iconUrl: 'https://raw.githubusercontent.com/StanleyMorgan/cryptoicons/76fae77d0876d5656f8916cc5b856ce86181eba8/SVG/eth.svg' },
    { symbol: 'USDC', address: '0x4b1a87123583b2E630152668a2c2fABb44b32F36', decimals: 18, iconUrl: 'https://raw.githubusercontent.com/StanleyMorgan/cryptoicons/76fae77d0876d5656f8916cc5b856ce86181eba8/SVG/usdc.svg' },
  ],
  'base': [
    { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18, iconUrl: 'https://raw.githubusercontent.com/StanleyMorgan/cryptoicons/76fae77d0876d5656f8916cc5b856ce86181eba8/SVG/eth.svg' },
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, iconUrl: 'https://raw.githubusercontent.com/StanleyMorgan/cryptoicons/76fae77d0876d5656f8916cc5b856ce86181eba8/SVG/usdc.svg' },
  ],
};


interface NewAirdropFormProps {
  onAddAirdrop: (airdropData: Omit<Airdrop, 'id' | 'createdAt' | 'recipientCount' | 'creatorAddress'> & { whitelist?: WhitelistEntry[] }) => void;
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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [network, setNetwork] = useState('base-sepolia');
  const [selectedTokenAddress, setSelectedTokenAddress] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [whitelistCsv, setWhitelistCsv] = useState('');
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [error, setError] = useState('');
  
  const [status, setStatus] = useState<FormStatus>('idle');
  const [merkleRoot, setMerkleRoot] = useState<`0x${string}` | null>(null);
  const [newAirdropAddress, setNewAirdropAddress] = useState<`0x${string}` | null>(null);

  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  const { data: createAirdropHash, writeContract: createAirdropContract, error: createError } = useWriteContract();
  const { data: setMerkleHash, writeContract: setMerkleContract, error: setMerkleError } = useWriteContract();
  
  const { isSuccess: isCreateSuccess, data: createReceipt } = useWaitForTransactionReceipt({ hash: createAirdropHash });
  const { isSuccess: isSetMerkleSuccess } = useWaitForTransactionReceipt({ hash: setMerkleHash });
  
  const currentTokens = SUPPORTED_TOKENS[network] || [];
  const selectedToken = currentTokens.find(t => t.address === selectedTokenAddress);

  useEffect(() => {
    // Automatically switch to the default network on component mount if a wallet is connected
    if (isConnected && chain?.id !== chainIdMap[network] && switchChain) {
        switchChain({ chainId: chainIdMap[network] });
    }
  }, [isConnected, chain, network, switchChain]);

  const handleNetworkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newNetwork = e.target.value;
      setNetwork(newNetwork);
      setSelectedTokenAddress(''); // Reset token selection on network change
      if (switchChain && chainIdMap[newNetwork]) {
          switchChain({ chainId: chainIdMap[newNetwork] });
      }
  };


  const handleWhitelistParse = () => {
    if (!whitelistCsv.trim()) {
      setWhitelist([]);
      setTotalAmount(0);
      setError('');
      return;
    }

    Papa.parse<string[]>(whitelistCsv, {
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
            const firstError = results.errors[0];
            if (firstError) {
                // The `row` property on a PapaParse error can be undefined, so we must handle that case.
                const lineInfo = firstError.row !== undefined ? `on line ${firstError.row + 1}` : 'in an unknown row';
                setError(`CSV parsing error ${lineInfo}: ${firstError.message}`);
            } else {
                setError('An unknown CSV parsing error occurred.');
            }
            setWhitelist([]);
            setTotalAmount(0);
            return;
        }
        
        const newWhitelist: WhitelistEntry[] = [];
        let newTotalAmount = 0;
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
          newTotalAmount += amountNum;
        }

        if (parseError) {
          setError(parseError);
          setWhitelist([]);
          setTotalAmount(0);
        } else {
          setError('');
          setWhitelist(newWhitelist);
          setTotalAmount(newTotalAmount);
        }
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('idle');

    if (!isConnected || !address) {
        setError("Please connect your wallet first.");
        return;
    }
    if (!selectedToken) {
        setError('Please select a token.');
        return;
    }
    if (whitelist.length === 0) {
        setError('Whitelist cannot be empty. Please provide a valid CSV and wait for it to be processed.');
        return;
    }
    if (!name || !description || !startTime || !endTime) {
        setError('Please fill all required fields.');
        return;
    }
    if (description.length > 140) {
        setError('Description cannot exceed 140 characters.');
        return;
    }

    try {
        // Step 1: Generate Merkle Root
        setStatus('generatingMerkle');
        console.log('[Create Airdrop] Step 1: Generating Merkle root...');
        const merkleResponse = await fetch('/api/airdrops', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'generateMerkle', whitelist, tokenDecimals: selectedToken.decimals }),
        });
        if (!merkleResponse.ok) throw new Error('Failed to generate Merkle root.');
        const { merkleRoot: newMerkleRoot } = await merkleResponse.json();
        setMerkleRoot(newMerkleRoot);
        console.log('[Create Airdrop] Step 1 Success: Merkle Root:', newMerkleRoot);

        // Step 2: Create Airdrop contract (triggers useEffect)
        setStatus('creatingContract');
    } catch (err: any) {
        console.error("Airdrop creation process failed:", err);
        setError(err.message || 'An unknown error occurred.');
        setStatus('error');
    }
  };

  // Effect for Step 2: Create Airdrop Contract
  useEffect(() => {
    if (status === 'creatingContract' && merkleRoot && address && chain && selectedToken) {
        console.log('[Create Airdrop] Step 2: Calling createAirdrop contract...');
        console.log('Params:', { factory: AIRDROP_FACTORY_ADDRESS, token: selectedToken.address, owner: address });
        createAirdropContract({
            address: AIRDROP_FACTORY_ADDRESS,
            abi: airdropFactoryABI,
            functionName: 'createAirdrop',
            args: [getAddress(selectedToken.address), address],
            account: address,
            chain: chain,
        });
        setStatus('waitingForCreation');
    }
  }, [status, merkleRoot, address, selectedToken, createAirdropContract, chain]);

  // Effect for Step 3: Parse contract address from logs
  useEffect(() => {
    if (isCreateSuccess && createReceipt) {
        console.log('[Create Airdrop] Step 2 Success: Transaction confirmed.');
        try {
            const logs = parseEventLogs({
                abi: airdropFactoryABI,
                logs: createReceipt.logs,
                eventName: 'AirdropCreated',
            });

            if (logs.length === 0) {
                console.error("Could not find AirdropCreated event in transaction logs. All logs:", createReceipt.logs);
                throw new Error("AirdropCreated event not found in transaction logs.");
            }

            const newAddress = logs[0].args.airdrop;
            if (!newAddress) {
                throw new Error("Parsed log is missing the 'airdrop' address argument.");
            }
            
            console.log('[Create Airdrop] Step 3: Parsed new airdrop address:', newAddress);
            setNewAirdropAddress(newAddress);
            setStatus('settingMerkle');
        } catch (err) {
            console.error('Failed to parse airdrop address from logs:', err);
            setError('Could not find new airdrop address in transaction logs.');
            setStatus('error');
        }
    }
  }, [isCreateSuccess, createReceipt]);

  // Effect for Step 4: Set Merkle Root
  useEffect(() => {
    if (status === 'settingMerkle' && newAirdropAddress && merkleRoot && address && chain) {
        console.log('[Create Airdrop] Step 4: Calling setMerkleRoot on new contract...');
        console.log('Params:', { newAirdropAddress, merkleRoot });
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
  }, [status, newAirdropAddress, merkleRoot, setMerkleContract, address, chain]);

  // Effect for Step 5: Save to DB
  useEffect(() => {
    const saveAirdrop = async () => {
        if (isSetMerkleSuccess && newAirdropAddress && merkleRoot && selectedToken) {
            console.log('[Create Airdrop] Step 4 Success: Merkle root set.');
            setStatus('saving');
            console.log('[Create Airdrop] Step 5: Saving airdrop to database...');
            try {
                await onAddAirdrop({
                    name,
                    description,
                    type: AirdropType.Whitelist,
                    tokenAddress: selectedToken.address,
                    tokenSymbol: selectedToken.symbol,
                    tokenDecimals: selectedToken.decimals,
                    network,
                    totalAmount,
                    status: AirdropStatus.Draft,
                    startTime: new Date(startTime),
                    endTime: new Date(endTime),
                    whitelist,
                    contractAddress: newAirdropAddress,
                    merkleRoot,
                });
                console.log('[Create Airdrop] Step 5 Success: Airdrop saved.');
                setStatus('success');
            } catch (err: any) {
                console.error('Failed to save airdrop to DB:', err);
                setError(`On-chain actions succeeded, but failed to save to DB: ${err.message}`);
                setStatus('error');
            }
        }
    };
    saveAirdrop();
  }, [isSetMerkleSuccess, newAirdropAddress, merkleRoot, selectedToken]);

  useEffect(() => {
      if (createError) {
          setError(`Contract creation failed: ${createError.message}`);
          setStatus('error');
      }
      if (setMerkleError) {
          setError(`Setting Merkle root failed: ${setMerkleError.message}`);
          setStatus('error');
      }
  }, [createError, setMerkleError]);


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
                <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} required className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"/>
            </div>
            <div>
                <label htmlFor="description" className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={3} required maxLength={140} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                <p className="text-right text-xs text-slate-500 mt-1">{description.length} / 140</p>
            </div>
        </div>
        <div className="space-y-4">
            <h2 className="text-base font-semibold text-slate-700">Token & Network</h2>
            <div className="space-y-4">
                <div>
                    <label htmlFor="network" className="block text-xs font-medium text-slate-600 mb-1">Network</label>
                    <select id="network" value={network} onChange={handleNetworkChange} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                        <option value="base-sepolia">Base Sepolia</option>
                        <option value="base">Base</option>
                    </select>
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