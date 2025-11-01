
import { Airdrop, AirdropType, AirdropStatus } from '../types';

// Define a type for the raw airdrop data, where createdAt is a string
export type AirdropFromJSON = Omit<Airdrop, 'createdAt' | 'startTime' | 'endTime' > & { 
  createdAt: string;
  startTime?: string;
  endTime?: string;
};

// This acts as our in-memory database, initialized with the same data as index.json
// It's a mutable 'let' so our mock createAirdrop function can modify it.
export let airdropsData: AirdropFromJSON[] = [
  {
    "id": "1",
    "name": "Initial $DEGEN Drop",
    // FIX: Use AirdropType enum instead of string literal
    "type": AirdropType.Whitelist,
    "tokenAddress": "0x4ed4E862860beD51a957029679E281e3E1deE594",
    "totalAmount": 1000000,
    // FIX: Use AirdropStatus enum instead of string literal
    "status": AirdropStatus.Completed,
    "recipientCount": 1250,
    "creatorAddress": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "createdAt": "2024-07-15T10:00:00Z"
  },
  {
    "id": "2",
    "name": "Early Casters Reward",
    // FIX: Use AirdropType enum instead of string literal
    "type": AirdropType.Whitelist,
    "tokenAddress": "0x5471ea8f73142279182911d837ca7c852a4a2b85",
    "totalAmount": 500000,
    // FIX: Use AirdropStatus enum instead of string literal
    "status": AirdropStatus.InProgress,
    "recipientCount": 480,
    "creatorAddress": "0x1234...5678",
    "createdAt": "2024-07-28T14:30:00Z"
  },
  {
    "id": "3",
    "name": "Next Meme Token",
    // FIX: Use AirdropType enum instead of string literal
    "type": AirdropType.Whitelist,
    "tokenAddress": "TBD",
    "totalAmount": 10000000,
    // FIX: Use AirdropStatus enum instead of string literal
    "status": AirdropStatus.Draft,
    "recipientCount": 12,
    "creatorAddress": "0xabcd...efgh",
    "createdAt": "2024-08-01T12:00:00Z"
  },
  {
    "id": "4",
    "name": "Play 2048 Mining App",
    // FIX: Use AirdropType enum instead of string literal
    "type": AirdropType.Quest,
    "tokenAddress": "0x4200000000000000000000000000000000000006",
    "totalAmount": 2048,
    // FIX: Use AirdropStatus enum instead of string literal
    "status": AirdropStatus.Draft,
    "recipientCount": 100,
    "creatorAddress": "0x9999...1111",
    "createdAt": "2024-08-05T00:00:00Z"
  }
];
