/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface RunningBorderCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  enabled?: boolean;
  glowColor?: 'cyan' | 'emerald' | 'magenta' | 'amber' | 'multi';
  speed?: 'normal' | 'fast' | 'slow';
  className?: string;
  innerClassName?: string;
}

export const RunningBorderCard: React.FC<RunningBorderCardProps> = ({
  children,
  enabled = true,
  glowColor = 'multi',
  speed = 'normal',
  className = '',
  innerClassName = '',
  ...rest
}) => {
  if (!enabled) {
    return (
      <div className={`${className}`} {...rest}>
        {children}
      </div>
    );
  }

  const speedClass =
    speed === 'fast'
      ? 'duration-2000'
      : speed === 'slow'
      ? 'duration-8000'
      : 'duration-4000';

  return (
    <div
      className={`relative p-[1.5px] rounded-2xl overflow-hidden group shadow-sm transition-shadow hover:shadow-lg ${className}`}
      {...rest}
    >
      {/* Running Border Glow Beam Layer */}
      <div
        className={`absolute inset-[-100%] pointer-events-none animate-border-beam-spin ${speedClass}`}
        style={{
          background:
            glowColor === 'cyan'
              ? 'conic-gradient(from 0deg, transparent 0 65%, #00f0ff 85%, #38bdf8 95%, transparent 100%)'
              : glowColor === 'emerald'
              ? 'conic-gradient(from 0deg, transparent 0 65%, #10b981 85%, #34d399 95%, transparent 100%)'
              : glowColor === 'magenta'
              ? 'conic-gradient(from 0deg, transparent 0 65%, #d946ef 85%, #f472b6 95%, transparent 100%)'
              : glowColor === 'amber'
              ? 'conic-gradient(from 0deg, transparent 0 65%, #f59e0b 85%, #fbbf24 95%, transparent 100%)'
              : 'conic-gradient(from 0deg, transparent 0 50%, #00f0ff 70%, #10b981 85%, #d946ef 95%, transparent 100%)',
          willChange: 'transform',
        }}
      />

      {/* Subtle Ambient Glow Aura behind border */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none opacity-40 group-hover:opacity-75 transition-opacity"
        style={{
          boxShadow:
            glowColor === 'cyan'
              ? '0 0 15px rgba(0, 240, 255, 0.25)'
              : glowColor === 'emerald'
              ? '0 0 15px rgba(16, 185, 129, 0.25)'
              : '0 0 18px rgba(0, 240, 255, 0.18), 0 0 25px rgba(16, 185, 129, 0.12)',
        }}
      />

      {/* Inner Content Container */}
      <div
        className={`relative z-10 w-full h-full rounded-[calc(1rem-1.5px)] bg-white dark:bg-slate-900 overflow-hidden ${innerClassName}`}
      >
        {children}
      </div>
    </div>
  );
};
