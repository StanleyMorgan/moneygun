import type React from 'react';

// Fix: Converted the file to a module and used `declare global` to ensure TypeScript recognizes the custom element type definitions.
// This is a more robust approach for augmenting global scope in modern toolchains.
declare global {
  // Define ChainNamespace as a global type.
  type ChainNamespace = 'eip155' | 'solana';

  // Augment the NodeJS namespace to include environment variables.
  namespace NodeJS {
    interface ProcessEnv {
      readonly REOWN_PROJECT_ID: string;
    }
  }

  // Augment the JSX namespace to include the 'appkit-button' custom element.
  namespace JSX {
    interface IntrinsicElements {
      'appkit-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        label: string;
        disabled?: boolean;
        size?: 'sm' | 'md' | 'lg';
        loadingLabel?: string;
        balance?: 'show' | 'hide';
        address?: 'show' | 'hide';
        namespace?: ChainNamespace;
      };
    }
  }
}
