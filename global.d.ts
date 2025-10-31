// This file is converted into a module by adding `export {}`.
// This allows for correct global augmentation using `declare global`.
// This is the standard and most robust way to extend global types in TypeScript,
// which resolves issues with top-level declarations and interface merging.
export {};

declare global {
  // Define ChainNamespace as a global type.
  type ChainNamespace = 'eip155' | 'solana';

  // Augment the NodeJS namespace to include environment variables.
  namespace NodeJS {
    interface ProcessEnv {
      readonly REOWN_PROJECT_ID: string;
    }
  }

  // Augment the JSX namespace to include the 'appkit-button' custom element.
  namespace JSX {
    interface IntrinsicElements {
      'appkit-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        label: string;
        disabled?: boolean;
        size?: 'sm' | 'md' | 'lg';
        loadingLabel?: string;
        balance?: 'show' | 'hide';
        address?: 'show' | 'hide';
        namespace?: ChainNamespace;
      };
    }
  }
}
