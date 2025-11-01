
import { Airdrop } from '../types';

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
    createdAt: new Date(item.createdAt),
    startTime: item.startTime ? new Date(item.startTime) : undefined,
    endTime: item.endTime ? new Date(item.endTime) : undefined,
  }));
};

/**
 * Creates a new airdrop by POSTing to the API.
 */
export const createAirdrop = async (airdropData: Omit<Airdrop, 'id' | 'createdAt' | 'recipientCount'>): Promise<Airdrop> => {
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
    throw new Error(errorData.message);
  }
  
  const data = await response.json();

  // The API returns the newly created record with snake_case keys.
  const camelCaseData = convertKeysToCamelCase(data);
  
  // Convert string date to Date object and ensure numeric types are correct
  return {
    ...camelCaseData,
    totalAmount: Number(camelCaseData.totalAmount),
    createdAt: new Date(camelCaseData.createdAt),
    startTime: camelCaseData.startTime ? new Date(camelCaseData.startTime) : undefined,
    endTime: camelCaseData.endTime ? new Date(camelCaseData.endTime) : undefined,
  };
};