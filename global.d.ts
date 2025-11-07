/// <reference types="react" />

// FIX: Converted to a module augmenting the global scope. This is the standard
// approach for extending global types and should resolve discovery and merging issues.
export {};

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
        // FIX: The 'size' property is made required to match the base component's type definition
        // from the @reown/appkit library, resolving the extension incompatibility error.
        size: 'md' | 'sm';
        label: string;
        loadingLabel?: string;
        namespace?: 'eip155' | 'solana' | 'bip122';
      };
    }
  }
}
