/// <reference types="react" />

// FIX: To resolve module augmentation issues and provide global types, this file is explicitly
// converted to a module by adding `export {}`. All global declarations and augmentations are
// then wrapped in `declare global {}`. This is the standard and most robust way to handle
// global type definitions in TypeScript, fixing errors related to unrecognized custom JSX elements.
declare global {
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
}

// By exporting an empty object, we treat this file as a module, which is necessary
// for `declare global` to work correctly.
export {};
