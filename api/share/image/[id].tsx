import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ImageResponse } from '@vercel/og';
import { sql } from '@vercel/postgres';
import path from 'path';
import { promises as fs } from 'fs';
import { Buffer } from 'buffer';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    console.log(`[IMAGE API] Request received for: ${req.url}`);
    try {
        const { id } = req.query;
        const airdropId = parseInt(id as string, 10);

        if (isNaN(airdropId)) {
            console.error(`[IMAGE API] Invalid Airdrop ID: ${id}`);
            return res.status(400).send('Airdrop ID must be a number.');
        }
        console.log(`[IMAGE API] Fetching data for airdrop ID: ${airdropId}`);

        const { rows } = await sql`
            SELECT name, image, max_reward, token_symbol 
            FROM airdrops 
            WHERE id = ${airdropId};
        `;

        if (rows.length === 0) {
            console.error(`[IMAGE API] Airdrop not found for ID: ${airdropId}`);
            return res.status(404).send(`Airdrop with ID ${airdropId} not found.`);
        }
        const airdropData = rows[0];
        console.log(`[IMAGE API] Data found:`, airdropData);
        
        const rewardValue = airdropData.max_reward ? new Intl.NumberFormat('en-US').format(airdropData.max_reward) : 'Tokens';
        const rewardText = `${rewardValue} ${airdropData.token_symbol || ''}`;
        const defaultImage = 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/app/moneygun/money.svg';
        const airdropImage = airdropData.image || defaultImage;
        
        const fontPath = path.join(process.cwd(), 'public', 'Inter-Bold.ttf');
        console.log(`[IMAGE API] Loading font from: ${fontPath}`);
        // FIX: The `fs.readFile` function returns a `Buffer`, which is an instance of `Uint8Array`.
        // The previous code was attempting to slice the underlying ArrayBuffer, which could be a
        // `SharedArrayBuffer`, causing a type mismatch. Passing the Buffer directly resolves this.
        const fontData = await fs.readFile(fontPath);
        console.log(`[IMAGE API] Font loaded successfully.`);

        const backgroundImageUrl = 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/app/moneygun/background.png';

        console.log(`[IMAGE API] Generating ImageResponse...`);
        const imageResponse = new ImageResponse(
            (
                <div
                    tw="h-full w-full flex flex-col items-center justify-center"
                    style={{
                        backgroundImage: `url(${backgroundImageUrl})`,
                        backgroundSize: '1200px 800px',
                        fontFamily: '"Inter"',
                    }}
                >
                    <div tw="flex flex-col items-center justify-center text-center bg-white/90 rounded-3xl p-10 px-16 shadow-2xl w-[85%] max-w-[900px]">
                        <img
                            src={airdropImage}
                            tw="w-44 h-44 rounded-2xl object-cover mb-5 border-2 border-gray-200"
                            alt=""
                        />
                        <h1 tw="text-6xl text-gray-800 m-0 mb-4 leading-tight">
                            {airdropData.name}
                        </h1>
                        <p tw="text-5xl text-gray-600 m-0">
                            Reward: <span tw="text-purple-600 font-bold">{rewardText}</span>
                        </p>
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 800, // 3:2 aspect ratio
                fonts: [{ name: 'Inter', data: fontData, style: 'normal' }],
                headers: {
                    'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
                },
            },
        );
        console.log(`[IMAGE API] ImageResponse generated.`);
        
        // Convert Web API Response to Node.js response
        res.status(200);
        res.setHeader('Content-Type', 'image/png');
        imageResponse.headers.forEach((value, key) => {
            res.setHeader(key, value);
        });
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        console.log(`[IMAGE API] Sending image buffer.`);
        return res.send(imageBuffer);

    } catch (e: any) {
        console.error(`[IMAGE API] Critical error:`, e);
        return res.status(500).send(`Failed to generate image: ${e.message}`);
    }
}