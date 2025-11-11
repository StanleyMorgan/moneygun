console.log('[Vercel API] frame/[id].tsx module loading.');
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query;
    const airdropId = parseInt(id as string, 10);

    if (isNaN(airdropId)) {
      return res.status(400).send('Airdrop ID must be a number.');
    }

    // Более надежное определение origin
    const origin =
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : `https://${req.headers.host}`;

    const imageUrl = `${origin}/api/share/image/${airdropId}`;
    const appUrl = `${origin}/`;

    // Новая схема frame-меты для Farcaster
    const frameEmbed = {
      version: '1',
      imageUrl,
      button: {
        title: 'View Airdrop',
        action: { url: appUrl },
      },
    };

    const frameContent = JSON.stringify(frameEmbed).replace(/"/g, '&quot;');

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Moneygun Airdrop Share</title>
        <meta property="og:title" content="Moneygun Airdrop" />
        <meta property="og:image" content="${imageUrl}" />
        <meta name="fc:frame" content="${frameContent}" />
      </head>
      <body>
        <h1>Redirecting to Moneygun...</h1>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (e: any) {
    console.error('[FRAME API ERROR]', e);
    return res.status(500).send(`Failed to generate frame: ${e.message}`);
  }
}
