// Fix: Use a triple-slash directive to reference React types instead of an import statement.
// This makes the file a script-style declaration file, ensuring declarations are truly global
// and avoiding potential module resolution issues with TypeScript configurations.
/// <reference types="react" />

// By being a script file (no top-level imports/exports), declarations here are global.

// Define ChainNamespace as a global type.
type ChainNamespace = 'eip155' | 'solana';

// Augment the NodeJS namespace to include environment variables.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly REOWN_PROJECT_ID: string;
  }
}

// Augment the JSX namespace to include the 'appkit-button' custom element.
declare namespace JSX {
  interface IntrinsicElements {
    // Fix: Define types for the 'appkit-button' custom element, resolving the error where it was not found.
    'appkit-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      label: string;
      disabled?: boolean;
      size?: 'sm' | 'md' | 'lg';
      loadingLabel?: string;
      balance?: 'show' | 'hide';
      namespace?: ChainNamespace;
    };
  }
}
