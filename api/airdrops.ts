// Fix: Implement the full serverless function logic for the airdrops API.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { MerkleTree } from 'merkletreejs';
import { keccak256, parseUnits, encodePacked, getAddress, isAddress, createPublicClient, http, privateKeyToAccount } from 'viem';
import { base, baseSepolia } from 'viem/chains';

// --- UTILITIES & HELPERS ---

// Converts snake_case keys from DB to camelCase for the frontend.
const toCamelCase = (s: string) => s.replace(/_([a-z])/g, g => g[1].toUpperCase());
const convertKeysToCamelCase = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => convertKeysToCamelCase(v));
    } else if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
        return Object.keys(obj).reduce((result, key) => {
            result[toCamelCase(key)] = convertKeysToCamelCase(obj[key]);
            return result;
        }, {} as Record<string, any>);
    }
    return obj;
};

// Builds a Merkle tree from a whitelist.
const buildMerkleTree = (whitelist: { address: string; amount: string }[], tokenDecimals: number) => {
    const leaves = whitelist.map(entry => {
        const amount = parseUnits(entry.amount, tokenDecimals);
        return keccak256(encodePacked(['address', 'uint256'], [getAddress(entry.address), amount]));
    });
    return new MerkleTree(leaves, keccak256, { sortPairs: true });
};

// --- ENVIRONMENT VARIABLE CHECKS ---

const {
    VERIFIER_PRIVATE_KEY,
    BASE_RPC_URL,
    BASE_SEPOLIA_RPC_URL,
} = process.env;

if (!VERIFIER_PRIVATE_KEY) {
    throw new Error('VERIFIER_PRIVATE_KEY environment variable is not set.');
}
if (!BASE_RPC_URL || !BASE_SEPOLIA_RPC_URL) {
    throw new Error('RPC URL environment variables are not set.');
}

const account = privateKeyToAccount(VERIFIER_PRIVATE_KEY as `0x${string}`);

const publicClients: Record<string, ReturnType<typeof createPublicClient>> = {
    'base': createPublicClient({ chain: base, transport: http(BASE_RPC_URL) }),
    'base-sepolia': createPublicClient({ chain: baseSepolia, transport: http(BASE_SEPOLIA_RPC_URL) }),
};

// --- API HANDLER ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        if (req.method === 'GET') {
            await handleGet(req, res);
        } else if (req.method === 'POST') {
            await handlePost(req, res);
        } else if (req.method === 'DELETE') {
            await handleDelete(req, res);
        } else {
            res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
            res.status(405).end(`Method ${req.method} Not Allowed`);
        }
    } catch (error: any) {
        console.error('API Error:', error);
        res.status(500).json({ message: error.message || 'An internal server error occurred.' });
    }
}


// --- METHOD-SPECIFIC HANDLERS ---

async function handleGet(req: VercelRequest, res: VercelResponse) {
    const { airdropId, userAddress, action } = req.query;

    if (action === 'getVerifierAddress') {
        return res.status(200).json({ verifierAddress: account.address });
    }

    if (airdropId && userAddress && typeof userAddress === 'string' && isAddress(userAddress)) {
        // Fetch whitelist entry and generate proof
        const { rows } = await sql`
            SELECT address, amount, token_decimals FROM whitelist_entries
            JOIN airdrops ON airdrops.id = whitelist_entries.airdrop_id
            WHERE airdrop_id = ${airdropId as string} AND address = ${getAddress(userAddress)};
        `;
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User is not in the whitelist for this airdrop.' });
        }
        
        const { rows: allEntries } = await sql`SELECT address, amount FROM whitelist_entries WHERE airdrop_id = ${airdropId as string};`;
        const tree = buildMerkleTree(allEntries, rows[0].token_decimals);
        const amount = parseUnits(rows[0].amount, rows[0].token_decimals);
        const leaf = keccak256(encodePacked(['address', 'uint256'], [getAddress(userAddress), amount]));
        const proof = tree.getHexProof(leaf);

        res.status(200).json({ amount: rows[0].amount, proof });

    } else {
        // Fetch all airdrops
        const { rows } = await sql`SELECT * FROM airdrops ORDER BY created_at DESC;`;
        res.status(200).json(convertKeysToCamelCase(rows));
    }
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
    const { action, ...body } = req.body;

    switch (action) {
        case 'generateMerkle': {
            const { whitelist, tokenDecimals } = body;
            const tree = buildMerkleTree(whitelist, tokenDecimals);
            const merkleRoot = tree.getHexRoot();
            return res.status(200).json({ merkleRoot });
        }
        
        case 'updateStatus': {
            const { airdropId, newStatus, userAddress } = body;
            await sql`
                UPDATE airdrops SET status = ${newStatus} 
                WHERE id = ${airdropId} AND creator_address = ${getAddress(userAddress)};
            `;
            return res.status(200).json({ message: 'Status updated successfully.' });
        }

        case 'updateClaim': {
             // This is an off-chain optimization to track claims.
            const { airdropId, userAddress } = body;
            await sql`
                UPDATE whitelist_entries SET claimed = TRUE 
                WHERE airdrop_id = ${airdropId} AND address = ${getAddress(userAddress)};
            `;
            // Also update the claimed count on the main airdrop table
            await sql`
                UPDATE airdrops SET claimed_count = claimed_count + 1 WHERE id = ${airdropId};
            `;
            return res.status(200).json({ message: 'Claim recorded.' });
        }

        case 'verifyQuest': {
            const { airdropId, userAddress } = body;
            if (!isAddress(userAddress)) return res.status(400).json({ message: 'Invalid user address.' });

            const { rows } = await sql`SELECT * FROM airdrops WHERE id = ${airdropId};`;
            if (rows.length === 0) return res.status(404).json({ message: 'Airdrop not found.' });

            const airdrop = convertKeysToCamelCase(rows[0]);
            const publicClient = publicClients[airdrop.network];
            if (!publicClient) return res.status(400).json({ message: `Unsupported network: ${airdrop.network}` });

            // Check if user has already claimed this quest off-chain to prevent re-verification
            const { rows: claimCheck } = await sql`
                SELECT 1 FROM quest_claims WHERE airdrop_id = ${airdropId} AND user_address = ${getAddress(userAddress)};
            `;
            if (claimCheck.length > 0) return res.status(400).json({ message: 'Quest reward already claimed.' });
            
            // This is a simplified check. A real implementation would need to check block ranges against the quest timeframe.
            const logs = await publicClient.getLogs({
                address: getAddress(airdrop.targetContract),
                topics: [airdrop.topics], // Assuming topics are correctly formatted event signatures
                fromBlock: 'earliest', // Should be scoped to quest start time for performance
                toBlock: 'latest',
            });
            
            const isVerified = logs.some(log => log.topics.some(topic => (topic?.toLowerCase() ?? '') === (userAddress.toLowerCase() ?? '')));

            if (!isVerified) return res.status(403).json({ message: "Quest completion could not be verified on-chain." });

            const amount = parseUnits(String(airdrop.maxReward), airdrop.tokenDecimals);
            const questId = `0x${Buffer.from(String(airdrop.id)).toString('hex').padStart(64, '0')}` as `0x${string}`;
            
            const signature = await account.signTypedData({
              domain: {
                    name: 'MoneygunQuest',
                    version: '1',
                    chainId: publicClient.chain.id,
                    verifyingContract: getAddress(airdrop.contractAddress),
                },
                types: {
                    Claim: [
                        { name: 'user', type: 'address' },
                        { name: 'questId', type: 'bytes32' },
                        { name: 'amount', type: 'uint256' },
                    ],
                },
                primaryType: 'Claim',
                message: {
                    user: getAddress(userAddress),
                    questId: questId,
                    amount: amount,
                },
            });

            // Record the claim to prevent replay attacks on this API endpoint
            await sql`INSERT INTO quest_claims (airdrop_id, user_address) VALUES (${airdropId}, ${getAddress(userAddress)});`;
            await sql`UPDATE airdrops SET claimed_count = claimed_count + 1 WHERE id = ${airdropId};`;

            return res.status(200).json({ amount: String(airdrop.maxReward), signature });
        }

        default: {
            // Create new airdrop
            const { type, whitelist, ...airdropData } = body;
            const {
                name, description, image, tokenAddress, tokenSymbol, tokenDecimals, network,
                totalAmount, status, startTime, endTime, creatorAddress, contractAddress,
                merkleRoot, recipientCount, maxReward, targetContract, topics
            } = airdropData;

            const { rows: newAirdrop } = await sql`
                INSERT INTO airdrops (
                    name, description, image, type, token_address, token_symbol, token_decimals, network, total_amount, 
                    status, start_time, end_time, creator_address, contract_address, merkle_root, recipient_count, 
                    max_reward, target_contract, topics
                ) VALUES (
                    ${name}, ${description}, ${image || null}, ${type}, ${getAddress(tokenAddress)}, ${tokenSymbol}, ${tokenDecimals}, ${network}, ${totalAmount},
                    ${status}, ${new Date(startTime).toISOString()}, ${new Date(endTime).toISOString()}, ${getAddress(creatorAddress)}, ${getAddress(contractAddress)},
                    ${merkleRoot || null}, ${recipientCount}, ${maxReward || null}, ${targetContract ? getAddress(targetContract) : null}, ${topics ? JSON.stringify(topics) : null}
                ) RETURNING *;
            `;

            if (type === 'Whitelist' && whitelist && whitelist.length > 0) {
                const airdropId = newAirdrop[0].id;
                for (const entry of whitelist) {
                    await sql`
                        INSERT INTO whitelist_entries (airdrop_id, address, amount)
                        VALUES (${airdropId}, ${getAddress(entry.address)}, ${entry.amount});
                    `;
                }
            }
            
            return res.status(201).json(newAirdrop[0]);
        }
    }
}

async function handleDelete(req: VercelRequest, res: VercelResponse) {
    const { airdropId, userAddress } = req.body;
    
    // First, verify ownership
    const { rows } = await sql`SELECT creator_address FROM airdrops WHERE id = ${airdropId};`;
    if (rows.length === 0) {
        return res.status(404).json({ message: 'Airdrop not found.' });
    }
    if (getAddress(rows[0].creator_address) !== getAddress(userAddress)) {
        return res.status(403).json({ message: 'You are not authorized to delete this airdrop.' });
    }

    // Cascade delete is assumed to be set up in the DB for related tables like whitelist_entries.
    // If not, you'd delete from child tables first.
    await sql`DELETE FROM whitelist_entries WHERE airdrop_id = ${airdropId};`;
    await sql`DELETE FROM quest_claims WHERE airdrop_id = ${airdropId};`;
    await sql`DELETE FROM airdrops WHERE id = ${airdropId};`;
    
    res.status(200).json({ message: 'Airdrop deleted successfully.' });
}
