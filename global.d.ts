// FIX: Converted to a module using `declare global` to provide robust, project-wide
// type augmentation for custom JSX elements. This is generally more reliable than
// relying on ambient script file inclusion.
import 'react';

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
        // FIX: Made 'disabled' property required to resolve the type incompatibility with the base 'AppKitElements' interface.
        disabled: boolean;
        balance: 'show' | 'hide';
        // FIX: The 'size' property is made required to match the base component's type definition
        // from the @reown/appkit library, resolving the extension incompatibility error.
        size: 'md' | 'sm';
        label: string;
        // FIX: Made 'loadingLabel' property required to match the base type from @reown/appkit.
        loadingLabel: string;
        namespace?: 'eip155' | 'solana' | 'bip122';
      };
    }
  }
}

// Ensure this file is treated as a module.
export {};