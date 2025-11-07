/// <reference types="react" />

// FIX: Reverted from a module to a global script file to ensure types are available globally.
// The module-based augmentation with `declare global` and `export {}` was not being picked up
// by the compiler configuration, causing errors with custom JSX elements. This change makes
// the type definitions available to all files in the project without imports or references.

// Augment the NodeJS namespace to include environment variables for Vite.
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
      balance: 'show' | 'hide';
      size?: 'md' | 'sm';
      label: string;
      loadingLabel?: string;
      namespace?: 'eip155' | 'solana' | 'bip122';
    };
  }
}
