/// <reference types="react" />

// FIX: Removed unused `ChainNamespace` type that was causing a compile error.

// FIX: To augment global types, this file must be a module. Global augmentations
// are wrapped in `declare global`, and an empty `export {}` ensures the file is
// treated as a module, fixing the "Top-level declarations" error.
declare global {
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
        // FIX: The `label` property is required by the base AppKit element type. Making it non-optional resolves the type incompatibility.
        label: string;
        loadingLabel?: string;
        namespace?: 'eip155' | 'solana' | 'bip122';
      };
    }
  }
}

export {};