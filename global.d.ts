// FIX: Converted to a classic ambient declaration file by removing module syntax (`export {}`)
// and the `declare global` wrapper. This ensures these type augmentations are applied
// project-wide, resolving issues with custom JSX elements not being recognized.
/// <reference types="react" />

// FIX: Removed the `declare global` wrapper. A `.d.ts` file without top-level imports/exports is a global script,
// so its declarations are already in the global scope. `declare global` is only valid inside a module.
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
      // FIX: Made 'namespace' property required to match the base type from @reown/appkit.
      namespace: 'eip155' | 'solana' | 'bip122';
    };
  }
}
