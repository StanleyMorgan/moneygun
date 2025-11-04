

import React from 'react';
import { TwitterIcon } from './icons/TwitterIcon';
import { GitHubIcon } from './icons/GitHubIcon';
import { FarcasterIcon } from './icons/FarcasterIcon';

const Footer: React.FC = () => {
  return (
    <footer className="text-center py-6 px-4 text-slate-500 text-xs mt-auto">
      <div className="flex justify-center items-center space-x-4 mb-2">
        <a 
          href="https://twitter.com/stmorgan88" 
          target="_blank" 
          rel="noopener noreferrer"
          aria-label="Twitter"
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <TwitterIcon className="w-5 h-5" />
        </a>
        <a
          href="https://farcaster.xyz/stmorgan"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Farcaster"
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <FarcasterIcon className="w-5 h-5" />
        </a>
        <a 
          href="https://github.com/StanleyMorgan" 
          target="_blank" 
          rel="noopener noreferrer"
          aria-label="GitHub"
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <GitHubIcon className="w-5 h-5" />
        </a>
      </div>
      <p>Moneygun for Farcaster</p>
    </footer>
  );
};

export default Footer;