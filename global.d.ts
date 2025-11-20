import React from 'react';

declare module 'react' {
  interface HTMLAttributes<T> {
    tw?: string;
  }
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly REOWN_PROJECT_ID: string;
    }
    interface Process {
      cwd(): string;
    }
  }

  namespace JSX {
    interface IntrinsicElements {
      'appkit-connect-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        label: string;
        size: 'sm' | 'md';
        loadingLabel: string;
      };
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
