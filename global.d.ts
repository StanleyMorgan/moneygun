// Fix: Wrap in `declare global` to correctly extend JSX types when file is treated as a module.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'appkit-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

// Fix: Add an empty export to ensure this file is treated as a module, which is required for `declare global` to work correctly.
export {};
