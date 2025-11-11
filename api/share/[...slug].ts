import { ImageResponse } from '@vercel/og';
import { sql } from '@vercel/postgres';
import React from 'react';

export const config = {
  runtime: 'edge',
};

// FIX: The handler signature has been updated to match the Vercel Edge runtime.
// It now uses the standard `Request` object instead of the Node.js-specific `VercelRequest`.
// Logic has been added to parse the `airdropId` from the request URL pathname.
export default async function handler(request: Request) {
    try {
        const { pathname, origin } = new URL(request.url);
        const pathSegments = pathname.split('/'); // e.g., ['', 'api', 'share', 'quest', '123']

        // Expecting /api/share/quest/[id]
        if (pathSegments.length !== 5 || pathSegments[3] !== 'quest') {
            return new Response('Invalid URL format. Use /api/share/quest/[ID]', { status: 400 });
        }
        
        const airdropId = parseInt(pathSegments[4], 10);
        if (isNaN(airdropId)) {
            return new Response('Airdrop ID must be a number.', { status: 400 });
        }

        // Fetch airdrop data from the database
        const { rows } = await sql`
            SELECT name, image, max_reward, token_symbol 
            FROM airdrops 
            WHERE id = ${airdropId};
        `;

        if (rows.length === 0) {
            return new Response(`Airdrop with ID ${airdropId} not found.`, { status: 404 });
        }
        const airdropData = rows[0];
        
        const rewardText = `${airdropData.max_reward || 'Tokens'} ${airdropData.token_symbol || ''}`;
        const defaultImage = 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/app/moneygun/money.svg';
        const airdropImage = airdropData.image || defaultImage;

        // Fetch font and background image.
        const fontData = await fetch(`${origin}/Inter-Bold.otf`).then((res) => res.arrayBuffer());
        // Use the external URL for the background image as requested.
        const backgroundImageUrl = 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/app/moneygun/background.png';

        return new ImageResponse(
            // FIX: Replaced JSX syntax with React.createElement to resolve TypeScript parsing errors in a .ts file.
            // The Vercel OG library supports this standard React API, which avoids the need for a .tsx file extension
            // or special tsconfig.json settings.
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
    } catch (e: any) {
        console.error(e);
        return new Response(`Failed to generate image: ${e.message}`, { status: 500 });
    }
}