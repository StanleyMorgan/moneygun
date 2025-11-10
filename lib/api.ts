import { Airdrop, WhitelistEntry, Network, Token } from '../types';

// Helper to convert snake_case object keys to camelCase.
// This is needed because the DB/API returns snake_case and the frontend uses camelCase.
// Handles nested objects and arrays.
const convertKeysToCamelCase = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => convertKeysToCamelCase(v));
    } else if (obj !== null && obj.constructor === Object) {
        return Object.keys(obj).reduce((acc, key) => {
            const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            acc[camelKey] = convertKeysToCamelCase(obj[key]);
            return acc;
        }, {} as {[key: string]: any});
    }
    return obj;
}


/**
 * Fetches the list of all airdrops from the API.
 */
export const getAirdrops = async (): Promise<Airdrop[]> => {
  const response = await fetch('/api/airdrops');
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch airdrops' }));
    throw new Error(errorData.message);
  }
  const data = await response.json();
  
  // The API returns data with snake_case keys. We need to convert them to camelCase.
  const camelCaseData = convertKeysToCamelCase(data);

  // Convert string dates to Date objects and ensure numeric types are correct
  return camelCaseData.map((item: any) => ({
    ...item,
    totalAmount: Number(item.totalAmount), // total_amount is NUMERIC in DB
    maxReward: item.maxReward ? Number(item.maxReward) : undefined,
    claimedCount: item.claimedCount ? Number(item.claimedCount) : 0,
    userTopicIndex: item.userTopicIndex ? Number(item.userTopicIndex) : undefined,
    createdAt: new Date(item.createdAt),
    startTime: item.startTime ? new Date(item.startTime) : undefined,
    endTime: item.endTime ? new Date(item.endTime) : undefined,
  }));
};

/**
 * Fetches the list of supported networks from the API.
 */
export const getNetworks = async (): Promise<Network[]> => {
  const response = await fetch('/api/networks');
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch networks' }));
    throw new Error(errorData.message);
  }
  const data = await response.json();
  return convertKeysToCamelCase(data);
};

/**
 * Fetches the list of supported tokens for a specific network from the API.
 */
export const getTokens = async (networkKey: string): Promise<Token[]> => {
  if (!networkKey) return [];
  const response = await fetch(`/api/tokens?networkKey=${networkKey}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch tokens' }));
    throw new Error(errorData.message);
  }
  const data = await response.json();
  return convertKeysToCamelCase(data);
};

/**
 * Defines the payload for creating a new airdrop.
 * Now includes fields for both Whitelist and Quest types.
 */
export interface AirdropCreationPayload extends Omit<Airdrop, 'id' | 'createdAt' | 'claimedCount'> {
  whitelist?: WhitelistEntry[];
}


/**
 * Creates a new airdrop by POSTing to the API.
 */
export const createAirdrop = async (airdropData: AirdropCreationPayload): Promise<Airdrop> => {
  // Frontend uses camelCase, and our API handler is written to accept it directly.
  const response = await fetch('/api/airdrops', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(airdropData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to create airdrop' }));
    throw new Error(errorData.message || 'Failed to create airdrop');
  }
  
  const data = await response.json();

  // The API returns the newly created record with snake_case keys.
  const camelCaseData = convertKeysToCamelCase(data);
  
  // Convert string date to Date object and ensure numeric types are correct
  return {
    ...camelCaseData,
    totalAmount: Number(camelCaseData.totalAmount),
    maxReward: camelCaseData.maxReward ? Number(camelCaseData.maxReward) : undefined,
    claimedCount: camelCaseData.claimedCount ? Number(camelCaseData.claimedCount) : 0,
    userTopicIndex: camelCaseData.userTopicIndex ? Number(camelCaseData.userTopicIndex) : undefined,
    createdAt: new Date(camelCaseData.createdAt),
    startTime: camelCaseData.startTime ? new Date(camelCaseData.startTime) : undefined,
    endTime: camelCaseData.endTime ? new Date(camelCaseData.endTime) : undefined,
  };
};

/**
 * Deletes an airdrop by sending a DELETE request to the API.
 */
export const deleteAirdrop = async (airdropId: number, userAddress: string): Promise<void> => {
  const response = await fetch('/api/airdrops', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ airdropId, userAddress }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to delete airdrop' }));
    throw new Error(errorData.message || 'Failed to delete airdrop');
  }
};

/**
 * Calls the backend to verify quest completion and get a signature.
 */
export const verifyQuest = async (airdropId: number, userAddress: string): Promise<{ amount: string; signature: `0x${string}` }> => {
    const response = await fetch('/api/airdrops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verifyQuest', airdropId, userAddress }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to verify quest completion' }));
        throw new Error(errorData.message || 'Verification failed');
    }
    return response.json();
};

/**
 * Fetches the public verifier address from the backend.
 */
export const getVerifierAddress = async (): Promise<`0x${string}`> => {
  const response = await fetch('/api/airdrops?action=getVerifierAddress');
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch verifier address' }));
    throw new Error(errorData.message);
  }
  const { verifierAddress } = await response.json();
  return verifierAddress;
};