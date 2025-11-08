import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, db } from '@vercel/postgres';
import { MerkleTree } from 'merkletreejs';
import { getAddress, parseUnits, keccak256 as viemKeccak256, isAddress, encodePacked, toHex, pad, createPublicClient, http, Hex, GetLogsParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { WhitelistEntry } from '../types';
import { Buffer } from 'buffer';

// Fix: Add a wrapper for viem's keccak256 to return a Buffer, which is expected by `merkletreejs`.
const keccak256 = (data: Buffer): Buffer => Buffer.from(viemKeccak256(data, 'bytes'));

const createLeafBuffer = (address: string, amount: bigint): Buffer => {
    return Buffer.concat([
        Buffer.from(getAddress(address).substring(2), 'hex'),
        Buffer.from(amount.toString(16).padStart(64, '0'), 'hex')
    ]);
};

// This is a placeholder for your secure signature generation logic.
// In a real application, the verifier private key must be stored securely (e.g., Vercel Environment Variables).
const signQuestData = async (userAddress: string, questId: number, amount: string, decimals: number) => {
    const verifierPrivateKey = process.env.VERIFIER_PRIVATE_KEY as `0x${string}` | undefined;
    if (!verifierPrivateKey) {
        throw new Error('Verifier key is not configured on the server.');
    }
    const account = privateKeyToAccount(verifierPrivateKey);
    const amountInBase = parseUnits(amount, decimals);
    const questIdBytes32 = pad(toHex(questId), { size: 32 });

    // The hash must match exactly what the smart contract expects.
    const messageHash = viemKeccak256(
        encodePacked(
            ['address', 'bytes32', 'uint256'],
            [getAddress(userAddress), questIdBytes32, amountInBase]
        )
    );
    
    // Sign the Eth-prefixed hash, which is what `toEthSignedMessageHash` does.
    // viem's `signMessage({ message: { raw: ... } })` handles this internally.
    const signature = await account.signMessage({ message: { raw: messageHash }});

    return signature;
}


// Vercel Serverless Function Handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET') {
        const { airdropId, userAddress, action } = req.query;

        // --- Get Public Verifier Address ---
        if (action === 'getVerifierAddress') {
            const verifierAddress = process.env.VERIFIER_ADDRESS as `0x${string}` | undefined;
            if (!verifierAddress) {
                return res.status(500).json({ message: 'Verifier address is not configured on the server.' });
            }
            return res.status(200).json({ verifierAddress });
        }

        // --- Eligibility Check for a specific user and airdrop ---
        if (airdropId && userAddress) {
             try {
                if (typeof airdropId !== 'string' || typeof userAddress !== 'string' || !isAddress(userAddress)) {
                    return res.status(400).json({ message: 'Invalid request parameters.' });
                }

                // Check airdrop type first
                const { rows: airdropTypeRows } = await sql`SELECT type FROM airdrops WHERE id = ${Number(airdropId)}`;
                if (airdropTypeRows.length === 0) return res.status(404).json({ message: 'Airdrop not found.' });

                if (airdropTypeRows[0].type === 'Whitelist') {
                    const { rows: userEntries } = await sql`
                        SELECT amount, proof FROM whitelist_entries 
                        WHERE airdrop_id = ${Number(airdropId)} AND user_address = ${getAddress(userAddress as string)};
                    `;

                    if (userEntries.length === 0) return res.status(404).json({ message: 'User is not eligible for this airdrop.' });
                    
                    const userEntry = userEntries[0];
                    const proof = typeof userEntry.proof === 'string' ? JSON.parse(userEntry.proof) : userEntry.proof;

                    return res.status(200).json({ amount: String(userEntry.amount), proof });
                } else {
                    // TODO: Implement logic to get Quest status from `quest_entries` table
                    // For now, returning a placeholder for demonstration
                    return res.status(200).json({ status: 'pending' });
                }

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
                        COUNT(we.claimed) FILTER (WHERE we.claimed = true) as claimed_count
                    FROM
                        airdrops a
                    LEFT JOIN
                        whitelist_entries we ON a.id = we.airdrop_id AND a.type = 'Whitelist'
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

        if (action === 'generateMerkle') {
             try {
                const { whitelist, tokenDecimals = 18 } = req.body;
                if (!whitelist || !Array.isArray(whitelist) || whitelist.length === 0) return res.status(400).json({ message: 'Valid whitelist data is required.' });
                const leaves = whitelist.map((entry: WhitelistEntry) => keccak256(createLeafBuffer(entry.address, parseUnits(entry.amount, tokenDecimals))));
                const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
                return res.status(200).json({ merkleRoot: tree.getHexRoot() });
            } catch (error) {
                console.error('Merkle generation error:', error);
                return res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to generate Merkle root.' });
            }
        } 
        else if (action === 'verifyQuest') {
            try {
                const { airdropId, userAddress } = req.body;
                if (!airdropId || !userAddress || !isAddress(userAddress)) return res.status(400).json({ message: 'Missing airdropId or userAddress.' });

                const alchemyApiKey = process.env.ALCHEMY_API_KEY;
                if (!alchemyApiKey) {
                    throw new Error('Alchemy API key is not configured on the server.');
                }

                // Fix: Added `contract_address` to the query to make it available for the `getLogs` call.
                const { rows: airdropRows } = await sql`SELECT network, topics, max_reward, token_decimals, contract_address FROM airdrops WHERE id = ${airdropId}`;
                if (airdropRows.length === 0) return res.status(404).json({ message: 'Airdrop not found.' });
                
                const airdrop = airdropRows[0];
                if (!airdrop.contract_address) {
                    return res.status(400).json({ message: 'Airdrop contract address is missing.' });
                }
                const chain = airdrop.network === 'base' ? base : baseSepolia;
                const rpcUrl = `https://${airdrop.network === 'base' ? 'base-mainnet' : 'base-sepolia'}.g.alchemy.com/v2/${alchemyApiKey}`;
                
                const client = createPublicClient({
                    chain: chain,
                    transport: http(rpcUrl),
                });
                
                const paddedUserAddress = pad(getAddress(userAddress), { size: 32 });
                const airdropTopics = JSON.parse(airdrop.topics) as Hex[];

                // Fix: Explicitly type the parameters for `getLogs` to resolve a TypeScript type inference issue.
                // Added the required `address` property to the log parameters, which was the root cause of the error.
                // FIX: Removed explicit GetLogsParameters type to allow TypeScript to correctly infer the type from the object literal.
                const logParams = {
                    address: getAddress(airdrop.contract_address),
                    topics: [airdropTopics, null, paddedUserAddress],
                    fromBlock: BigInt(0),
                };
                const logs = await client.getLogs(logParams);

                const isQuestCompleted = logs.length > 0;

                if (!isQuestCompleted) return res.status(400).json({ message: 'Quest completion event not found on-chain.' });

                const amount = String(airdrop.max_reward);
                const signature = await signQuestData(userAddress, airdropId, amount, airdrop.token_decimals);

                // TODO: Insert a record into a `quest_entries` table to prevent re-verification.
                // await sql`INSERT INTO quest_entries (airdrop_id, user_address, status) VALUES (${airdropId}, ${userAddress}, 'verified')`;

                return res.status(200).json({ amount, signature });
            } catch (error) {
                 console.error('Quest verification error:', error);
                return res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to verify quest.' });
            }
        }
        else if (action === 'updateClaim') {
             try {
                const { airdropId, userAddress } = req.body;
                if (!airdropId || !userAddress) return res.status(400).json({ message: 'Missing airdropId or userAddress for claim update.' });
                await sql`UPDATE whitelist_entries SET claimed = true, claimed_at = NOW() WHERE airdrop_id = ${airdropId} AND user_address = ${userAddress};`;
                return res.status(200).json({ message: 'Claim updated successfully.' });
            } catch (error) {
                console.error('Claim update error:', error);
                return res.status(500).json({ message: 'Failed to update claim status.' });
            }
        }
        else if (action === 'updateStatus') {
            try {
                const { airdropId, newStatus, userAddress } = req.body;
                if (!airdropId || !newStatus || !userAddress || !isAddress(userAddress)) return res.status(400).json({ message: 'Missing required parameters.' });
                if (newStatus !== 'Draft' && newStatus !== 'Active') return res.status(400).json({ message: 'Invalid status provided.' });

                const { rows } = await sql`SELECT creator_address FROM airdrops WHERE id = ${Number(airdropId)}`;
                if (rows.length === 0) return res.status(404).json({ message: 'Airdrop not found.' });
                if (getAddress(rows[0].creator_address) !== getAddress(userAddress)) return res.status(403).json({ message: 'Only the airdrop creator can change the status.' });

                await sql`UPDATE airdrops SET status = ${newStatus} WHERE id = ${Number(airdropId)};`;
                return res.status(200).json({ message: 'Status updated successfully.' });
            } catch (error) {
                console.error('Airdrop status update error:', error);
                return res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to update airdrop status.' });
            }
        }
        else { // Create Airdrop
            const client = await db.connect();
            try {
                const { type } = req.body;
                await client.sql`BEGIN`;
                let createdAirdrop;

                if (type === 'Whitelist') {
                    const { name, description, image, tokenAddress, tokenSymbol, tokenDecimals, network, totalAmount, status, creatorAddress, startTime, endTime, whitelist, contractAddress, merkleRoot, recipientCount } = req.body;
                    if (!name || !tokenAddress || !totalAmount || !creatorAddress || !startTime || !endTime || !contractAddress || !merkleRoot) return res.status(400).json({ message: 'Missing required fields for Whitelist airdrop.' });
                    
                    const { rows } = await client.sql`
                        INSERT INTO airdrops (name, description, image, type, token_address, token_symbol, token_decimals, network, total_amount, status, recipient_count, creator_address, start_time, end_time, contract_address, merkle_root, created_at)
                        VALUES (${name}, ${description || null}, ${image || ''}, 'Whitelist', ${tokenAddress}, ${tokenSymbol || null}, ${tokenDecimals || 18}, ${network}, ${Number(totalAmount)}, ${status}, ${recipientCount}, ${creatorAddress}, ${new Date(startTime).toISOString()}, ${new Date(endTime).toISOString()}, ${contractAddress}, ${merkleRoot}, NOW())
                        RETURNING *;`;
                    createdAirdrop = rows[0];
                    
                    const tokenDecimalsForProof = tokenDecimals || 18;
                    const leaves = whitelist.map((entry: WhitelistEntry) => keccak256(createLeafBuffer(entry.address, parseUnits(entry.amount, tokenDecimalsForProof))));
                    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

                    for (const entry of whitelist) {
                        const leaf = keccak256(createLeafBuffer(entry.address, parseUnits(entry.amount, tokenDecimalsForProof)));
                        const proof = tree.getHexProof(leaf);
                        await client.sql`INSERT INTO whitelist_entries (airdrop_id, user_address, amount, proof) VALUES (${createdAirdrop.id}, ${entry.address}, ${Number(entry.amount)}, ${JSON.stringify(proof)});`;
                    }
                } else if (type === 'Quest') {
                     const { name, description, image, tokenAddress, tokenSymbol, tokenDecimals, network, totalAmount, status, creatorAddress, startTime, endTime, contractAddress, recipientCount, maxReward, topics } = req.body;
                     const verifierAddress = process.env.VERIFIER_ADDRESS;
                     if (!verifierAddress) {
                        throw new Error("Verifier address is not configured on the server.");
                     }
                    if (!name || !tokenAddress || !totalAmount || !creatorAddress || !startTime || !endTime || !contractAddress || !topics) return res.status(400).json({ message: 'Missing required fields for Quest airdrop.' });
                     const { rows } = await client.sql`
                        INSERT INTO airdrops (name, description, image, type, token_address, token_symbol, token_decimals, network, total_amount, status, recipient_count, max_reward, creator_address, start_time, end_time, contract_address, verifier_address, topics, created_at)
                        VALUES (${name}, ${description || null}, ${image || ''}, 'Quest', ${tokenAddress}, ${tokenSymbol || null}, ${tokenDecimals || 18}, ${network}, ${Number(totalAmount)}, ${status}, ${recipientCount}, ${Number(maxReward)}, ${creatorAddress}, ${new Date(startTime).toISOString()}, ${new Date(endTime).toISOString()}, ${contractAddress}, ${verifierAddress}, ${JSON.stringify(topics)}, NOW())
                        RETURNING *;`;
                    createdAirdrop = rows[0];
                } else {
                    return res.status(400).json({ message: 'Invalid airdrop type.' });
                }

                await client.sql`COMMIT`;
                return res.status(201).json(createdAirdrop);

            } catch (error) {
                await client.sql`ROLLBACK`;
                console.error('Airdrop creation error:', error);
                return res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to create airdrop.' });
            } finally {
                client.release();
            }
        }
    } else if (req.method === 'DELETE') {
        const client = await db.connect();
        try {
            const { airdropId, userAddress } = req.body;
            if (!airdropId || !userAddress || !isAddress(userAddress)) return res.status(400).json({ message: 'Invalid request parameters for deletion.' });
            await client.sql`BEGIN`;
            const { rows: airdropRows } = await client.sql`SELECT creator_address FROM airdrops WHERE id = ${Number(airdropId)};`;
            if (airdropRows.length === 0) { await client.sql`ROLLBACK`; return res.status(404).json({ message: 'Airdrop not found.' }); }
            if (getAddress(airdropRows[0].creator_address) !== getAddress(userAddress)) { await client.sql`ROLLBACK`; return res.status(403).json({ message: 'You are not authorized to delete this airdrop.' }); }
            await client.sql`DELETE FROM whitelist_entries WHERE airdrop_id = ${Number(airdropId)};`;
            // TODO: Delete from quest_entries as well
            await client.sql`DELETE FROM airdrops WHERE id = ${Number(airdropId)};`;
            await client.sql`COMMIT`;
            return res.status(200).json({ message: 'Airdrop deleted successfully.' });
        } catch (error) {
            await client.sql`ROLLBACK`;
            console.error('Airdrop deletion error:', error);
            return res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to delete airdrop.' });
        } finally {
            client.release();
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}