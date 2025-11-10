
export enum AirdropStatus {
  Draft = 'DRAFT',
  Active = 'ACTIVE',
  Ended = 'ENDED',
  Failed = 'FAILED',
  // Frontend-only computed statuses
  InProgress = 'IN_PROGRESS',
  Planned = 'PLANNED',
}

export enum AirdropType {
  Whitelist = 'WHITELIST',
  Quest = 'QUEST',
}

export interface WhitelistEntry {
  address: string;
  amount: string;
}

export interface Airdrop {
  id: number;
  name: string;
  description?: string;
  network: string; // e.g., 'base', 'base-sepolia'
  status: AirdropStatus;
  type: AirdropType;
  creatorAddress: string;
  contractAddress?: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  totalAmount: number;
  recipientCount: number;
  claimedCount: number;
  merkleRoot?: string;
  createdAt: Date;
  startTime?: Date;
  endTime?: Date;
  // Quest specific fields
  questTitle?: string;
  questDescription?: string;
  questUrl?: string;
  maxReward?: number;
  userTopicIndex?: number;
}

export interface Network {
  id: number;
  name: string;
  key: string;
  chain_id: number;
  is_testnet: boolean;
  block_explorer_url: string;
}

export interface Token {
  id: number;
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  network_key: string;
}
