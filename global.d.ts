// FIX: Explicitly import React types and use module augmentation to ensure types are correctly applied.
// This resolves issues where TypeScript fails to recognize augmentations for global JSX.
import type * as React from 'react';

// Augment the 'react' module to add the `tw` prop for @vercel/og's Tailwind-like styling.
declare module 'react' {
  interface HTMLAttributes<T> {
    tw?: string;
  }
}

declare global {
  // Augment the NodeJS namespace to include environment variables and missing process types.
  namespace NodeJS {
    interface ProcessEnv {
      readonly REOWN_PROJECT_ID: string;
    }
    // Add type for process.cwd() to resolve potential type errors in Vercel functions
    interface Process {
      cwd(): string;
    }
  }

  // Augment the JSX namespace to include custom elements like 'appkit-connect-button'.
  namespace JSX {
    interface IntrinsicElements {
      'appkit-connect-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        // FIX: Made `label` a required property to match the base type definition from `@reown/appkit`, resolving a type incompatibility error.
        label: string;
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

// This empty export is no longer needed as the file is now a module due to the import.
