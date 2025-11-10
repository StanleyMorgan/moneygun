/// <reference types="react" />

// FIX: This file is now an ambient declaration file, not a module. This ensures
// TypeScript correctly augments the global JSX namespace for custom elements
// like 'appkit-button', resolving "does not exist on type 'JSX.IntrinsicElements'" errors.
// By being a non-module, its declarations are automatically included in the compilation.

// FIX: Removed the `declare global` wrapper to resolve "Augmentations for the global scope can only be directly nested in external modules or ambient module declarations." error.
// Since this file is not a module (it has no top-level import/export), the `namespace` augmentations automatically apply to the global scope.
// The wrapper is only needed within modules.

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
