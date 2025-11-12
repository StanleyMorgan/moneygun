console.log('[Vercel API] networks.ts module loading.');
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // Order by is_testnet descending to show mainnets first, then by name
        const { rows } = await sql`SELECT * FROM networks WHERE active = true ORDER BY is_testnet ASC, name ASC;`;
        return res.status(200).json(rows);
    } catch (error) {
        console.error('Failed to fetch networks:', error);
        return res.status(500).json({ message: 'Internal server error while fetching networks.' });
    }
}