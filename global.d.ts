/// <reference types="react" />

// FIX: Reverted to a global script file declaration to ensure TypeScript recognizes custom elements.
// This avoids module augmentation issues that can arise from tsconfig misconfigurations.

// FIX: Removed the `declare global` wrapper. The error "Augmentations for the global scope can only be directly nested in external modules or ambient module declarations" occurs because this file is treated as a global script (it has no top-level imports or exports). In a global script, declarations are already in the global scope, making `declare global` both unnecessary and incorrect.

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
