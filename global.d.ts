declare global {
  // Fix: Define ChainNamespace to resolve the "Cannot find name 'ChainNamespace'" error.
  type ChainNamespace = 'eip155' | 'solana';

  interface ImportMetaEnv {
    readonly VITE_REOWN_PROJECT_ID: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  namespace JSX {
    interface IntrinsicElements {
      // Fix: Update type definition for 'appkit-button' to include component-specific properties.
      'appkit-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        label?: string;
        disabled?: boolean;
        size?: 'sm' | 'md' | 'lg';
        loadingLabel?: string;
        balance?: 'show' | 'hide';
        // Fix: Changed type from `string` to `ChainNamespace` to resolve incompatibility with AppKit's types.
        namespace?: ChainNamespace;
      };
    }
  }
}

export {};
