export enum AirdropType {
  Whitelist = 'Whitelist',
  Quest = 'Quest',
}

export enum AirdropStatus {
  Draft = 'Draft',
  Active = 'Active',
  Planned = 'Planned',
  InProgress = 'In Progress',
  Ended = 'Ended',
  Failed = 'Failed',
}

export interface WhitelistEntry {
  address: string;
  amount: string;
}

export interface Network {
  id: number;
  networkKey: string;
  name: string;
  chainId: number;
  whitelistFactoryAddress: `0x${string}`;
  questFactoryAddress: `0x${string}`;
  rpcUrlPublic: string;
  iconUrl?: string;
  isTestnet: boolean;
}

export interface Token {
  id: number;
  networkKey: string;
  symbol: string;
  name: string;
  contractAddress: `0x${string}`;
  decimals: number;
  iconUrl?: string;
}

export interface Airdrop {
  id: number;
  name: string;
  image?: string;
  description?: string;
  action?: {
    text: string;
    url: string;
  };
  type: AirdropType;
  tokenAddress: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  network?: string;
  totalAmount: number;
  status: AirdropStatus;
  recipientCount: number;
  creatorAddress: string;
  startTime?: Date;
  endTime?: Date;
  createdAt: Date;
  contractAddress?: string;
  merkleRoot?: string;
  maxReward?: number;
  claimedCount?: number;
  topic0?: string;
  targetContract?: string;
  userTopicIndex?: number;
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