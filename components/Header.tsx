// FIX: Added a triple-slash directive to ensure this file can see the global type definitions for custom web components.
/// <reference path="../global.d.ts" />
import React from 'react';
import { useAccount } from 'wagmi';

const Header: React.FC = () => {
  const { address, isConnected, status } = useAccount();
  
  console.log('[Header Render] Account State:', { address, isConnected, status });

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img src="https://raw.githubusercontent.com/StanleyMorgan/graphics/main/app/moneygun/favicon.svg" alt="Moneygun Logo" className="w-8 h-8" />
            <span className="text-lg font-bold text-slate-800">Moneygun</span>
          </div>
          <div className="flex items-center">
            {isConnected ? (
                // FIX: Added the required 'size' property to appkit-button to align with updated type definitions.
                // FIX: Added the required 'disabled' property to align with the updated type definition.
                // FIX: Added the required 'loadingLabel' property to align with the updated type definition.
                // FIX: Added the required 'namespace' property to align with the updated type definition.
                <appkit-button balance="hide" label="" size="md" disabled={false} loadingLabel="" namespace="eip155" />
            ) : (
                <appkit-connect-button label="Connect" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;