
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
  recipientCount: number;
  creatorAddress: string;
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
