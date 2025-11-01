
export enum AirdropType {
  Whitelist = 'Whitelist',
  Quest = 'Quest',
}

export enum AirdropStatus {
  Draft = 'Draft',
  InProgress = 'In Progress',
  Completed = 'Completed',
  Failed = 'Failed',
}

export type EligibilityCriterion = 
  | { type: 'followers'; value: string } // Farcaster username or FID
  | { type: 'cast_likers'; value: string } // Cast URL
  | { type: 'channel_casters'; value: string } // Channel name
  | { type: 'nft_holders'; value: string } // NFT Collection Address
  | { type: 'custom_list'; value: string }; // List of addresses or note about it

export interface Airdrop {
  id: string;
  name: string;
  description?: string;
  action?: {
    text: string;
    url: string;
  };
  type: AirdropType;
  tokenAddress: string;
  tokenSymbol?: string;
  network?: string;
  totalAmount: number;
  status: AirdropStatus;
  eligibility: EligibilityCriterion;
  recipientCount: number;
  startTime?: Date;
  endTime?: Date;
  createdAt: Date;
}

// Detailed configuration loaded from a JSON file
export interface AirdropConfig {
  name: string;
  description: string;
  network: string;
  type: AirdropType;
  token: {
    name: string;
    symbol: string;
    address: string;
    decimals: number;
  };
  schedule: {
    startTime: string;
    endTime: string;
  };
  airdropContract: string;
  action?: {
    text: string;
    url:string;
  };
}