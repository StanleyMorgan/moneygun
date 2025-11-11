/// <reference types="react" />

// FIX: Add an explicit 'import type React' to ensure React types are available for JSX namespace augmentation.
// This robustly makes the file a module and should resolve issues where the type declarations for custom elements
// like 'appkit-button' were not being picked up by TypeScript.
import type React from 'react';

// FIX: This file must be a module to augment global types. The `export {}` at the end ensures this.
declare global {
  // Augment React's HTMLAttributes to include the `tw` prop for @vercel/og's Tailwind-like styling.
  namespace React {
    interface HTMLAttributes<T> {
      tw?: string;
    }
  }
  
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

// This empty export is what turns this file into a module.
export {};
