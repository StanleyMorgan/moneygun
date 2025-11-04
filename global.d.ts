/// <reference types="react" />

// FIX: The file is now a global script, not a module, to ensure augmentations are applied globally.
// This resolves issues where TypeScript wouldn't recognize custom elements like `appkit-button`.

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
      // FIX: The 'balance' property is required by the base AppKit element type, so it cannot be optional.
      balance: 'show' | 'hide';
      size?: 'md' | 'sm';
      label?: string;
      loadingLabel?: string;
      namespace?: 'eip155' | 'solana' | 'bip122';
    };
  }
}
