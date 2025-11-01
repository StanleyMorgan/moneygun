import { Airdrop, AirdropType, AirdropStatus } from '../types';

// Define a type for the raw airdrop data, where createdAt is a string
export type AirdropFromJSON = Omit<Airdrop, 'createdAt'> & { createdAt: string };

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
    "eligibility": { "type": "followers", "value": "dwr.eth" },
    "recipientCount": 1250,
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
    "eligibility": { "type": "cast_likers", "value": "https://warpcast.com/dwr/0x1a2b3c" },
    "recipientCount": 480,
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
    "eligibility": { "type": "custom_list", "value": "12 addresses" },
    "recipientCount": 12,
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
    "eligibility": { "type": "custom_list", "value": "Top Miners" },
    "recipientCount": 100,
    "createdAt": "2024-08-05T00:00:00Z"
  }
];
