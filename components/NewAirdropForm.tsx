
import React, { useState } from 'react';
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

const NewAirdropForm: React.FC<NewAirdropFormProps> = ({ onAddAirdrop, onBack }) => {
  const [name, setName] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [airdropType, setAirdropType] = useState<AirdropType>(AirdropType.Whitelist);
  const [eligibilityType, setEligibilityType] = useState<EligibilityCriterion['type']>('followers');
  const [eligibilityValue, setEligibilityValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !tokenAddress || totalAmount === '' || !eligibilityValue) {
      alert('Please fill out all fields.');
      return;
    }
    
    let eligibility: EligibilityCriterion;
    if (eligibilityType === 'custom_list') {
        const addressCount = eligibilityValue.trim().split('\n').filter(Boolean).length;
        eligibility = { type: 'custom_list', value: `${addressCount} addresses` };
    } else {
        eligibility = { type: eligibilityType, value: eligibilityValue } as EligibilityCriterion;
    }

    onAddAirdrop({
      name,
      type: airdropType,
      tokenAddress,
      totalAmount: Number(totalAmount),
      status: AirdropStatus.Draft,
      eligibility,
    });
  };

  const selectedOption = eligibilityOptions.find(o => o.value === eligibilityType);
  // Fix: Cast totalAmount to a number before comparison to avoid type error
  const isFormValid = name && tokenAddress && Number(totalAmount) > 0 && eligibilityValue;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500">
            <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold text-slate-800">New Airdrop</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 text-sm">
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
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>
        </div>

        <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Airdrop Type</label>
            <div className="flex gap-2">
                 <button
                    type="button"
                    onClick={() => setAirdropType(AirdropType.Whitelist)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border text-center transition-colors w-full ${
                        airdropType === AirdropType.Whitelist
                        ? 'bg-purple-50 text-purple-700 border-purple-300 ring-1 ring-purple-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    Whitelist
                </button>
                 <button
                    type="button"
                    onClick={() => setAirdropType(AirdropType.Quest)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border text-center transition-colors w-full ${
                        airdropType === AirdropType.Quest
                        ? 'bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    Quest
                </button>
            </div>
             <p className="text-xs text-slate-500 mt-1.5 px-1">
                {airdropType === AirdropType.Whitelist
                ? 'Users can claim tokens directly if they are on the list.'
                : 'Users must complete a task to be eligible for the reward.'
                }
            </p>
        </div>


        <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Eligibility Criterion</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {eligibilityOptions.map(option => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => { setEligibilityType(option.value); setEligibilityValue(''); }}
                        className={`px-2 py-1.5 text-xs font-medium rounded-md border text-center transition-colors ${
                            eligibilityType === option.value 
                            ? 'bg-purple-50 text-purple-700 border-purple-300' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>

        <div>
            {eligibilityType === 'custom_list' ? (
                 <textarea
                    value={eligibilityValue}
                    onChange={(e) => setEligibilityValue(e.target.value)}
                    placeholder={selectedOption?.placeholder}
                    rows={6}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono"
                />
            ) : (
                <input
                    type="text"
                    value={eligibilityValue}
                    onChange={(e) => setEligibilityValue(e.target.value)}
                    placeholder={selectedOption?.placeholder}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
            )}
        </div>

        <div className="pt-3 flex justify-end">
          <button 
            type="submit"
            disabled={!isFormValid}
            className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            Create Airdrop Draft
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewAirdropForm;