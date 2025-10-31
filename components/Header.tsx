import React from 'react';
import { useAccount } from 'wagmi';

const Header: React.FC = () => {
  const { isConnected } = useAccount();

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-semibold tracking-tighter text-slate-800">
              Moneygun
            </span>
            <span className="text-xs font-medium text-slate-400 mt-1">
              for Farcaster
            </span>
          </div>
          {/* Conditionally render button based on connection status */}
          {isConnected ? (
            <appkit-button balance="show" />
          ) : (
            <appkit-connect-button label="Connect Wallet" />
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;