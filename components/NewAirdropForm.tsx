
import React, { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { Airdrop, AirdropType, WhitelistEntry, Network, Token } from '../types';
import { getNetworks, getTokens } from '../lib/api';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { parse } from 'papaparse';
import { getAddress, isAddress } from 'viem';

interface NewAirdropFormProps {
  onAddAirdrop: (airdropData: Omit<Airdrop, 'id' | 'createdAt' | 'creatorAddress'> & { whitelist?: WhitelistEntry[] }) => void;
  onBack: () => void;
}

const NewAirdropForm: React.FC<NewAirdropFormProps> = ({ onAddAirdrop, onBack }) => {
  const { isConnected } = useAccount();

  // Form State
  const [airdropType, setAirdropType] = useState<AirdropType>(AirdropType.Whitelist);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // Network & Token State
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>(''); // Stores token address
  const [isLoadingNetworks, setIsLoadingNetworks] = useState(true);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);

  // Whitelist State
  const [whitelistCsv, setWhitelistCsv] = useState('');
  const [parsedWhitelist, setParsedWhitelist] = useState<WhitelistEntry[]>([]);
  
  // Quest State
  const [questTitle, setQuestTitle] = useState('');
  const [questUrl, setQuestUrl] = useState('');
  const [maxReward, setMaxReward] = useState('');
  const [recipientCount, setRecipientCount] = useState('');
  
  // Time State
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  
  // Errors & Status
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch initial data
  useEffect(() => {
    const fetchNetworks = async () => {
      try {
        const nets = await getNetworks();
        setNetworks(nets);
        if (nets.length > 0) {
            setSelectedNetwork(nets[0].key);
        }
      } catch (error) {
        console.error("Failed to fetch networks:", error);
      } finally {
        setIsLoadingNetworks(false);
      }
    };
    fetchNetworks();
  }, []);

  useEffect(() => {
    if (!selectedNetwork) {
        setTokens([]);
        setSelectedToken('');
        return;
    };
    const fetchTokens = async () => {
      setIsLoadingTokens(true);
      setTokens([]);
      setSelectedToken('');
      try {
        const toks = await getTokens(selectedNetwork);
        setTokens(toks);
        if (toks.length > 0) {
            setSelectedToken(toks[0].address);
        }
      } catch (error) {
        console.error("Failed to fetch tokens:", error);
      } finally {
        setIsLoadingTokens(false);
      }
    };
    fetchTokens();
  }, [selectedNetwork]);

  // Derived State
  const totalAmount = useMemo(() => {
    if (airdropType === AirdropType.Whitelist) {
      return parsedWhitelist.reduce((sum, entry) => sum + parseFloat(entry.amount || '0'), 0);
    }
    if (airdropType === AirdropType.Quest) {
      const reward = parseFloat(maxReward || '0');
      const count = parseInt(recipientCount || '0', 10);
      return reward * count;
    }
    return 0;
  }, [airdropType, parsedWhitelist, maxReward, recipientCount]);

  // Handlers
  const handleWhitelistParse = () => {
    const newErrors = {...errors};
    delete newErrors.whitelist;

    if (!whitelistCsv.trim()) {
      setParsedWhitelist([]);
      setErrors(newErrors);
      return;
    }

    parse<[string, string]>(whitelistCsv, {
      complete: (results) => {
        const validEntries: WhitelistEntry[] = [];
        const seenAddresses = new Set<string>();
        
        results.data.forEach((row, index) => {
          if (row.length < 2) return;
          const [address, amount] = row.map(s => s.trim());

          if (!address || !amount) return; // Skip empty rows

          if (!isAddress(address)) {
            newErrors.whitelist = `Invalid address at row ${index + 1}: ${address}`;
            return;
          }

          const checksummedAddress = getAddress(address);
          if (seenAddresses.has(checksummedAddress)) {
              newErrors.whitelist = `Duplicate address found at row ${index + 1}: ${address}`;
              return;
          }
          
          if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            newErrors.whitelist = `Invalid amount at row ${index + 1}: ${amount}`;
            return;
          }
          
          seenAddresses.add(checksummedAddress);
          validEntries.push({ address: checksummedAddress, amount });
        });
        
        if (Object.keys(newErrors).length === 0) {
             setParsedWhitelist(validEntries);
        }
        setErrors(newErrors);
      },
      error: (error) => {
        newErrors.whitelist = `CSV parsing error: ${error.message}`;
        setErrors(newErrors);
      }
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name) newErrors.name = "Airdrop name is required.";
    if (!selectedNetwork) newErrors.network = "Network is required.";
    if (!selectedToken) newErrors.token = "Token is required.";

    if (airdropType === AirdropType.Whitelist) {
        if (parsedWhitelist.length === 0) newErrors.whitelist = "Whitelist cannot be empty. Please add addresses and amounts.";
    }

    if (airdropType === AirdropType.Quest) {
        if (!questTitle) newErrors.questTitle = "Quest title is required.";
        if (!questUrl) newErrors.questUrl = "Quest URL is required.";
        if (!maxReward || parseFloat(maxReward) <= 0) newErrors.maxReward = "A valid reward per user is required.";
        if (!recipientCount || parseInt(recipientCount, 10) <= 0) newErrors.recipientCount = "A valid recipient count is required.";
    }
    
    if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
        newErrors.time = "End time must be after the start time."
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    const tokenInfo = tokens.find(t => t.address === selectedToken);

    const airdropData = {
      name,
      description,
      network: selectedNetwork,
      status: 'DRAFT',
      type: airdropType,
      tokenAddress: selectedToken,
      tokenSymbol: tokenInfo?.symbol ?? 'TOKEN',
      tokenDecimals: tokenInfo?.decimals ?? 18,
      totalAmount,
      recipientCount: airdropType === AirdropType.Whitelist ? parsedWhitelist.length : parseInt(recipientCount, 10),
      claimedCount: 0,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      whitelist: airdropType === AirdropType.Whitelist ? parsedWhitelist : undefined,
      questTitle: airdropType === AirdropType.Quest ? questTitle : undefined,
      questUrl: airdropType === AirdropType.Quest ? questUrl : undefined,
      maxReward: airdropType === AirdropType.Quest ? parseFloat(maxReward) : undefined,
    };
    
    try {
        await onAddAirdrop(airdropData as any);
    } catch(err) {
        // Error is handled in App.tsx
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const InputGroup: React.FC<{ label: string; name: string; children: React.ReactNode }> = ({ label, name, children }) => (
    <div>
        <label htmlFor={name} className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
        {children}
        {errors[name] && <p className="mt-1 text-xs text-red-600">{errors[name]}</p>}
    </div>
  )

  if (!isConnected) {
    return (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-lg">
            <h3 className="text-sm font-medium text-slate-800">Please connect your wallet</h3>
            <p className="mt-1 text-xs text-slate-500">You need to connect your wallet to create a new airdrop.</p>
             <button onClick={onBack} className="mt-4 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                <ArrowLeftIcon className="w-4 h-4" />
                Back to Dashboard
            </button>
        </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-xl font-semibold text-slate-800">Create New Airdrop</h1>
            <p className="text-sm text-slate-500">Configure and launch your token airdrop.</p>
        </div>
        <button onClick={onBack} className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
            <ArrowLeftIcon className="w-4 h-4" />
            Back
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6 p-6 bg-white border border-slate-200 rounded-lg">
        {/* Step 1: Airdrop Type */}
        <div className="border-b border-slate-200 pb-6">
            <h3 className="text-sm font-semibold mb-2">Airdrop Type</h3>
            <div className="flex items-center gap-4">
                 <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="airdrop-type" value={AirdropType.Whitelist} checked={airdropType === AirdropType.Whitelist} onChange={() => setAirdropType(AirdropType.Whitelist)} className="h-4 w-4 text-purple-600 border-slate-300 focus:ring-purple-500"/>
                    <span className="text-sm">Whitelist</span>
                 </label>
                 <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="airdrop-type" value={AirdropType.Quest} checked={airdropType === AirdropType.Quest} onChange={() => setAirdropType(AirdropType.Quest)} className="h-4 w-4 text-purple-600 border-slate-300 focus:ring-purple-500"/>
                    <span className="text-sm">Quest-based</span>
                 </label>
            </div>
        </div>

        {/* Step 2: Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputGroup label="Airdrop Name" name="name">
                <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} className="block w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" placeholder="e.g., Early Adopter Rewards" />
            </InputGroup>
            <InputGroup label="Description (Optional)" name="description">
                <input id="description" type="text" value={description} onChange={e => setDescription(e.target.value)} className="block w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" />
            </InputGroup>
            <InputGroup label="Network" name="network">
                <select id="network" value={selectedNetwork} onChange={e => setSelectedNetwork(e.target.value)} disabled={isLoadingNetworks} className="block w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-slate-50">
                    {isLoadingNetworks ? <option>Loading...</option> : networks.map(net => <option key={net.key} value={net.key}>{net.name}</option>)}
                </select>
            </InputGroup>
            <InputGroup label="Token" name="token">
                <select id="token" value={selectedToken} onChange={e => setSelectedToken(e.target.value)} disabled={isLoadingTokens || !selectedNetwork} className="block w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-slate-50">
                    {isLoadingTokens ? <option>Loading...</option> : tokens.length === 0 ? <option>No tokens found</option> : tokens.map(tok => <option key={tok.address} value={tok.address}>{tok.name} ({tok.symbol})</option>)}
                </select>
            </InputGroup>
        </div>
        
        {/* Step 3: Type-specific config */}
        {airdropType === AirdropType.Whitelist && (
            <InputGroup label="Whitelist" name="whitelist">
                <textarea id="whitelist" rows={6} value={whitelistCsv} onChange={e => setWhitelistCsv(e.target.value)} onBlur={handleWhitelistParse} className="block w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 font-mono" placeholder="Paste CSV data: address,amount&#10;0x...,100&#10;0x...,250"></textarea>
                <p className="mt-1 text-xs text-slate-500">Parsed {parsedWhitelist.length} valid entries.</p>
            </InputGroup>
        )}
        {airdropType === AirdropType.Quest && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200 pt-6">
                <InputGroup label="Quest Title" name="questTitle">
                    <input id="questTitle" type="text" value={questTitle} onChange={e => setQuestTitle(e.target.value)} className="block w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" placeholder="e.g., Like our launch cast" />
                </InputGroup>
                 <InputGroup label="Quest URL" name="questUrl">
                    <input id="questUrl" type="url" value={questUrl} onChange={e => setQuestUrl(e.target.value)} className="block w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" placeholder="https://warpcast.com/..." />
                </InputGroup>
                 <InputGroup label="Reward Per User" name="maxReward">
                    <input id="maxReward" type="number" value={maxReward} onChange={e => setMaxReward(e.target.value)} className="block w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" placeholder="100" />
                </InputGroup>
                 <InputGroup label="Max Recipients" name="recipientCount">
                    <input id="recipientCount" type="number" value={recipientCount} onChange={e => setRecipientCount(e.target.value)} className="block w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" placeholder="1000" />
                </InputGroup>
            </div>
        )}

        {/* Step 4: Timing (optional) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200 pt-6">
            <InputGroup label="Start Time (Optional)" name="time">
                 <input id="startTime" type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="block w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" />
            </InputGroup>
             <InputGroup label="End Time (Optional)" name="time">
                 <input id="endTime" type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="block w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500" />
            </InputGroup>
        </div>
        
        {/* Summary & Submit */}
        <div className="border-t border-slate-200 pt-6 space-y-3">
             <div className="flex justify-between items-center text-sm font-medium bg-slate-50 p-3 rounded-lg">
                <span>Total Airdrop Amount</span>
                <span>{new Intl.NumberFormat().format(totalAmount)} {tokens.find(t=>t.address === selectedToken)?.symbol || ''}</span>
             </div>
             <button type="submit" disabled={isSubmitting} className="w-full bg-purple-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-purple-700 disabled:bg-purple-300 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2">
                {isSubmitting ? 'Creating Airdrop...' : 'Create Airdrop'}
            </button>
        </div>

      </form>
    </div>
  );
};

export default NewAirdropForm;
