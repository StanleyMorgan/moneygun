import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { networkKey } = req.query;

    if (!networkKey || typeof networkKey !== 'string') {
        return res.status(400).json({ message: 'A networkKey query parameter is required.' });
    }

    try {
        const { rows } = await sql`
            SELECT * FROM tokens 
            WHERE network_key = ${networkKey} 
            ORDER BY symbol ASC;
        `;
        return res.status(200).json(rows);
    } catch (error) {
        console.error('Failed to fetch tokens:', error);
        return res.status(500).json({ message: 'Internal server error while fetching tokens.' });
    }
}