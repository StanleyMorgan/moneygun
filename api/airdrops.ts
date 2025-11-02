
import { VercelRequest, VercelResponse } from '@vercel/node';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { getAddress, parseUnits, encodePacked, keccak256, Hex } from 'viem';

// --- TYPES ---

// Add AirdropStatus enum to be used in the payload
enum AirdropStatus {
    Draft = 'Draft',
    InProgress = 'In Progress',
    Completed = 'Completed',
    Failed = 'Failed',
}

interface WhitelistEntry {
  address: string;
  amount: string;
}

interface CreateAirdropPayload {
  name: string;
  description?: string;
  action?: { text: string; url: string };
  type: 'Whitelist' | 'Quest';
  tokenAddress: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  network?: string;
  totalAmount: number;
  creatorAddress: string;
  startTime?: string;
  endTime?: string;
  whitelist?: WhitelistEntry[];
  contractAddress?: string;
  merkleRoot?: string;
  status: AirdropStatus; // Add status to payload
}

// --- MERKLE TREE LOGIC ---
const buildMerkleTree = (leaves: Hex[]): { root: Hex; proofs: Record<string, Hex[]> } => {
    if (leaves.length === 0) return { root: '0x0000000000000000000000000000000000000000000000000000000000000000', proofs: {} };

    const finalProofs: Record<string, Hex[]> = {};
    leaves.forEach(leaf => {
        let currentHash = leaf;
        const proof: Hex[] = [];
        let currentLayer = leaves;

        while (currentLayer.length > 1) {
            const newLayer: Hex[] = [];
            const currentLayerPairs: [Hex, Hex][] = [];

            for (let i = 0; i < currentLayer.length; i += 2) {
                const left = currentLayer[i];
                const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left;
                currentLayerPairs.push([left, right]);
                const sortedPair = [left, right].sort();
                newLayer.push(keccak256(encodePacked(['bytes32', 'bytes32'], [sortedPair[0], sortedPair[1]])));
            }
            
            let found = false;
            for (const pair of currentLayerPairs) {
                if(pair[0] === currentHash) {
                    proof.push(pair[1]);
                    currentHash = newLayer[currentLayerPairs.indexOf(pair)];
                    found = true;
                    break;
                }
                if(pair[1] === currentHash && pair[0] !== pair[1]) {
                    proof.push(pair[0]);
                    currentHash = newLayer[currentLayerPairs.indexOf(pair)];
                    found = true;
                    break;
                }
            }
            if (!found && currentLayer.length > 1) {
                 const pair = currentLayerPairs.find(p => p[0] === currentHash || p[1] === currentHash);
                 if (pair) {
                    currentHash = newLayer[currentLayerPairs.indexOf(pair)];
                 }
            }
            currentLayer = newLayer;
        }
        finalProofs[leaf] = proof;
    });

    let nodes = leaves;
    while (nodes.length > 1) {
        const newNodes: Hex[] = [];
        for (let i = 0; i < nodes.length; i += 2) {
            const left = nodes[i];
            const right = i + 1 < nodes.length ? nodes[i+1] : left;
            const sorted = [left, right].sort();
            newNodes.push(keccak256(encodePacked(['bytes32', 'bytes32'], [sorted[0], sorted[1]])));
        }
        nodes = newNodes;
    }

    return { root: nodes[0], proofs: finalProofs };
};


// --- API HANDLER ROUTER ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (!process.env.POSTGRES_URL) {
        return res.status(500).json({ message: "Database connection string is not configured." });
    }
    const sql = neon(process.env.POSTGRES_URL);

    try {
        if (req.method === 'GET') {
            await handleGet(req, res, sql);
        } else if (req.method === 'POST') {
            const { action } = req.body;
            if (action === 'generateMerkle') {
                await handleGenerateMerkle(req, res);
            } else if (action === 'updateClaim') {
                await handleUpdateClaim(req, res, sql);
            } else {
                await handleCreateAirdrop(req, res, sql);
            }
        } else {
            res.setHeader('Allow', ['GET', 'POST']);
            res.status(405).end(`Method ${req.method} Not Allowed`);
        }
    } catch (error) {
        console.error('API Handler Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred.';
        return res.status(500).json({ message: 'Internal Server Error', error: errorMessage });
    }
}

// --- GET HANDLER ---
async function handleGet(req: VercelRequest, res: VercelResponse, sql: NeonQueryFunction<false, false>) {
    const { airdropId, userAddress } = req.query;
    if (airdropId && userAddress) {
        const entry = await sql`
            SELECT amount, proof, claimed FROM whitelist_entries 
            WHERE airdrop_id = ${Number(airdropId as string)} AND user_address = ${getAddress(userAddress as string)}
        `;
        if (entry.length > 0) {
            if (entry[0].claimed) {
                 return res.status(409).json({ message: 'Already claimed.' });
            }
            return res.status(200).json({ amount: entry[0].amount, proof: entry[0].proof });
        }
        return res.status(404).json({ message: 'User not found in whitelist.' });
    }
    const airdrops = await sql`SELECT * FROM airdrops ORDER BY created_at DESC`;
    return res.status(200).json(airdrops);
}


// --- POST HANDLERS ---
async function handleGenerateMerkle(req: VercelRequest, res: VercelResponse) {
    const { whitelist, tokenDecimals } = req.body;
    if (!whitelist || !Array.isArray(whitelist) || whitelist.length === 0) {
        return res.status(400).json({ message: 'Whitelist data is required.' });
    }
    try {
        const leaves = whitelist.map((entry: WhitelistEntry) =>
            keccak256(encodePacked(['address', 'uint256'], [getAddress(entry.address), parseUnits(entry.amount, tokenDecimals || 18)]))
        );
        const { root } = buildMerkleTree(leaves);
        return res.status(200).json({ merkleRoot: root });
    } catch (e) {
        console.error("Merkle generation error:", e);
        return res.status(500).json({ message: "Failed to generate Merkle root." });
    }
}

async function handleUpdateClaim(req: VercelRequest, res: VercelResponse, sql: NeonQueryFunction<false, false>) {
    const { airdropId, userAddress } = req.body;
    if (!airdropId || !userAddress) {
        return res.status(400).json({ message: 'Airdrop ID and user address are required.' });
    }
    try {
        const result = await sql`
            UPDATE whitelist_entries
            SET claimed = true, claimed_at = NOW()
            WHERE airdrop_id = ${airdropId} AND user_address = ${getAddress(userAddress as string)} AND claimed = false
            RETURNING id;
        `;
        if (result.length === 0) {
            return res.status(404).json({ message: 'Claim entry not found or already claimed.' });
        }
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Failed to update claim status:', error);
        return res.status(500).json({ message: 'Failed to update claim status.' });
    }
}

async function handleCreateAirdrop(req: VercelRequest, res: VercelResponse, sql: NeonQueryFunction<false, false>) {
    const body = req.body as CreateAirdropPayload;
    const { name, description, action, type, tokenAddress, tokenSymbol, tokenDecimals, network, totalAmount, creatorAddress, startTime, endTime, whitelist, contractAddress, merkleRoot, status } = body;
    
    if (!name || !type || !tokenAddress || totalAmount === undefined || !creatorAddress || !startTime || !endTime || !status) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    
    let recipientCount = 0;
    
    if (type === 'Whitelist') {
        if (!whitelist || whitelist.length === 0) return res.status(400).json({ message: 'Whitelist is required.' });
        if (!contractAddress || !merkleRoot) return res.status(400).json({ message: 'Contract address and Merkle root are required.' });

        recipientCount = whitelist.length;
        const leaves = whitelist.map(entry => 
            keccak256(encodePacked(['address', 'uint256'], [getAddress(entry.address), parseUnits(entry.amount, tokenDecimals || 18)]))
        );
        const { root: calculatedRoot } = buildMerkleTree(leaves);
        
        if (calculatedRoot !== merkleRoot) {
            console.error('Merkle root mismatch!', { fromFrontend: merkleRoot, calculated: calculatedRoot });
            return res.status(400).json({ message: 'Merkle root mismatch. Data integrity check failed.' });
        }
    }

    const actionJson = action ? JSON.stringify(action) : null;
    // Fix: Cast the async transaction function to `any` to work around a typing issue in `@neondatabase/serverless`
    // where the types do not correctly reflect support for async transaction callbacks.
    const [newAirdrop] = await sql.transaction((async (tx) => {
        const [insertedAirdrop] = await tx`
            INSERT INTO airdrops (
                name, description, action, type, token_address, token_symbol, token_decimals, network,
                total_amount, recipient_count, creator_address,
                start_time, end_time, created_at, contract_address, merkle_root, status
            ) VALUES (
                ${name}, ${description || null}, ${actionJson}, ${type}, ${tokenAddress}, 
                ${tokenSymbol || null}, ${tokenDecimals || 18}, ${network || null},
                ${totalAmount}, ${recipientCount}, ${creatorAddress},
                ${startTime || null}, ${endTime || null}, NOW(),
                ${contractAddress || null}, ${merkleRoot || null}, ${status}
            ) RETURNING *;
        `;

        if (type === 'Whitelist' && whitelist) {
            // Fix: Corrected typo from `keccak2d56` to `keccak256`.
            const leaves = whitelist.map(entry => 
                keccak256(encodePacked(['address', 'uint256'], [getAddress(entry.address), parseUnits(entry.amount, tokenDecimals || 18)]))
            );
            const { proofs } = buildMerkleTree(leaves);
            for (let i = 0; i < whitelist.length; i++) {
                const entry = whitelist[i];
                const leaf = leaves[i];
                const proof = proofs[leaf] || [];
                await tx`
                    INSERT INTO whitelist_entries (airdrop_id, user_address, amount, proof)
                    VALUES (${insertedAirdrop.id}, ${getAddress(entry.address)}, ${entry.amount}, ${JSON.stringify(proof)})
                `;
            }
        }
        return [insertedAirdrop];
    }) as any);

    return res.status(201).json(newAirdrop);
}