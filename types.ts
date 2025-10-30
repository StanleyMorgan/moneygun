
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
  tokenAddress: string;
  totalAmount: number;
  status: AirdropStatus;
  eligibility: EligibilityCriterion;
  recipientCount: number;
  createdAt: Date;
}
