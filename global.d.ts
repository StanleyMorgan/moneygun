/// <reference types="react" />

// FIX: Converted the file from a module to a global script to ensure type augmentations are applied globally.
// This resolves compiler errors where JSX intrinsic elements for appkit components were not being found.

// Augment the NodeJS namespace to include environment variables for Vite.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly REOWN_PROJECT_ID: string;
  }
}

// Augment the JSX namespace to include custom elements like 'appkit-connect-button'.
declare namespace JSX {
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
      disabled: boolean;
      balance: 'show' | 'hide';
      size: 'md' | 'sm';
      label: string;
      loadingLabel: string;
      namespace: 'eip155' | 'solana' | 'bip122';
    };
  }
}
