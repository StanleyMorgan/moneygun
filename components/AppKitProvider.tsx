import React, { useEffect } from 'react';

const APP_KIT_SCRIPT_URL = 'https://app-kit.reown.io/script.js';

interface AppKitProviderProps {
  children: React.ReactNode;
}

export const AppKitProvider: React.FC<AppKitProviderProps> = ({ children }) => {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = APP_KIT_SCRIPT_URL;
    script.async = true;
    script.setAttribute('data-project-id', import.meta.env.VITE_REOWN_PROJECT_ID);

    document.head.appendChild(script);

    return () => {
      // Clean up the script when the component unmounts
      const existingScript = document.querySelector(`script[src="${APP_KIT_SCRIPT_URL}"]`);
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  return <>{children}</>;
};
