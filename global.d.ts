/// <reference types="react" />

// FIX: This file must be a module to augment global types. The `export {}` at the end ensures this.
// The `declare global` block is then used to extend existing global interfaces. This resolves the
// error "Top-level declarations in .d.ts files must start with either a 'declare' or 'export' modifier."
declare global {
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
        // FIX: Made `label` a required property to match the base type definition from `@reown/appkit`, resolving a type incompatibility error.
        label: string;
        size?: 'sm' | 'md';
        loadingLabel?: string;
      };
      // Add appkit-button for displaying connected state
      'appkit-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        disabled: boolean;
        balance: 'show' | 'hide';
        size: 'md' | 'sm';
        label: string;
        loadingLabel: string;
        namespace: 'eip155' | 'solana' | 'bip122';
      };
    }
  }
}

// This empty export is what turns this file into a module.
export {};
