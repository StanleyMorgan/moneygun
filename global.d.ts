/// <reference types="react" />

// FIX: Re-defined JSX augmentations in the global scope. By removing the 'declare global' wrapper 
// and 'export {}', this file is treated as a global script, which can resolve type augmentation issues 
// in some project setups.

// Define ChainNamespace as a global type.
type ChainNamespace = 'eip155' | 'solana';

// Augment the NodeJS namespace to include environment variables.
namespace NodeJS {
  interface ProcessEnv {
    readonly REOWN_PROJECT_ID: string;
  }
}

// Augment the JSX namespace to include custom elements like 'appkit-connect-button'.
namespace JSX {
  interface IntrinsicElements {
    'appkit-connect-button': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    > & {
      label?: string;
      size?: 'sm' | 'md';
      loadingLabel?: string;
    };
    // Add appkit-button for displaying connected state
    'appkit-button': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement>,
      HTMLElement
    > & {
      disabled?: boolean;
      // Fix: Made the 'balance' property optional to match its usage in the Header component.
      balance?: 'show' | 'hide';
      size?: 'md' | 'sm';
      label?: string;
      loadingLabel?: string;
      namespace?: 'eip155' | 'solana' | 'bip122';
    };
  }
}
