/// <reference types="react" />

// FIX: Removed unused `ChainNamespace` type that was causing a compile error.

// FIX: Reverted to an ambient declaration file (not a module) by removing `export {}` and `declare global`. This ensures global type augmentations are correctly recognized by the TypeScript compiler and resolves errors for custom JSX elements like 'appkit-button'.
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
