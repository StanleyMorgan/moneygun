declare module '@vercel/og' {
  import type { ReactElement } from 'react';

  export class ImageResponse extends Response {
    constructor(
      element: ReactElement,
      options?: {
        width?: number;
        height?: number;
        headers?: Record<string, string>;
        fonts?: {
          name: string;
          data: ArrayBuffer;
          style?: 'normal' | 'italic';
          weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
        }[];
        debug?: boolean;
      },
    // FIX: Removed the return type annotation from the constructor declaration. Constructors do not have return types.
    );
  }
}
