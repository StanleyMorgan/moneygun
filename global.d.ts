declare global {
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
        namespace?: string;
      };
    }
  }
}

export {};
