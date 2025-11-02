/// <reference types="react" />

// Add module declaration for keccak256 since @types/keccak256 does not exist.
declare module 'keccak256' {
  // This assumes the 'Buffer' type is available in the execution environment (Node.js for the API).
  function keccak256(data: Buffer | string): Buffer;
  export = keccak256;
}

// FIX: Correctly define global types and JSX augmentations by wrapping them in 'declare global'.
// This ensures TypeScript recognizes custom elements and global types across the project.
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
        label: string;
        size?: 'sm' | 'md';
        loadingLabel?: string;
      };
      // Add appkit-button for displaying connected state
      'appkit-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        disabled?: boolean;
        // FIX: The 'balance' property is made required to match the expected type from the AppKit library.
        balance: 'show' | 'hide';
        size?: 'md' | 'sm';
        label?: string;
        loadingLabel?: string;
        namespace?: 'eip155' | 'solana' | 'bip122';
      };
    }
  }
}

// Fix: Add an empty export to treat this file as a module. This is necessary for 'declare global' to work correctly and resolve the error "Augmentations for the global scope can only be directly nested in external modules".
export {};
