/// <reference types="react" />

// By converting this file to a script (by removing top-level imports/exports),
// it becomes part of the global scope and is automatically included by TypeScript.
// This resolves issues where module-based declaration files are not picked up
// without explicit inclusion in tsconfig.json.

// FIX: Converted this file to a global script by removing the 'declare global'
// wrapper and the 'export {}'. This ensures TypeScript automatically discovers
// and applies these type augmentations, resolving JSX intrinsic element errors
// for custom components like 'appkit-button'.

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
