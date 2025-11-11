export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  try {
    // Extract the airdrop ID from the URL path
    const url = new URL(req.url);
    const idParam = url.pathname.split('/').pop();
    const airdropId = Number(idParam);

    if (isNaN(airdropId)) {
      return new Response('Airdrop ID must be a number.', { status: 400 });
    }

    // Define the origin (Edge runtime does not provide req.headers.host as in Node)
    const host = req.headers.get('host');
    const origin = host ? `https://${host}` : 'https://moneygun-mini.vercel.app';

    // Define the image URL and app URL
    const imageUrl = `${origin}/api/share/image/${airdropId}`;
    const appUrl = `${origin}/`;

    // Example share text for Farcaster composer links
    const shareText = `I just claimed 1 USDC in Moneygun MiniApp`;

    // MiniApp embed metadata
    const miniAppEmbed = {
      version: '1',
      imageUrl,
      button: {
        title: 'View Airdrop',
        action: {
          type: 'launch_miniapp',
          url: appUrl,
        },
      },
    };

    // Frame embed (backward compatibility for Farcaster Frames)
    const frameEmbed = {
      ...miniAppEmbed,
      button: {
        ...miniAppEmbed.button,
        action: {
          ...miniAppEmbed.button.action,
          type: 'launch_frame',
        },
      },
    };

    // Convert objects to escaped strings for meta tags
    const miniAppContent = JSON.stringify(miniAppEmbed).replace(/"/g, '&quot;');
    const frameContent = JSON.stringify(frameEmbed).replace(/"/g, '&quot;');

    // HTML response with Farcaster meta tags
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Moneygun Airdrop Share</title>
        <meta name="description" content="${shareText}" />
        <meta property="og:title" content="Moneygun Airdrop" />
        <meta property="og:description" content="${shareText}" />
        <meta property="og:image" content="${imageUrl}" />
        <meta name="fc:miniapp" content="${miniAppContent}" />
        <meta name="fc:frame" content="${frameContent}" />
      </head>
      <body>
        <h1>Redirecting to Moneygun...</h1>
      </body>
      </html>
    `;

    // Return HTML response
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (e: any) {
    console.error('[FRAME API ERROR]', e);
    return new Response(`Failed to generate frame: ${e.message}`, { status: 500 });
  }
}
