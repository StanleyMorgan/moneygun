// Fix: Implement the full serverless function logic for handling airdrop API requests.
// This file was previously empty, causing multiple "Cannot find name" errors.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, db } from '@vercel/postgres';
import { MerkleTree } from 'merkletreejs';
// Fix: Use `keccak256` from `viem` to avoid a separate dependency and typing issues.
import { getAddress, parseUnits, keccak256 as viemKeccak256 } from 'viem';
// Fix: Correct the import path and remove the unused 'Airdrop' type.
import { WhitelistEntry } from '../types';

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
                if (typeof airdropId !== 'string' || typeof userAddress !== 'string') {
                    return res.status(400).json({ message: 'Invalid request parameters.' });
                }

                // Fetch airdrop details to get token decimals
                const { rows: airdropDetails } = await sql`
                    SELECT token_decimals FROM airdrops WHERE id = ${Number(airdropId)};
                `;

                if (airdropDetails.length === 0) {
                    return res.status(404).json({ message: 'Airdrop not found.' });
                }
                const tokenDecimals = airdropDetails[0].token_decimals || 18;

                // Fetch the entire whitelist for the airdrop to build the Merkle tree
                const { rows: whitelistRows } = await sql`
                    SELECT user_address, amount FROM whitelist_entries WHERE airdrop_id = ${Number(airdropId)};
                `;

                if (whitelistRows.length === 0) {
                    return res.status(404).json({ message: 'No whitelist found for this airdrop.' });
                }

                const whitelist: WhitelistEntry[] = whitelistRows.map(row => ({ address: row.user_address, amount: String(row.amount) }));
                
                // Find the specific user in the whitelist
                const userEntry = whitelist.find(entry => getAddress(entry.address) === getAddress(userAddress as string));

                if (!userEntry) {
                    return res.status(404).json({ message: 'User is not eligible for this airdrop.' });
                }

                // Generate all leaves for the Merkle tree
                const leaves = whitelist.map(entry => {
                    const amountInBaseUnit = parseUnits(entry.amount, tokenDecimals);
                    return keccak256(createLeafBuffer(entry.address, amountInBaseUnit));
                });
                
                const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

                // Generate the leaf for the current user to get their proof
                const userAmountInBaseUnit = parseUnits(userEntry.amount, tokenDecimals);
                const userLeaf = keccak256(createLeafBuffer(userEntry.address, userAmountInBaseUnit));
                const proof = tree.getHexProof(userLeaf);

                // Return the amount (human-readable) and the proof
                return res.status(200).json({ amount: userEntry.amount, proof });

            } catch (error) {
                console.error('Eligibility check error:', error);
                return res.status(500).json({ message: 'Internal server error during eligibility check.' });
            }
        } else {
            // --- Get All Airdrops ---
            try {
                const { rows } = await sql`SELECT * FROM airdrops ORDER BY created_at DESC;`;
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
                
                await client.sql`BEGIN`;
                
                const { rows: airdropRows } = await client.sql`
                    INSERT INTO airdrops (
                        name, description, action, type, token_address, token_symbol, token_decimals,
                        network, total_amount, status, recipient_count, creator_address,
                        start_time, end_time, contract_address, merkle_root
                    ) VALUES (
                        ${name}, ${description || null}, ${airdropAction ? JSON.stringify(airdropAction) : null}, ${type},
                        ${tokenAddress}, ${tokenSymbol || null}, ${tokenDecimals || 18}, ${network}, ${Number(totalAmount)},
                        ${status}, ${recipientCount}, ${creatorAddress}, ${new Date(startTime).toISOString()},
                        ${new Date(endTime).toISOString()}, ${contractAddress}, ${merkleRoot}
                    ) RETURNING *;
                `;
                const createdAirdrop = airdropRows[0];
                
                if (type === 'Whitelist' && whitelist && whitelist.length > 0) {
                    for (const entry of whitelist) {
                        await client.sql`
                            INSERT INTO whitelist_entries (airdrop_id, user_address, amount)
                            VALUES (${createdAirdrop.id}, ${entry.address}, ${Number(entry.amount)});
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