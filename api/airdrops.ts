// Fix: Implement the full serverless function logic for handling airdrop API requests.
// This file was previously empty, causing multiple "Cannot find name" errors.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, db } from '@vercel/postgres';
import { MerkleTree } from 'merkletreejs';
// Fix: Use `keccak256` from `viem` to avoid a separate dependency and typing issues.
// Fix: Import 'isAddress' from viem to validate wallet addresses.
import { getAddress, parseUnits, keccak256 as viemKeccak256, isAddress } from 'viem';
// Fix: Correct the import path and remove the unused 'Airdrop' type.
import { WhitelistEntry } from '../types';
// Fix: Import `Buffer` to resolve "Cannot find name 'Buffer'" errors in Node.js context.
import { Buffer } from 'buffer';

// Fix: Add a wrapper for viem's keccak256 to return a Buffer, which is expected by `merkletreejs`.
const keccak256 = (data: Buffer): Buffer => Buffer.from(viemKeccak256(data, 'bytes'));

/**
 * Creates a buffer for a leaf node in the Merkle tree.
 * The encoding here MUST match the encoding done in the smart contract.
 * Typically, this is `abi.encodePacked(address, uint256)`.
 * @param address The recipient's wallet address.
 * @param amount The token amount in its smallest unit (e.g., wei).
 * @returns A Buffer representing the packed data.
 */
const createLeafBuffer = (address: string, amount: bigint): Buffer => {
    return Buffer.concat([
        Buffer.from(getAddress(address).substring(2), 'hex'),
        Buffer.from(amount.toString(16).padStart(64, '0'), 'hex')
    ]);
};

// Vercel Serverless Function Handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET') {
        const { airdropId, userAddress } = req.query;

        // --- Eligibility Check for a specific user and airdrop ---
        if (airdropId && userAddress) {
            try {
                if (typeof airdropId !== 'string' || typeof userAddress !== 'string' || !isAddress(userAddress)) {
                    return res.status(400).json({ message: 'Invalid request parameters.' });
                }

                // Fetch the specific user's entry, which now includes the pre-calculated proof
                const { rows: userEntries } = await sql`
                    SELECT amount, proof FROM whitelist_entries 
                    WHERE airdrop_id = ${Number(airdropId)} AND user_address = ${getAddress(userAddress)};
                `;

                if (userEntries.length === 0) {
                    return res.status(404).json({ message: 'User is not eligible for this airdrop.' });
                }
                
                const userEntry = userEntries[0];

                // The proof is stored as a JSON string array. It needs to be returned as a parsed object.
                const proof = typeof userEntry.proof === 'string' ? JSON.parse(userEntry.proof) : userEntry.proof;

                return res.status(200).json({ amount: String(userEntry.amount), proof });

            } catch (error) {
                console.error('Eligibility check error:', error);
                return res.status(500).json({ message: 'Internal server error during eligibility check.' });
            }
        } else {
            // --- Get All Airdrops ---
            try {
                // This query now joins with whitelist_entries to get the max reward and claimed count for each airdrop.
                const { rows } = await sql`
                    SELECT
                        a.*,
                        MAX(we.amount) as max_reward,
                        COUNT(we.claimed) FILTER (WHERE we.claimed = true) as claimed_count
                    FROM
                        airdrops a
                    LEFT JOIN
                        whitelist_entries we ON a.id = we.airdrop_id
                    GROUP BY
                        a.id
                    ORDER BY
                        a.created_at DESC;
                `;
                return res.status(200).json(rows);
            } catch (error) {
                console.error('Fetch airdrops error:', error);
                return res.status(500).json({ message: 'Failed to fetch airdrops.' });
            }
        }
    } else if (req.method === 'POST') {
        const { action } = req.body;

        // --- Generate Merkle Root ---
        if (action === 'generateMerkle') {
            try {
                const { whitelist, tokenDecimals = 18 } = req.body;
                if (!whitelist || !Array.isArray(whitelist) || whitelist.length === 0) {
                    return res.status(400).json({ message: 'Valid whitelist data is required.' });
                }

                const leaves = whitelist.map((entry: WhitelistEntry) => {
                     const amountInBaseUnit = parseUnits(entry.amount, tokenDecimals);
                     return keccak256(createLeafBuffer(entry.address, amountInBaseUnit));
                });

                const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
                const root = tree.getHexRoot();

                return res.status(200).json({ merkleRoot: root });
            } catch (error) {
                console.error('Merkle generation error:', error);
                const message = error instanceof Error ? error.message : 'Failed to generate Merkle root.';
                return res.status(500).json({ message });
            }
        } 
        // --- Update Claim Status (for off-chain tracking) ---
        else if (action === 'updateClaim') {
            try {
                const { airdropId, userAddress } = req.body;
                if (!airdropId || !userAddress) {
                    return res.status(400).json({ message: 'Missing airdropId or userAddress for claim update.' });
                }

                await sql`
                    UPDATE whitelist_entries
                    SET claimed = true, claimed_at = NOW()
                    WHERE airdrop_id = ${airdropId} AND user_address = ${userAddress};
                `;
                
                console.log(`Claim recorded for user ${userAddress} on airdrop ${airdropId}`);
                return res.status(200).json({ message: 'Claim updated successfully.' });
            } catch (error) {
                console.error('Claim update error:', error);
                return res.status(500).json({ message: 'Failed to update claim status.' });
            }
        
        }
        // --- Update Airdrop Status ---
        else if (action === 'updateStatus') {
            try {
                const { airdropId, newStatus, userAddress } = req.body;

                if (!airdropId || !newStatus || !userAddress) {
                    return res.status(400).json({ message: 'Missing required parameters for status update.' });
                }
                if (newStatus !== 'Draft' && newStatus !== 'Active') {
                    return res.status(400).json({ message: 'Invalid status provided. Must be "Draft" or "Active".' });
                }
                if (!isAddress(userAddress)) {
                    return res.status(400).json({ message: 'Invalid user address provided.' });
                }

                const { rows } = await sql`SELECT creator_address FROM airdrops WHERE id = ${Number(airdropId)}`;
                if (rows.length === 0) {
                    return res.status(404).json({ message: 'Airdrop not found.' });
                }

                if (getAddress(rows[0].creator_address) !== getAddress(userAddress)) {
                    return res.status(403).json({ message: 'Only the airdrop creator can change the status.' });
                }

                await sql`
                    UPDATE airdrops 
                    SET status = ${newStatus}
                    WHERE id = ${Number(airdropId)};
                `;
                
                return res.status(200).json({ message: 'Status updated successfully.' });

            } catch (error) {
                console.error('Airdrop status update error:', error);
                const message = error instanceof Error ? error.message : 'Failed to update airdrop status.';
                return res.status(500).json({ message });
            }
        }
        // --- Create Airdrop ---
        else {
            const client = await db.connect();
            try {
                const {
                    name, description, action: airdropAction, type, tokenAddress,
                    tokenSymbol, tokenDecimals, network, totalAmount, status,
                    creatorAddress, startTime, endTime, whitelist,
                    contractAddress, merkleRoot
                } = req.body;

                if (!name || !type || !tokenAddress || !totalAmount || !creatorAddress || !startTime || !endTime || !contractAddress || !merkleRoot) {
                    return res.status(400).json({ message: 'Missing required airdrop fields for creation.' });
                }
                
                const recipientCount = whitelist ? whitelist.length : 0;
                
                // Pre-build the Merkle tree to generate proofs for each entry.
                const tokenDecimalsForProof = tokenDecimals || 18;
                const leaves = whitelist.map((entry: WhitelistEntry) => {
                     const amountInBaseUnit = parseUnits(entry.amount, tokenDecimalsForProof);
                     return keccak256(createLeafBuffer(entry.address, amountInBaseUnit));
                });
                const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
                
                await client.sql`BEGIN`;
                
                const { rows: airdropRows } = await client.sql`
                    INSERT INTO airdrops (
                        name, description, action, type, token_address, token_symbol, token_decimals,
                        network, total_amount, status, recipient_count, creator_address,
                        start_time, end_time, contract_address, merkle_root, created_at
                    ) VALUES (
                        ${name}, ${description || null}, ${airdropAction ? JSON.stringify(airdropAction) : null}, ${type},
                        ${tokenAddress}, ${tokenSymbol || null}, ${tokenDecimals || 18}, ${network}, ${Number(totalAmount)},
                        ${status}, ${recipientCount}, ${creatorAddress}, ${new Date(startTime).toISOString()},
                        ${new Date(endTime).toISOString()}, ${contractAddress}, ${merkleRoot}, NOW()
                    ) RETURNING *;
                `;
                const createdAirdrop = airdropRows[0];
                
                if (type === 'Whitelist' && whitelist && whitelist.length > 0) {
                    for (const entry of whitelist) {
                        const amountInBaseUnit = parseUnits(entry.amount, tokenDecimalsForProof);
                        const leaf = keccak256(createLeafBuffer(entry.address, amountInBaseUnit));
                        const proof = tree.getHexProof(leaf);

                        await client.sql`
                            INSERT INTO whitelist_entries (airdrop_id, user_address, amount, proof)
                            VALUES (${createdAirdrop.id}, ${entry.address}, ${Number(entry.amount)}, ${JSON.stringify(proof)});
                        `;
                    }
                }
                await client.sql`COMMIT`;
                return res.status(201).json(createdAirdrop);

            } catch (error) {
                await client.sql`ROLLBACK`;
                console.error('Airdrop creation error:', error);
                const message = error instanceof Error ? error.message : 'Failed to create airdrop.';
                return res.status(500).json({ message });
            } finally {
                client.release();
            }
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}