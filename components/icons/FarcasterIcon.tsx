
import React from 'react';

export const FarcasterIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    viewBox="0 0 256 256" 
    xmlns="http://www.w3.org/2000/svg" 
    fill="currentColor"
    {...props}
  >
    <path d="M48 64H112V80H64V176H48V64Z" />
    <path d="M128 64H144V128H192V112H208V192H144V176H192V144H128V64Z" />
  </svg>
);
