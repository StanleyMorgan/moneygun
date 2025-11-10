import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';
import { MerkleTree } from 'merkletreejs';
import { keccak256, parseUnits, getAddress, isAddress, pad, toHex, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia, monadTestnet } from 'viem/chains';
import { AirdropStatus, AirdropType, WhitelistEntry } from '../types';

// --- Environment Variable and Wallet Setup ---

const PRIVATE_KEY = process.env.VERIFIER_PRIVATE_KEY;
if (!PRIVATE_KEY) {
    console.error('VERIFIER_PRIVATE_KEY is not set.');
    // Avoid throwing here to allow deployment, but log error.
}

const account = PRIVATE_KEY ? privateKeyToAccount(`0x${PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY.substring(2) : PRIVATE_KEY}` as Hex) : null;
const verifierAddress = account?.address;

// Basic chain configuration map
const chainMap = {
    'base': base,
    'base-sepolia': baseSepolia,
    'monad-testnet': monadTestnet
};


// --- Helper Functions ---
const toCamelCase = (s: string) => s.replace(/_([a-z])/g, g => g[1].toUpperCase());

const convertObjectKeysToCamelCase = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => convertObjectKeysToCamelCase(v));
    } else if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
            acc[toCamelCase(key)] = convertObjectKeysToCamelCase(obj[key]);
            return acc;
        }, {} as { [key: string]: any });
    }
    return obj;
};

// --- API Route Handlers ---

/**
 * Handles GET requests to /api/airdrops
 * - Fetches all airdrops.
 * - Fetches eligibility for a specific airdrop and user.
 * - Fetches the verifier address.
 */
async function handleGet(req: VercelRequest, res: VercelResponse) {
    const { airdropId, userAddress, action } = req.query;

    if (action === 'getVerifierAddress') {
        if (!verifierAddress) {
            return res.status(500).json({ message: 'Verifier address is not configured.' });
        }
        return res.status(200).json({ verifierAddress });
    }

    if (airdropId && userAddress) {
        // Fetch eligibility for a specific user
        if (typeof airdropId !== 'string' || typeof userAddress !== 'string' || !isAddress(userAddress)) {
            return res.status(400).json({ message: 'Invalid airdropId or userAddress.' });
        }
        
        const client = await sql.connect();
        try {
            const airdropResult = await client.query('SELECT type, token_decimals FROM airdrops WHERE id = $1', [airdropId]);
            if (airdropResult.rows.length === 0) {
                return res.status(404).json({ message: 'Airdrop not found.' });
            }
            const { type, token_decimals } = airdropResult.rows[0];

            if (type === AirdropType.Whitelist) {
                const allEntriesResult = await client.query('SELECT address, amount FROM whitelist WHERE airdrop_id = $1', [airdropId]);
                
                if (allEntriesResult.rows.length === 0) {
                    return res.status(404).json({ message: 'No whitelist entries found for this airdrop.' });
                }

                const userEntry = allEntriesResult.rows.find(row => getAddress(row.address) === getAddress(userAddress as string));
                
                if (!userEntry) {
                    return res.status(404).json({ message: 'User not in whitelist.' });
                }

                const leaves = allEntriesResult.rows.map(entry => {
                    const amountInBase = parseUnits(entry.amount, token_decimals);
                    return Buffer.from(keccak256(`0x${Buffer.concat([Buffer.from(getAddress(entry.address).slice(2), 'hex'), Buffer.from(amountInBase.toString(16).padStart(64, '0'), 'hex')]).toString('hex')}`).slice(2), 'hex');
                });
                
                const merkleTree = new MerkleTree(leaves, (data: Buffer) => Buffer.from(keccak256(data).slice(2), 'hex'), { sortPairs: true });
                const userAmountInBase = parseUnits(userEntry.amount, token_decimals);
                const leaf = Buffer.from(keccak256(`0x${Buffer.concat([Buffer.from(getAddress(userAddress as string).slice(2), 'hex'), Buffer.from(userAmountInBase.toString(16).padStart(64, '0'), 'hex')]).toString('hex')}`).slice(2), 'hex');
                const proof = merkleTree.getHexProof(leaf) as Hex[];
                
                return res.status(200).json({ amount: userEntry.amount, proof });
            
            } else if (type === AirdropType.Quest) {
                const claimedResult = await client.query('SELECT 1 FROM claims WHERE airdrop_id = $1 AND user_address = $2', [airdropId, getAddress(userAddress as string)]);
                if (claimedResult.rows.length > 0) {
                     return res.status(200).json({ status: 'claimed' });
                }
                
                return res.status(404).json({ message: 'User has not attempted this quest yet.' });

            } else {
                 return res.status(400).json({ message: 'Unknown airdrop type.' });
            }
        } finally {
            client.release();
        }
    } else {
        // Fetch all airdrops
        const { rows } = await sql`
            SELECT 
                a.*,
                (SELECT COUNT(*) FROM claims c WHERE c.airdrop_id = a.id) as claimed_count
            FROM airdrops a 
            ORDER BY a.created_at DESC;
        `;
        return res.status(200).json(convertObjectKeysToCamelCase(rows));
    }
}


/**
 * Handles POST requests to /api/airdrops
 * - Creates a new airdrop.
 * - Updates airdrop status.
 * - Records a user claim.
 * - Verifies a quest for a user.
 */
async function handlePost(req: VercelRequest, res: VercelResponse) {
    const { action } = req.body;
    
    if (action) {
        // Handle specific actions
        const { airdropId, userAddress } = req.body;
        if (!airdropId || !userAddress || !isAddress(userAddress)) {
            return res.status(400).json({ message: "Missing airdropId or invalid userAddress" });
        }
        
        switch (action) {
            case 'updateStatus': {
                const { newStatus } = req.body;
                 if (!Object.values(AirdropStatus).includes(newStatus)) {
                    return res.status(400).json({ message: 'Invalid status provided.' });
                }
                await sql`UPDATE airdrops SET status = ${newStatus} WHERE id = ${airdropId} AND creator_address = ${getAddress(userAddress)}`;
                return res.status(200).json({ message: 'Status updated successfully.' });
            }
            case 'updateClaim': {
                // Check if already claimed to prevent double counting
                const { rows } = await sql`SELECT 1 FROM claims WHERE airdrop_id = ${airdropId} AND user_address = ${getAddress(userAddress)}`;
                if (rows.length === 0) {
                    await sql`INSERT INTO claims (airdrop_id, user_address) VALUES (${airdropId}, ${getAddress(userAddress)});`;
                    // This atomic increment is safer
                }
                return res.status(200).json({ message: 'Claim recorded.' });
            }
            case 'verifyQuest': {
                if (!account) return res.status(500).json({ message: 'Verifier not configured.' });

                const airdropResult = await sql`SELECT max_reward, token_decimals, network, contract_address FROM airdrops WHERE id = ${airdropId}`;
                if (airdropResult.rows.length === 0) return res.status(404).json({ message: 'Airdrop not found.' });

                const { max_reward, token_decimals, network, contract_address } = airdropResult.rows[0];
                const amountInBaseUnits = parseUnits(String(max_reward), token_decimals);

                const questIdBytes32 = pad(toHex(airdropId), { size: 32 });

                const message = {
                    user: getAddress(userAddress),
                    amount: amountInBaseUnits,
                    questId: questIdBytes32,
                };
                const domain = {
                    name: 'QuestAirdrop',
                    version: '1',
                    chainId: chainMap[network as keyof typeof chainMap].id,
                    verifyingContract: getAddress(contract_address)
                };
                const types = {
                    Claim: [
                        { name: 'user', type: 'address' },
                        { name: 'amount', type: 'uint256' },
                        { name: 'questId', type: 'bytes32' },
                    ],
                };
                
                const signature = await account.signTypedData({ domain, types, primaryType: 'Claim', message });

                return res.status(200).json({ amount: String(max_reward), signature });
            }
            default:
                return res.status(400).json({ message: 'Invalid action.' });
        }
    } else {
        // Create new airdrop
        const client = await sql.connect();
        try {
            await client.query('BEGIN');
            const { name, description, network, type, tokenAddress, tokenSymbol, tokenDecimals, totalAmount, recipientCount, creatorAddress, startTime, endTime, whitelist, contractAddress, questTitle, questUrl, maxReward, userTopicIndex, questDescription } = req.body;
            
            let merkleRoot = null;
            if (type === AirdropType.Whitelist) {
                if (!whitelist || !Array.isArray(whitelist) || whitelist.length === 0) {
                    throw new Error("Whitelist is required for this airdrop type.");
                }
                const leaves = whitelist.map((entry: WhitelistEntry) => {
                    const amountInBase = parseUnits(entry.amount, tokenDecimals);
                    return Buffer.from(keccak256(`0x${Buffer.concat([Buffer.from(getAddress(entry.address).slice(2), 'hex'), Buffer.from(amountInBase.toString(16).padStart(64, '0'), 'hex')]).toString('hex')}`).slice(2), 'hex');
                });
                const merkleTree = new MerkleTree(leaves, (data: Buffer) => Buffer.from(keccak256(data).slice(2), 'hex'), { sortPairs: true });
                merkleRoot = merkleTree.getHexRoot();
            }

            const airdropResult = await client.query(
                `INSERT INTO airdrops (name, description, network, type, status, token_address, token_symbol, token_decimals, total_amount, recipient_count, creator_address, start_time, end_time, merkle_root, contract_address, quest_title, quest_description, quest_url, max_reward, user_topic_index)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                 RETURNING *;`,
                [name, description, network, type, AirdropStatus.Draft, getAddress(tokenAddress), tokenSymbol, tokenDecimals, totalAmount, recipientCount, getAddress(creatorAddress), startTime || null, endTime || null, merkleRoot, contractAddress, questTitle, questDescription, questUrl, maxReward, userTopicIndex]
            );
            const newAirdrop = airdropResult.rows[0];

            if (type === AirdropType.Whitelist && whitelist) {
                // Here we pre-calculate and store proofs.
                const leaves = whitelist.map((entry: WhitelistEntry) => {
                    const amountInBase = parseUnits(entry.amount, tokenDecimals);
                    return Buffer.from(keccak256(`0x${Buffer.concat([Buffer.from(getAddress(entry.address).slice(2), 'hex'), Buffer.from(amountInBase.toString(16).padStart(64, '0'), 'hex')]).toString('hex')}`).slice(2), 'hex');
                });
                const merkleTree = new MerkleTree(leaves, (data: Buffer) => Buffer.from(keccak256(data).slice(2), 'hex'), { sortPairs: true });

                for (const entry of whitelist) {
                    const amountInBase = parseUnits(entry.amount, tokenDecimals);
                    const leaf = Buffer.from(keccak256(`0x${Buffer.concat([Buffer.from(getAddress(entry.address).slice(2), 'hex'), Buffer.from(amountInBase.toString(16).padStart(64, '0'), 'hex')]).toString('hex')}`).slice(2), 'hex');
                    const proof = merkleTree.getHexProof(leaf);
                    
                    await client.query(
                        'INSERT INTO whitelist (airdrop_id, address, amount, proof) VALUES ($1, $2, $3, $4)',
                        [newAirdrop.id, getAddress(entry.address), entry.amount, JSON.stringify(proof)]
                    );
                }
            }
            
            await client.query('COMMIT');
            res.status(201).json(convertObjectKeysToCamelCase(newAirdrop));
        } catch (error: any) {
            await client.query('ROLLBACK');
            console.error('Failed to create airdrop:', error);
            res.status(500).json({ message: error.message || 'Internal server error.' });
        } finally {
            client.release();
        }
    }
}


/**
 * Handles DELETE requests to /api/airdrops
 */
async function handleDelete(req: VercelRequest, res: VercelResponse) {
    const { airdropId, userAddress } = req.body;
    if (!airdropId || !userAddress || !isAddress(userAddress)) {
        return res.status(400).json({ message: 'Missing airdropId or invalid userAddress.' });
    }

    const client = await sql.connect();
    try {
        await client.query('BEGIN');
        // Optional: Check if the user is the creator
        const airdrop = await client.query('SELECT creator_address FROM airdrops WHERE id = $1', [airdropId]);
        if (airdrop.rows.length === 0 || getAddress(airdrop.rows[0].creator_address) !== getAddress(userAddress)) {
            return res.status(403).json({ message: "Forbidden: You are not the owner of this airdrop." });
        }
        
        // Delete associated data first
        await client.query('DELETE FROM whitelist WHERE airdrop_id = $1', [airdropId]);
        await client.query('DELETE FROM claims WHERE airdrop_id = $1', [airdropId]);
        
        // Delete the airdrop itself
        const result = await client.query('DELETE FROM airdrops WHERE id = $1', [airdropId]);
        
        await client.query('COMMIT');

        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Airdrop not found." });
        }

        res.status(200).json({ message: 'Airdrop deleted successfully.' });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Failed to delete airdrop:', error);
        res.status(500).json({ message: error.message || 'Failed to delete airdrop.' });
    } finally {
        client.release();
    }
}


// --- Main Handler ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        switch (req.method) {
            case 'GET':
                return await handleGet(req, res);
            case 'POST':
                return await handlePost(req, res);
            case 'DELETE':
                return await handleDelete(req, res);
            default:
                res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
                return res.status(405).end(`Method ${req.method} Not Allowed`);
        }
    } catch (error: any) {
        console.error('API Handler Error:', error);
        return res.status(500).json({ message: 'An unexpected error occurred.', error: error.message });
    }
}