import React from 'react';

/**
 * Diagonal sweeping broom icon matching user-provided asset.
 */
export default function SweepingBroomIcon({ size = 20, color = 'currentColor', className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      aria-hidden="true"
    >
      {/* Diagonal Handle */}
      <path d="M21.2 2.8a1.1 1.1 0 0 0-1.56 0l-7.1 7.1 1.56 1.56 7.1-7.1a1.1 1.1 0 0 0 0-1.56z" />
      {/* Dome Collar */}
      <path d="M9.6 10.6c1.45-1.05 3.4-.9 4.65.35s1.4 3.2.35 4.65l-5-5z" />
      {/* Flared Broom Head with Bristle Splits */}
      <path d="M8.8 11.4l4.8 4.8c-1.45 2.35-3.45 4.35-5.8 5.8l-1.9-1.1 1.9-2.8-2.9 2.1-1.6-1.1 2.4-2.6-3.2 1.6-1.4-1.2c2.8-1.4 5.5-3.1 7.7-5.5z" />
    </svg>
  );
}

