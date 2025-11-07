/// <reference types="react" />

// FIX: Wrap namespace augmentations in `declare global` and add an empty `export {}`
// to ensure this file is treated as a module. This is the correct way to augment
// global types like `NodeJS.ProcessEnv` and `JSX.IntrinsicElements` in a modern
// TypeScript project.
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
        balance: 'show' | 'hide';
        size?: 'md' | 'sm';
        label: string;
        loadingLabel?: string;
        namespace?: 'eip155' | 'solana' | 'bip122';
      };
    }
  }
}

export {};
