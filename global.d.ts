/// <reference types="react" />

// FIX: The global type declarations were not being correctly applied, causing errors.
// This has been refactored to use `declare global`, which is the standard TypeScript
// pattern for augmenting global types from within a module. This ensures that the
// custom JSX elements are recognized by the compiler.
declare global {
  // Define ChainNamespace as a global type.
  type ChainNamespace = 'eip155' | 'solana';

  // Augment the NodeJS namespace to include environment variables.
  namespace NodeJS {
    interface ProcessEnv {
      readonly REOWN_PROJECT_ID: string;
    }
  }

  // Augment the JSX namespace to include the 'appkit-connect-button' custom element.
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
}

// This empty export is required to turn this file into a module,
// which is necessary for `declare global` to work.
export {};
