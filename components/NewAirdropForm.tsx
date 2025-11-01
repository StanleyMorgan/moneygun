

import React, { useState, useMemo } from 'react';
import { Airdrop, AirdropStatus, EligibilityCriterion, AirdropType } from '../types';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';

interface NewAirdropFormProps {
  onAddAirdrop: (airdrop: Omit<Airdrop, 'id' | 'createdAt' | 'recipientCount'>) => void;
  onBack: () => void;
}

const eligibilityOptions: { value: EligibilityCriterion['type']; label: string; placeholder: string }[] = [
  { value: 'followers', label: 'Followers Of', placeholder: 'e.g., dwr.eth or FID' },
  { value: 'cast_likers', label: 'Likers Of Cast', placeholder: 'e.g., https://warpcast.com/dwr/0x...' },
  { value: 'channel_casters', label: 'Casters In Channel', placeholder: 'e.g., degen' },
  { value: 'nft_holders', label: 'NFT Holders', placeholder: 'e.g., 0x... (collection address)' },
  { value: 'custom_list', label: 'Custom Address List', placeholder: 'Paste wallet addresses, one per line' },
];

type WhitelistEntry = { address: string; amount: string };
const MAX_DESC_LENGTH = 280;

const NewAirdropForm: React.FC<NewAirdropFormProps> = ({ onAddAirdrop, onBack }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [airdropType, setAirdropType] = useState<AirdropType>(AirdropType.Whitelist);
  const [eligibilityType, setEligibilityType] = useState<EligibilityCriterion['type']>('followers');
  const [eligibilityValue, setEligibilityValue] = useState('');
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([{ address: '', amount: '' }]);

  const handleLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setLink(url);
    if (url && !url.startsWith('https://farcaster.xyz')) {
      setLinkError('Ссылка должна начинаться с https://farcaster.xyz');
    } else {
      setLinkError('');
    }
  };
  
  const handleWhitelistChange = (index: number, field: keyof WhitelistEntry, value: string) => {
    const updatedWhitelist = [...whitelist];
    updatedWhitelist[index][field] = value;
    setWhitelist(updatedWhitelist);
  };

  const addWhitelistRow = () => {
    setWhitelist([...whitelist, { address: '', amount: '' }]);
  };

  const removeWhitelistRow = (index: number) => {
    if (whitelist.length > 1) {
        const updatedWhitelist = whitelist.filter((_, i) => i !== index);
        setWhitelist(updatedWhitelist);
    }
  };

  const whitelistTotal = useMemo(() => {
    return whitelist.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  }, [whitelist]);

  const isWhitelistSumValid = useMemo(() => {
    const total = Number(totalAmount) || 0;
    if (total <= 0) return false;
    // Use a small epsilon for float comparison to avoid precision issues
    const epsilon = 1e-9; 
    return Math.abs(whitelistTotal - total) < epsilon;
  }, [totalAmount, whitelistTotal]);

  const isWhitelistDataValid = useMemo(() => {
    if (whitelist.length === 0) return false;
    return whitelist.every(row => row.address.trim() !== '' && Number(row.amount) > 0);
  }, [whitelist]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !tokenAddress || totalAmount === '') {
      alert('Пожалуйста, заполните все обязательные поля.');
      return;
    }
    
    let eligibility: EligibilityCriterion;

    if (airdropType === AirdropType.Whitelist) {
        if (!isWhitelistSumValid || !isWhitelistDataValid) {
            alert('Пожалуйста, исправьте ошибки в списке адресов. Сумма должна совпадать с общей суммой, и все поля должны быть заполнены корректно.');
            return;
        }
        eligibility = { type: 'custom_list', value: `${whitelist.length} addresses` };
    } else { // Quest
        if (!eligibilityValue) {
            alert('Пожалуйста, укажите значение для критерия отбора.');
            return;
        }
        if (eligibilityType === 'custom_list') {
            const addressCount = eligibilityValue.trim().split('\n').filter(Boolean).length;
            eligibility = { type: 'custom_list', value: `${addressCount} addresses` };
        } else {
            eligibility = { type: eligibilityType, value: eligibilityValue } as EligibilityCriterion;
        }
    }

    onAddAirdrop({
      name,
      description: description || undefined,
      action: link ? { text: "Link", url: link } : undefined,
      type: airdropType,
      tokenAddress,
      totalAmount: Number(totalAmount),
      status: AirdropStatus.Draft,
      eligibility,
    });
  };

  const selectedOption = eligibilityOptions.find(o => o.value === eligibilityType);
  
  const isFormValid = useMemo(() => {
    const baseValid = name && tokenAddress && Number(totalAmount) > 0 && !linkError;
    if (!baseValid) return false;

    if (airdropType === AirdropType.Whitelist) {
        return isWhitelistSumValid && isWhitelistDataValid;
    } else { // Quest
        return !!eligibilityValue;
    }
  }, [name, tokenAddress, totalAmount, linkError, airdropType, eligibilityValue, isWhitelistSumValid, isWhitelistDataValid]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
            <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold text-slate-800">New Airdrop</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 text-sm">
        {/* Basic Info */}
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-slate-600 mb-1">Airdrop Name</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Early $DEGEN Casters"
            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <div>
            <label htmlFor="description" className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe your airdrop"
                rows={3}
                maxLength={MAX_DESC_LENGTH}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
            <p className="text-xs text-right text-slate-400 mt-1">{description.length}/{MAX_DESC_LENGTH}</p>
        </div>

        <div>
            <label htmlFor="link" className="block text-xs font-medium text-slate-600 mb-1">Link (Optional)</label>
            <input
                type="url"
                id="link"
                value={link}
                onChange={handleLinkChange}
                placeholder="https://farcaster.xyz/..."
                className={`w-full px-3 py-1.5 bg-white border ${linkError ? 'border-red-500' : 'border-slate-300'} rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500`}
            />
            {linkError && <p className="text-xs text-red-500 mt-1">{linkError}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tokenAddress" className="block text-xs font-medium text-slate-600 mb-1">Token Contract Address</label>
              <input
                type="text"
                id="tokenAddress"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono"
              />
            </div>
            <div>
              <label htmlFor="totalAmount" className="block text-xs font-medium text-slate-600 mb-1">Total Airdrop Amount</label>
              <input
                type="number"
                id="totalAmount"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g., 1000000"
                min="0"
                step="any"
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>
        </div>

        {/* Airdrop Type Toggle */}
        <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Airdrop Type</label>
            <div className="flex gap-2">
                 <button type="button" onClick={() => setAirdropType(AirdropType.Whitelist)} className={`px-3 py-1.5 text-xs font-medium rounded-md border text-center transition-colors w-full ${airdropType === AirdropType.Whitelist ? 'bg-purple-50 text-purple-700 border-purple-300 ring-1 ring-purple-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Whitelist</button>
                 <button type="button" onClick={() => setAirdropType(AirdropType.Quest)} className={`px-3 py-1.5 text-xs font-medium rounded-md border text-center transition-colors w-full ${airdropType === AirdropType.Quest ? 'bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Quest</button>
            </div>
             <p className="text-xs text-slate-500 mt-1.5 px-1">
                {airdropType === AirdropType.Whitelist ? 'Users can claim tokens directly if they are on the list.' : 'Users must complete a task to be eligible for the reward.'}
            </p>
        </div>

        {/* Conditional UI */}
        {airdropType === AirdropType.Whitelist ? (
            <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Recipients & Amounts</label>
                <div className="space-y-2">
                    {whitelist.map((row, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={row.address}
                                onChange={(e) => handleWhitelistChange(index, 'address', e.target.value)}
                                placeholder="0x... or ENS"
                                className="w-2/3 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono"
                            />
                            <input
                                type="number"
                                value={row.amount}
                                onChange={(e) => handleWhitelistChange(index, 'amount', e.target.value)}
                                placeholder="Amount"
                                min="0"
                                step="any"
                                className="w-1/3 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                            />
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
        ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Eligibility Criterion</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {eligibilityOptions.map(option => (
                        <button key={option.value} type="button" onClick={() => { setEligibilityType(option.value); setEligibilityValue(''); }} className={`px-2 py-1.5 text-xs font-medium rounded-md border text-center transition-colors ${ eligibilityType === option.value ? 'bg-purple-50 text-purple-700 border-purple-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50' }`}>
                            {option.label}
                        </button>
                    ))}
                </div>
              </div>
              <div>
                {eligibilityType === 'custom_list' ? (
                     <textarea value={eligibilityValue} onChange={(e) => setEligibilityValue(e.target.value)} placeholder={selectedOption?.placeholder} rows={6} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono"/>
                ) : (
                    <input type="text" value={eligibilityValue} onChange={(e) => setEligibilityValue(e.target.value)} placeholder={selectedOption?.placeholder} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"/>
                )}
              </div>
            </>
        )}

        <div className="pt-3 flex justify-end">
          <button type="submit" disabled={!isFormValid} className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed">
            Create Airdrop Draft
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewAirdropForm;