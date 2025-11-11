import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const { id } = req.query;
        const airdropId = parseInt(id as string, 10);

        if (isNaN(airdropId)) {
            return res.status(400).send('Airdrop ID must be a number.');
        }

        const origin = `https://${req.headers.host}`;
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
                <title>Moneygun Airdrop Share</title>
                <meta property="og:title" content="Moneygun Airdrop" />
                <meta property="og:image" content="${imageUrl}" />
                
                <meta name="fc:miniapp" content="${miniAppContent}" />
                <meta name="fc:frame" content="${frameContent}" />
            </head>
            <body>
                <h1>Redirecting to Moneygun...</h1>
            </body>
            </html>
        `;
        return res.status(200).setHeader('Content-Type', 'text/html').send(html);

    } catch (e: any) {
        console.error('[FRAME API ERROR]', e);
        return res.status(500).send(`Failed to generate frame: ${e.message}`);
    }
}
