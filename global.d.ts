/// <reference types="react" />

// FIX: Converted this file from a module back to a global script file. This
// ensures TypeScript automatically includes it for global namespace
// augmentation, making the custom JSX element types available throughout the
// project and resolving errors in components like Header.tsx.

// Define ChainNamespace as a global type.
// FIX: Added 'declare' to define a global type alias in a script file,
// resolving the "Top-level declarations must start with 'declare' or 'export'"
// error and allowing the JSX namespace augmentations to be processed correctly.
declare type ChainNamespace = 'eip155' | 'solana';

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
      balance?: 'show' | 'hide';
      size?: 'md' | 'sm';
      label?: string;
      loadingLabel?: string;
      namespace?: 'eip155' | 'solana' | 'bip122';
    };
  }
}
