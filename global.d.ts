/// <reference types="react" />

// FIX: The global type declarations for custom elements were not being applied, causing type errors.
// The file has been changed from a module using `declare global` to a global script file.
// This ensures that the custom JSX element types are augmented correctly in the global scope.

// Define ChainNamespace as a global type.
type ChainNamespace = 'eip155' | 'solana';

// Augment the NodeJS namespace to include environment variables.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly REOWN_PROJECT_ID: string;
  }
}

// Augment the JSX namespace to include the 'appkit-connect-button' custom element.
declare namespace JSX {
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
