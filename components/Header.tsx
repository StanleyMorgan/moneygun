
import React from 'react';
import { FarcasterIcon } from './icons/FarcasterIcon';

const Header: React.FC = () => {
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
          <button className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2">
            <FarcasterIcon className="w-4 h-4" />
            Connect
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
