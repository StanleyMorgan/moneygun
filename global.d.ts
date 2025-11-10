/// <reference types="react" />

// FIX: Added 'import "react"' to ensure JSX typings are loaded before augmentation.
// This resolves issues in some environments where custom element types are not recognized.
import 'react';

// FIX: This file is now an explicit module with global declarations. This ensures TypeScript
// correctly augments the global JSX namespace for custom elements like 'appkit-button',
// resolving "does not exist on type 'JSX.IntrinsicElements'" errors.
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
        disabled: boolean;
        balance: 'show' | 'hide';
        size: 'md' | 'sm';
        label: string;
        loadingLabel: string;
        namespace: 'eip155' | 'solana' | 'bip122';
      };
    }
  }
}

// This empty export ensures the file is treated as a module.
export {};
