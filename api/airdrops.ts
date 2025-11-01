import { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

// This is a type definition for the body of the POST request
// It matches the Omit<> type in the frontend
interface CreateAirdropPayload {
  name: string;
  description?: string;
  action?: { text: string; url: string };
  type: 'Whitelist' | 'Quest';
  tokenAddress: string;
  tokenSymbol?: string;
  network?: string;
  totalAmount: number;
  status: 'Draft' | 'In Progress' | 'Completed' | 'Failed';
  creatorAddress: string;
  startTime?: string; // Comes as an ISO string from the client
  endTime?: string;   // Comes as an ISO string from the client
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (!process.env.POSTGRES_URL) {
        return res.status(500).json({ message: "Database connection string is not configured. Please connect a Neon database in your Vercel project settings." });
    }
    const sql = neon(process.env.POSTGRES_URL);

    if (req.method === 'GET') {
        try {
            const airdrops = await sql`SELECT * FROM airdrops ORDER BY created_at DESC`;
            return res.status(200).json(airdrops);
        } catch (error) {
            console.error('Failed to fetch airdrops:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            return res.status(500).json({ message: 'Internal Server Error', error: errorMessage });
        }
    }

    if (req.method === 'POST') {
        try {
            const { name, description, action, type, tokenAddress, tokenSymbol, network, totalAmount, creatorAddress, startTime, endTime } = req.body as CreateAirdropPayload;

            if (!name || !type || !tokenAddress || totalAmount === undefined || !creatorAddress || !startTime || !endTime) {
                return res.status(400).json({ message: 'Missing required fields' });
            }

            const [newAirdrop] = await sql`
                INSERT INTO airdrops (
                    name, description, action, type, token_address, token_symbol, network,
                    total_amount, status, recipient_count, creator_address,
                    start_time, end_time
                )
                VALUES (
                    ${name}, ${description || null}, ${action || null}, ${type}, ${tokenAddress}, 
                    ${tokenSymbol || null}, ${network || null},
                    ${totalAmount}, 'Draft', 0, ${creatorAddress},
                    ${startTime || null}, 
                    ${endTime || null}
                )
                RETURNING *;
            `;

            return res.status(201).json(newAirdrop);
        } catch (error) {
            console.error('Failed to create airdrop:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            return res.status(500).json({ message: 'Internal Server Error', error: errorMessage });
        }
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
}