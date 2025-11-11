import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ImageResponse } from '@vercel/og';
import { sql } from '@vercel/postgres';
import path from 'path';
import { promises as fs } from 'fs';

export const config = {
  runtime: 'nodejs',
};

// This handler is now bimodal:
// 1. /api/share/quest/[id] -> Returns HTML for the Farcaster Mini App embed.
// 2. /api/share/image/[id] -> Returns the generated PNG image.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const url = new URL(req.url!, `https://${req.headers.host}`);
        const { pathname, origin } = url;
        const pathSegments = pathname.split('/'); // e.g., ['', 'api', 'share', 'quest', '123']

        if (pathSegments.length < 5) {
            return res.status(400).send('Invalid URL format.');
        }

        const routeType = pathSegments[3]; // 'quest' or 'image'
        const airdropId = parseInt(pathSegments[4], 10);

        if (isNaN(airdropId)) {
            return res.status(400).send('Airdrop ID must be a number.');
        }

        // --- Route 1: Serve Farcaster Mini App Embed HTML ---
        if (routeType === 'quest') {
            const imageUrl = `${origin}/api/share/image/${airdropId}`;
            const appUrl = `${origin}/`;

            const miniAppEmbed = {
                version: "1",
                imageUrl: imageUrl,
                button: {
                    title: "View Airdrop",
                    action: {
                        type: "launch_miniapp",
                        url: appUrl,
                    }
                }
            };

            const frameEmbed = {
                ...miniAppEmbed,
                button: {
                    ...miniAppEmbed.button,
                    action: {
                        ...miniAppEmbed.button.action,
                        type: "launch_frame", // For backward compatibility
                    }
                }
            };

            const miniAppContent = JSON.stringify(miniAppEmbed).replace(/"/g, '&quot;');
            const frameContent = JSON.stringify(frameEmbed).replace(/"/g, '&quot;');
            
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8" />
                    <title>Moneygun Airdrop</title>
                    <meta property="og:title" content="Moneygun Airdrop" />
                    <meta property="og:image" content="${imageUrl}" />
                    
                    <meta name="fc:miniapp" content="${miniAppContent}" />
                    <meta name="fc:frame" content="${frameContent}" />
                </head>
                <body>
                    <h1>Moneygun Shareable Image</h1>
                    <p>This is a Farcaster Mini App embed. View on a compatible client.</p>
                </body>
                </html>
            `;
            return res.status(200).setHeader('Content-Type', 'text/html').send(html);
        }

        // --- Route 2: Generate and Serve the Image ---
        if (routeType === 'image') {
            const { rows } = await sql`
                SELECT name, image, max_reward, token_symbol 
                FROM airdrops 
                WHERE id = ${airdropId};
            `;

            if (rows.length === 0) {
                return res.status(404).send(`Airdrop with ID ${airdropId} not found.`);
            }
            const airdropData = rows[0];
            
            const rewardValue = airdropData.max_reward ? new Intl.NumberFormat('en-US').format(airdropData.max_reward) : 'Tokens';
            const rewardText = `${rewardValue} ${airdropData.token_symbol || ''}`;
            const defaultImage = 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/app/moneygun/money.svg';
            const airdropImage = airdropData.image || defaultImage;
            
            const fontPath = path.join(process.cwd(), 'public', 'Inter-Bold.ttf');
            const fontData = await fs.readFile(fontPath);

            const backgroundImageUrl = 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/app/moneygun/background.png';

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
            
            // Convert Web API Response to Node.js response
            res.status(200);
            imageResponse.headers.forEach((value, key) => {
                res.setHeader(key, value);
            });
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            return res.send(imageBuffer);
        }

        // --- Fallback for invalid routes ---
        return res.status(400).send('Invalid route. Use /quest/[id] or /image/[id].');

    } catch (e: any) {
        console.error(e);
        return res.status(500).send(`Failed to process request: ${e.message}`);
    }
}
