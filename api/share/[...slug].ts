import { ImageResponse } from '@vercel/og';
import { sql } from '@vercel/postgres';
import React from 'react';

export const config = {
  runtime: 'edge',
};

// This handler is now bimodal:
// 1. /api/share/quest/[id] -> Returns HTML for the Farcaster frame.
// 2. /api/share/image/[id] -> Returns the generated PNG image.
export default async function handler(request: Request) {
    try {
        const { pathname, origin } = new URL(request.url);
        const pathSegments = pathname.split('/'); // e.g., ['', 'api', 'share', 'quest', '123']

        if (pathSegments.length < 5) {
            return new Response('Invalid URL format.', { status: 400 });
        }

        const routeType = pathSegments[3]; // 'quest' or 'image'
        const airdropId = parseInt(pathSegments[4], 10);

        if (isNaN(airdropId)) {
            return new Response('Airdrop ID must be a number.', { status: 400 });
        }

        // --- Route 1: Serve Farcaster Frame HTML ---
        if (routeType === 'quest') {
            const imageUrl = `${origin}/api/share/image/${airdropId}`;
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <meta property="og:title" content="Moneygun Airdrop Claim" />
                    <meta property="og:image" content="${imageUrl}" />
                    <meta property="fc:frame" content="vNext" />
                    <meta property="fc:frame:image" content="${imageUrl}" />
                </head>
                <body>
                    <h1>Moneygun Shareable Image</h1>
                    <p>This is a Farcaster Frame. View on a compatible client.</p>
                </body>
                </html>
            `;
            return new Response(html, {
                headers: { 'Content-Type': 'text/html' },
                status: 200,
            });
        }

        // --- Route 2: Generate and Serve the Image ---
        if (routeType === 'image') {
            const { rows } = await sql`
                SELECT name, image, max_reward, token_symbol 
                FROM airdrops 
                WHERE id = ${airdropId};
            `;

            if (rows.length === 0) {
                return new Response(`Airdrop with ID ${airdropId} not found.`, { status: 404 });
            }
            const airdropData = rows[0];
            
            const rewardValue = airdropData.max_reward ? new Intl.NumberFormat('en-US').format(airdropData.max_reward) : 'Tokens';
            const rewardText = `${rewardValue} ${airdropData.token_symbol || ''}`;
            const defaultImage = 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/app/moneygun/money.svg';
            const airdropImage = airdropData.image || defaultImage;

            const fontData = await fetch(`${origin}/Inter-Bold.ttf`).then((res) => res.arrayBuffer());
            const backgroundImageUrl = 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/app/moneygun/background.png';

            return new ImageResponse(
                React.createElement(
                    'div',
                    {
                        style: {
                            height: '100%',
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundImage: `url(${backgroundImageUrl})`,
                            backgroundSize: '1200px 630px',
                            fontFamily: '"Inter"',
                        },
                    },
                    React.createElement(
                        'div',
                        {
                            style: {
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                borderRadius: 24,
                                padding: '40px 60px',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                                width: '85%',
                            },
                        },
                        React.createElement('img', {
                            src: airdropImage,
                            width: '180',
                            height: '180',
                            style: {
                                borderRadius: 16,
                                objectFit: 'cover',
                                marginBottom: 20,
                                border: '2px solid #E5E7EB',
                            },
                        }),
                        React.createElement(
                            'h1',
                            {
                                style: {
                                    fontSize: 60,
                                    color: '#1F2937',
                                    margin: '0 0 15px 0',
                                    lineHeight: 1.2,
                                },
                            },
                            airdropData.name
                        ),
                        React.createElement(
                            'p',
                            { style: { fontSize: 48, color: '#4B5563', margin: 0 } },
                            'Reward: ',
                            React.createElement(
                                'span',
                                { style: { color: '#9333ea', fontWeight: 'bold' } },
                                rewardText
                            )
                        )
                    )
                ),
                {
                    width: 1200,
                    height: 630,
                    fonts: [{ name: 'Inter', data: fontData, style: 'normal' }],
                },
            );
        }

        // --- Fallback for invalid routes ---
        return new Response('Invalid route. Use /quest/[id] or /image/[id].', { status: 400 });

    } catch (e: any) {
        console.error(e);
        return new Response(`Failed to process request: ${e.message}`, { status: 500 });
    }
}
