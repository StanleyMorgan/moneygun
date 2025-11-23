
console.log('[Vercel API] airdrops.ts module loading.');
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, db } from '@vercel/postgres';
import { MerkleTree } from 'merkletreejs';
import { getAddress, parseUnits, keccak256 as viemKeccak256, isAddress, encodePacked, toHex, pad, createPublicClient, http, Hex, Chain, LogTopic } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia, monadTestnet, celo, celoSepolia } from 'viem/chains';
import { WhitelistEntry } from '../types';
import { Buffer } from 'buffer';

// FIX: The call to viemKeccak256 was requesting 'bytes' which returns a Uint8Array, causing a type mismatch with Buffer.from which expected a string for 'hex' encoding. By removing the 'bytes' argument, viemKeccak256 defaults to returning a hex string, which is then correctly processed.
// Fix: Correctly convert the hex string from viem's keccak256 (e.g., "0x...") to a Buffer
// by removing the "0x" prefix and specifying 'hex' encoding. This is required by `merkletreejs`.
const keccak256 = (data: Buffer): Buffer => Buffer.from(viemKeccak256(data).slice(2), 'hex');

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

        // --- Check Creator Status (Whitelist & Limits) ---
        if (action === 'getCreatorStatus') {
            if (!userAddress || typeof userAddress !== 'string' || !isAddress(userAddress)) {
                return res.status(400).json({ message: 'Invalid user address.' });
            }
            try {
                const normalizedAddress = getAddress(userAddress);
                
                // Check whitelist
                const { rows: whitelistRows } = await sql`
                    SELECT creation_limit FROM allowed_creators WHERE LOWER(address) = LOWER(${normalizedAddress});
                `;

                if (whitelistRows.length === 0) {
                    return res.status(200).json({ allowed: false, limit: 0, count: 0 });
                }

                const creationLimit = whitelistRows[0].creation_limit;

                // Check count
                const { rows: countRows } = await sql`
                    SELECT COUNT(*) FROM airdrops WHERE creator_address = ${normalizedAddress};
                `;
                const currentCount = parseInt(countRows[0].count, 10);

                return res.status(200).json({ 
                    allowed: true, 
                    limit: creationLimit, 
                    count: currentCount 
                });

            } catch (error) {
                console.error('Creator status check error:', error);
                return res.status(500).json({ message: 'Internal server error checking creator status.' });
            }
        }

        // --- Eligibility Check for a specific user and airdrop ---
        if (airdropId && userAddress) {
             try {
                if (typeof airdropId !== 'string' || typeof userAddress !== 'string' || !isAddress(userAddress)) {
                    return res.status(400).json({ message: 'Invalid request parameters.' });
                }

                // Check airdrop type first
                const { rows: airdropTypeRows } = await sql`SELECT type, loop_interval FROM airdrops WHERE id = ${Number(airdropId)}`;
                if (airdropTypeRows.length === 0) return res.status(404).json({ message: 'Airdrop not found.' });
                const airdrop = airdropTypeRows[0];

                if (airdrop.type === 'Whitelist') {
                    const { rows: userEntries } = await sql`
                        SELECT amount, proof, status FROM whitelist_entries 
                        WHERE airdrop_id = ${Number(airdropId)} AND user_address = ${getAddress(userAddress as string)};
                    `;

                    if (userEntries.length === 0) return res.status(404).json({ message: 'User is not eligible for this airdrop.' });
                    
                    const userEntry = userEntries[0];
                    const proof = typeof userEntry.proof === 'string' ? JSON.parse(userEntry.proof) : userEntry.proof;

                    return res.status(200).json({ 
                        status: userEntry.status, 
                        amount: String(userEntry.amount), 
                        proof 
                    });
                } else if (airdrop.type === 'Quest') {
                    const { rows: questEntries } = await sql`
                        SELECT status FROM quest_entries
                        WHERE airdrop_id = ${Number(airdropId)} AND user_address = ${getAddress(userAddress as string)};
                    `;
                    if (questEntries.length === 0) {
                        return res.status(404).json({ message: 'User has not completed this quest yet.' });
                    }
                    return res.status(200).json({ status: questEntries[0].status });
                } else if (airdrop.type === 'Loop') {
                    const { rows: loopEntries } = await sql`
                        SELECT status, last_claimed_at FROM loop_entries
                        WHERE airdrop_id = ${Number(airdropId)} AND user_address = ${getAddress(userAddress as string)};
                    `;
                    
                    if (loopEntries.length === 0) {
                         // Never claimed, so eligible (pending check)
                         // For Loop, we can say 'eligible' which means "not recently claimed"
                         return res.status(200).json({ status: 'eligible', nextClaimAt: null });
                    }

                    const lastClaimedAt = new Date(loopEntries[0].last_claimed_at);
                    const now = new Date();
                    const intervalHours = airdrop.loop_interval || 0;
                    // Convert hours to milliseconds for date comparison
                    const nextClaimTime = new Date(lastClaimedAt.getTime() + intervalHours * 3600 * 1000);

                    if (now >= nextClaimTime) {
                         // Time passed, eligible again
                        return res.status(200).json({ status: 'eligible', nextClaimAt: null });
                    } else {
                         // Still in cooldown
                        return res.status(200).json({ status: 'claimed', nextClaimAt: nextClaimTime.toISOString() });
                    }

                } else {
                    return res.status(400).json({ message: 'Unknown airdrop type.' });
                }

            } catch (error) {
                console.error('Eligibility check error:', error);
                return res.status(500).json({ message: 'Internal server error during eligibility check.' });
            }
        } else {
            // --- Get All Airdrops ---
            try {
                const { rows } = await sql`
                    SELECT
                        a.*,
                        CASE
                            WHEN a.type = 'Whitelist' THEN (SELECT COUNT(*) FROM whitelist_entries we WHERE we.airdrop_id = a.id AND we.status = 'claimed')
                            WHEN a.type = 'Quest' THEN (SELECT COUNT(*) FROM quest_entries qe WHERE qe.airdrop_id = a.id AND qe.status = 'claimed')
                             -- For Loop, calculate total individual claims or unique claimers? Usually unique claimers for progress bars.
                             -- But since one user can claim multiple times, total distributed is better tracked by claim_count.
                             -- Let's just count unique users who have claimed at least once for the "recipient" progress bar.
                            WHEN a.type = 'Loop' THEN (SELECT COUNT(*) FROM loop_entries le WHERE le.airdrop_id = a.id AND le.claim_count > 0)
                            ELSE 0
                        END as claimed_count
                    FROM
                        airdrops a
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

                const { rows: airdropRows } = await sql`SELECT type, network, topic0, max_reward, token_decimals, target_contract, user_topic_index, loop_interval FROM airdrops WHERE id = ${airdropId}`;
                if (airdropRows.length === 0) return res.status(404).json({ message: 'Airdrop not found.' });
                const airdrop = airdropRows[0];
                
                // Logic for Quest vs Loop
                if (airdrop.type === 'Quest') {
                     const { rows: existingEntries } = await sql`
                        SELECT status FROM quest_entries 
                        WHERE airdrop_id = ${airdropId} AND user_address = ${getAddress(userAddress)};
                    `;
                    if (existingEntries.length > 0) {
                        if (existingEntries[0].status === 'claimed') {
                            return res.status(400).json({ message: 'You have already claimed this quest reward.' });
                        }
                         // If 'verified', skip blockchain check and re-sign.
                        const amount = String(airdrop.max_reward);
                        const signature = await signQuestData(userAddress, airdropId, amount, airdrop.token_decimals);
                        return res.status(200).json({ amount, signature });
                    }
                } else if (airdrop.type === 'Loop') {
                     const { rows: loopEntries } = await sql`
                        SELECT last_claimed_at FROM loop_entries 
                        WHERE airdrop_id = ${airdropId} AND user_address = ${getAddress(userAddress)};
                    `;
                    if (loopEntries.length > 0) {
                        const lastClaim = new Date(loopEntries[0].last_claimed_at);
                        const now = new Date();
                        const intervalHours = airdrop.loop_interval || 0;
                        // Convert hours to milliseconds
                        if (now.getTime() < lastClaim.getTime() + intervalHours * 3600 * 1000) {
                             return res.status(400).json({ message: 'Cooldown is still active.' });
                        }
                    }
                }

                const { rows: networkRows } = await sql`SELECT * FROM networks WHERE network_key = ${airdrop.network}`;
                if (networkRows.length === 0) return res.status(400).json({ message: `Network configuration for '${airdrop.network}' not found.` });
                const network = networkRows[0];
                
                const alchemyApiKey = process.env.ALCHEMY_API_KEY;
                if (!alchemyApiKey) throw new Error('Alchemy API key is not configured on the server.');
                if (!airdrop.target_contract) return res.status(400).json({ message: 'Target contract for this quest is not configured.' });
                if (!airdrop.topic0) return res.status(400).json({ message: 'Airdrop is missing event topic configuration.' });

                let chain: Chain;
                let alchemyRpcUrl: string;

                switch (airdrop.network) {
                    case 'base':
                        chain = base;
                        alchemyRpcUrl = `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;
                        break;
                    case 'base-sepolia':
                        chain = baseSepolia;
                        alchemyRpcUrl = `https://base-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
                        break;
                    case 'monad-testnet':
                        chain = monadTestnet;
                        alchemyRpcUrl = `https://monad-testnet.g.alchemy.com/v2/${alchemyApiKey}`;
                        break;
                    case 'celo':
                        chain = celo;
                        alchemyRpcUrl = `https://celo-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;
                        break;
                    case 'celo-sepolia':
                        chain = celoSepolia;
                        alchemyRpcUrl = `https://celo-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
                        break;
                    default:
                        return res.status(400).json({ message: `Unsupported network: ${airdrop.network}` });
                }

                const publicClient = createPublicClient({ chain, transport: http(network.rpc_url_public) });
                const alchemyClient = createPublicClient({ chain, transport: http(alchemyRpcUrl) });

                const paddedUserAddress = pad(getAddress(userAddress), { size: 32 });
                const userTopicIndex = airdrop.user_topic_index || 2;
                const dynamicTopics: LogTopic[] = [airdrop.topic0 as Hex];
                for (let i = 1; i < userTopicIndex; i++) {
                    dynamicTopics.push(null);
                }
                dynamicTopics.push(paddedUserAddress);
                
                const latestBlock = await publicClient.getBlockNumber();
                const blockRange = BigInt(999);
                const fromBlock = latestBlock > blockRange ? latestBlock - blockRange : BigInt(0);

                const getLogsParams = {
                    address: getAddress(airdrop.target_contract),
                    topics: dynamicTopics,
                    fromBlock: fromBlock,
                    toBlock: latestBlock,
                };
                const logs = await alchemyClient.getLogs(getLogsParams);
                
                const isQuestCompleted = logs.length > 0;

                if (!isQuestCompleted) return res.status(400).json({ message: 'Quest completion event not found on-chain.' });

                const amount = String(airdrop.max_reward);
                const signature = await signQuestData(userAddress, airdropId, amount, airdrop.token_decimals);

                // Only insert 'verified' for Quest. Loop entries are managed on claim.
                if (airdrop.type === 'Quest') {
                    await sql`
                        INSERT INTO quest_entries (airdrop_id, user_address, status) 
                        VALUES (${airdropId}, ${getAddress(userAddress)}, 'verified')
                        ON CONFLICT (airdrop_id, user_address) DO NOTHING;
                    `;
                }
                
                return res.status(200).json({ amount, signature });
            } catch (error) {
                 console.error('Quest verification error:', error);
                return res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to verify quest.' });
            }
        }
        else if (action === 'updateClaim') {
             try {
                const { airdropId, userAddress } = req.body;
                if (!airdropId || !userAddress || !isAddress(userAddress)) return res.status(400).json({ message: 'Missing airdropId or userAddress for claim update.' });
                
                const checkedUserAddress = getAddress(userAddress);
                const { rows: airdropRows } = await sql`SELECT type FROM airdrops WHERE id = ${airdropId}`;
                if (airdropRows.length === 0) return res.status(404).json({ message: "Airdrop not found." });

                if (airdropRows[0].type === 'Whitelist') {
                    // Updated to use status='claimed' instead of claimed=true
                    await sql`UPDATE whitelist_entries SET status = 'claimed', claimed_at = NOW() WHERE airdrop_id = ${airdropId} AND user_address = ${checkedUserAddress};`;
                } else if (airdropRows[0].type === 'Quest') {
                    await sql`UPDATE quest_entries SET status = 'claimed', updated_at = NOW() WHERE airdrop_id = ${airdropId} AND user_address = ${checkedUserAddress};`;
                } else if (airdropRows[0].type === 'Loop') {
                    await sql`
                        INSERT INTO loop_entries (airdrop_id, user_address, last_claimed_at, claim_count, status)
                        VALUES (${airdropId}, ${checkedUserAddress}, NOW(), 1, 'claimed')
                        ON CONFLICT (airdrop_id, user_address)
                        DO UPDATE SET last_claimed_at = NOW(), claim_count = loop_entries.claim_count + 1, status = 'claimed', updated_at = NOW();
                    `;
                }

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
                const { type, creatorAddress } = req.body;

                // --- Check Whitelist & Limits ---
                if (!creatorAddress || !isAddress(creatorAddress)) {
                    client.release();
                    return res.status(400).json({ message: 'Invalid creator address.' });
                }
                
                const normalizedCreator = getAddress(creatorAddress);

                // 1. Check if user is whitelisted (Case insensitive check for robustness)
                const { rows: whitelistRows } = await client.sql`
                    SELECT creation_limit FROM allowed_creators WHERE LOWER(address) = LOWER(${normalizedCreator});
                `;

                if (whitelistRows.length === 0) {
                    client.release();
                    return res.status(403).json({ message: 'Access denied: Your wallet is not whitelisted to create airdrops.' });
                }

                const creationLimit = whitelistRows[0].creation_limit;

                // 2. Check limit against existing airdrops
                const { rows: countRows } = await client.sql`
                    SELECT COUNT(*) FROM airdrops WHERE creator_address = ${normalizedCreator};
                `;
                
                const currentCount = parseInt(countRows[0].count, 10);

                if (currentCount >= creationLimit) {
                    client.release();
                    return res.status(403).json({ message: `Creation limit reached. You can only create ${creationLimit} airdrops.` });
                }
                // --- End Whitelist Check ---

                await client.sql`BEGIN`;
                let createdAirdrop;

                const defaultImage = 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/app/moneygun/money.svg';

                if (type === 'Whitelist') {
                    const { name, description, image, action, tokenAddress, tokenSymbol, tokenDecimals, network, totalAmount, status, startTime, endTime, whitelist, contractAddress, merkleRoot, recipientCount, maxReward } = req.body;
                    
                    const imageUrl = image || defaultImage;
                    if (!imageUrl.endsWith('.svg')) {
                        await client.sql`ROLLBACK`;
                        return res.status(400).json({ message: 'Image URL must be a link to an SVG file.' });
                    }

                    if (!name || !tokenAddress || !totalAmount || !startTime || !endTime || !contractAddress || !merkleRoot) {
                        await client.sql`ROLLBACK`;
                        return res.status(400).json({ message: 'Missing required fields for Whitelist airdrop.' });
                    }
                    
                    const { rows } = await client.sql`
                        INSERT INTO airdrops (name, description, image, action, type, token_address, token_symbol, token_decimals, network, total_amount, status, recipient_count, creator_address, start_time, end_time, contract_address, merkle_root, max_reward, created_at)
                        VALUES (${name}, ${description || null}, ${imageUrl}, ${action || null}, 'Whitelist', ${tokenAddress}, ${tokenSymbol || null}, ${tokenDecimals || 18}, ${network}, ${Number(totalAmount)}, ${status}, ${recipientCount}, ${creatorAddress}, ${new Date(startTime).toISOString()}, ${new Date(endTime).toISOString()}, ${contractAddress}, ${merkleRoot}, ${maxReward ? Number(maxReward) : null}, NOW())
                        RETURNING *;`;
                    createdAirdrop = rows[0];
                    
                    const tokenDecimalsForProof = tokenDecimals || 18;
                    const leaves = whitelist.map((entry: WhitelistEntry) => keccak256(createLeafBuffer(entry.address, parseUnits(entry.amount, tokenDecimalsForProof))));
                    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

                    for (const entry of whitelist) {
                        const leaf = keccak256(createLeafBuffer(entry.address, parseUnits(entry.amount, tokenDecimalsForProof)));
                        const proof = tree.getHexProof(leaf);
                        // Insert status will default to 'eligible' based on DB schema
                        await client.sql`INSERT INTO whitelist_entries (airdrop_id, user_address, amount, proof) VALUES (${createdAirdrop.id}, ${entry.address}, ${Number(entry.amount)}, ${JSON.stringify(proof)});`;
                    }
                } else if (type === 'Quest') {
                     const { name, description, image, action, tokenAddress, tokenSymbol, tokenDecimals, network, totalAmount, status, startTime, endTime, contractAddress, recipientCount, maxReward, targetContract, topic0, userTopicIndex } = req.body;
                     
                     const imageUrl = image || defaultImage;
                     if (!imageUrl.endsWith('.svg')) {
                        await client.sql`ROLLBACK`;
                        return res.status(400).json({ message: 'Image URL must be a link to an SVG file.' });
                    }
                    
                     const verifierAddress = process.env.VERIFIER_ADDRESS;
                     if (!verifierAddress) {
                        await client.sql`ROLLBACK`;
                        throw new Error("Verifier address is not configured on the server.");
                     }
                    if (!name || !tokenAddress || !totalAmount || !startTime || !endTime || !contractAddress || !topic0 || !targetContract || !userTopicIndex) {
                        await client.sql`ROLLBACK`;
                        return res.status(400).json({ message: 'Missing required fields for Quest airdrop.' });
                    }
                     const { rows } = await client.sql`
                        INSERT INTO airdrops (name, description, image, action, type, token_address, token_symbol, token_decimals, network, total_amount, status, recipient_count, max_reward, creator_address, start_time, end_time, contract_address, target_contract, topic0, user_topic_index, created_at)
                        VALUES (${name}, ${description || null}, ${imageUrl}, ${action || null}, 'Quest', ${tokenAddress}, ${tokenSymbol || null}, ${tokenDecimals || 18}, ${network}, ${Number(totalAmount)}, ${status}, ${recipientCount}, ${Number(maxReward)}, ${creatorAddress}, ${new Date(startTime).toISOString()}, ${new Date(endTime).toISOString()}, ${contractAddress}, ${targetContract}, ${topic0}, ${userTopicIndex}, NOW())
                        RETURNING *;`;
                    createdAirdrop = rows[0];
                } else if (type === 'Loop') {
                    const { name, description, image, action, tokenAddress, tokenSymbol, tokenDecimals, network, totalAmount, status, startTime, endTime, contractAddress, recipientCount, maxReward, targetContract, topic0, userTopicIndex, loopInterval } = req.body;
                    
                    const imageUrl = image || defaultImage;
                    if (!imageUrl.endsWith('.svg')) {
                       await client.sql`ROLLBACK`;
                       return res.status(400).json({ message: 'Image URL must be a link to an SVG file.' });
                   }
                   
                    const verifierAddress = process.env.VERIFIER_ADDRESS;
                    if (!verifierAddress) {
                       await client.sql`ROLLBACK`;
                       throw new Error("Verifier address is not configured on the server.");
                    }
                   if (!name || !tokenAddress || !totalAmount || !startTime || !endTime || !contractAddress || !topic0 || !targetContract || !userTopicIndex || !loopInterval) {
                        await client.sql`ROLLBACK`;
                        return res.status(400).json({ message: 'Missing required fields for Loop airdrop.' });
                   }
                    
                   const { rows } = await client.sql`
                       INSERT INTO airdrops (name, description, image, action, type, token_address, token_symbol, token_decimals, network, total_amount, status, recipient_count, max_reward, creator_address, start_time, end_time, contract_address, target_contract, topic0, user_topic_index, loop_interval, created_at)
                       VALUES (${name}, ${description || null}, ${imageUrl}, ${action || null}, 'Loop', ${tokenAddress}, ${tokenSymbol || null}, ${tokenDecimals || 18}, ${network}, ${Number(totalAmount)}, ${status}, ${recipientCount}, ${Number(maxReward)}, ${creatorAddress}, ${new Date(startTime).toISOString()}, ${new Date(endTime).toISOString()}, ${contractAddress}, ${targetContract}, ${topic0}, ${userTopicIndex}, ${loopInterval}, NOW())
                       RETURNING *;`;
                   createdAirdrop = rows[0];
                } else {
                    await client.sql`ROLLBACK`;
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
            await client.sql`DELETE FROM quest_entries WHERE airdrop_id = ${Number(airdropId)};`;
            await client.sql`DELETE FROM loop_entries WHERE airdrop_id = ${Number(airdropId)};`;
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
