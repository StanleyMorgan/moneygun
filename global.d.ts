import type React from 'react';

// Fix: Reverted to a global ambient declaration file. The module-based approach with `declare global`
// was not being correctly processed. This ensures the custom element type is globally available.
// This requires React types to be available globally, which is standard in a Vite+React setup.

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
