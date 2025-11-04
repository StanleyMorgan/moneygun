// Fix: Manually include global type definitions to ensure custom JSX elements are recognized.
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
            <img src="/logo.svg" alt="Moneygun Logo" className="w-8 h-8" />
            <span className="text-lg font-bold text-slate-800">Moneygun</span>
          </div>
          <div className="flex items-center">
            {isConnected ? (
                <appkit-button balance="hide" />
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