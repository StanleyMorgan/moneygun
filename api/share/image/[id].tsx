console.log('[Vercel API] image/[id].tsx module loading.');
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ImageResponse } from '@vercel/og';
import { sql } from '@vercel/postgres';
import { Buffer } from 'buffer';

export const config = {
  runtime: 'nodejs',
};

// Function to fetch font data, memoized for performance within the same function invocation context.
let fontDataPromise: Promise<ArrayBuffer> | null = null;
const getFontData = () => {
    if (!fontDataPromise) {
        // Fetching from a reliable CDN is more robust for serverless environments.
        const fontUrl = 'https://rsms.me/inter/font-files/Inter-Bold.otf?v=3.19';
        console.log(`[IMAGE API] Fetching font from: ${fontUrl}`);
        fontDataPromise = fetch(fontUrl).then(res => {
            if (!res.ok) {
                // Reset promise if fetch failed, so we can retry
                fontDataPromise = null; 
                throw new Error(`Failed to fetch font: ${res.statusText}`);
            }
            console.log(`[IMAGE API] Font fetched successfully.`);
            return res.arrayBuffer();
        });
    }
    return fontDataPromise;
};


export default async function handler(req: VercelRequest, res: VercelResponse) {
    console.log(`[IMAGE API] Request received for: ${req.url}`);
    try {
        const { id } = req.query;
        const airdropId = parseInt(id as string, 10);

        if (isNaN(airdropId)) {
            return res.status(400).send('Airdrop ID must be a number.');
        }
        console.log(`[IMAGE API] Fetching data for airdrop ID: ${airdropId}`);
        
        // Fetch airdrop data and font data in parallel for performance
        const [airdropResult, fontData] = await Promise.all([
            sql`SELECT name, image, max_reward, token_symbol FROM airdrops WHERE id = ${airdropId};`,
            getFontData()
        ]);

        if (airdropResult.rows.length === 0) {
            return res.status(404).send(`Airdrop with ID ${airdropId} not found.`);
        }
        
        const airdropData = airdropResult.rows[0];
        console.log(`[IMAGE API] Data found:`, airdropData);
        
        const rewardValue = airdropData.max_reward ? new Intl.NumberFormat('en-US').format(airdropData.max_reward) : 'Tokens';
        const rewardText = `${rewardValue} ${airdropData.token_symbol || ''}`;
        const defaultImage = 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/app/moneygun/money.svg';
        const airdropImage = airdropData.image || defaultImage;
        
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
                height: 800,
                fonts: [{ name: 'Inter', data: fontData, style: 'normal' }],
                headers: {
                    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300',
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