import { ImageResponse } from '@vercel/og';
import { sql } from '@vercel/postgres';

export const config = {
  runtime: 'edge', 
};

let fontData: ArrayBuffer | null = null;

async function getFontData() {
  if (!fontData) {
    const res = await fetch('https://raw.githubusercontent.com/StanleyMorgan/graphics/refs/heads/main/fonts/Inter-Bold.ttf');
    if (!res.ok) throw new Error('Failed to fetch font');
    fontData = await res.arrayBuffer();
  }
  return fontData;
}

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') || req.url.split('/').pop();
  const airdropId = parseInt(id || '', 10);

  if (isNaN(airdropId)) {
    return new Response('Airdrop ID must be a number.', { status: 400 });
  }

  const [airdropResult, font] = await Promise.all([
    sql`SELECT name, image, max_reward, token_symbol FROM airdrops WHERE id = ${airdropId};`,
    getFontData(),
  ]);

  if (airdropResult.rows.length === 0) {
    return new Response(`Airdrop with ID ${airdropId} not found.`, { status: 404 });
  }

  const data = airdropResult.rows[0];
  const rewardValue = data.max_reward ? new Intl.NumberFormat('en-US').format(data.max_reward) : 'Tokens';
  const rewardText = `${rewardValue} ${data.token_symbol || ''}`;
  const image = data.image || 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/app/moneygun/money.svg';
  const bg = 'https://raw.githubusercontent.com/StanleyMorgan/graphics/main/app/moneygun/background.png';

  return new ImageResponse(
    (
      <div
        tw="h-full w-full flex flex-col items-center justify-center"
        style={{
          backgroundImage: `url(${bg})`,
          backgroundSize: '1200px 800px',
          fontFamily: '"Inter"',
        }}
      >
        <div tw="flex flex-col items-center justify-center text-center bg-white/90 rounded-3xl p-10 px-16 shadow-2xl w-[85%] max-w-[900px]">
          <img
            src={image}
            tw="w-44 h-44 rounded-2xl object-cover mb-5 border-2 border-gray-200"
          />
          <h1 tw="text-6xl text-gray-800 m-0 mb-4 leading-tight">{data.name}</h1>
          <p tw="text-5xl text-gray-600 m-0">
            Reward: <span tw="text-purple-600 font-bold">{rewardText}</span>
          </p>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 800,
      fonts: [{ name: 'Inter', data: font, style: 'normal' }],
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300',
      },
    },
  );
}
