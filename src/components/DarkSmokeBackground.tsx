/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';

export type SmokeDensity = 'low' | 'medium' | 'high' | 'off';
export type AppThemeMode = 'light' | 'dark' | 'neon';

interface DarkSmokeBackgroundProps {
  isDarkMode?: boolean;
  themeMode?: AppThemeMode;
  density?: SmokeDensity;
  interactive?: boolean;
}

interface Particle {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  angle: number;
  vAngle: number;
  alpha: number;
  targetAlpha: number;
  color: string;
  seed: number;
}

interface Sparkle {
  x: number;
  y: number;
  radius: number;
  vy: number;
  vx: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
}

export const DarkSmokeBackground: React.FC<DarkSmokeBackgroundProps> = ({
  isDarkMode = true,
  themeMode,
  density = 'medium',
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; prevX: number; prevY: number; speed: number }>({
    x: -1000,
    y: -1000,
    prevX: -1000,
    prevY: -1000,
    speed: 0,
  });

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (density === 'off') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles();
    };

    window.addEventListener('resize', handleResize);

    // Mouse movement interaction for smoke swirl wakes
    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const m = mouseRef.current;
      const dx = e.clientX - m.x;
      const dy = e.clientY - m.y;
      m.speed = Math.min(Math.sqrt(dx * dx + dy * dy), 40);
      m.prevX = m.x;
      m.prevY = m.y;
      m.x = e.clientX;
      m.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
      mouseRef.current.speed = 0;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    const effectiveTheme: AppThemeMode = themeMode || (isDarkMode ? 'dark' : 'light');
    const isDark = effectiveTheme !== 'light';

    // Particle pool setup based on density
    const particleCount =
      density === 'low' ? 35 : density === 'medium' ? 65 : 100;
    const sparkleCount = effectiveTheme === 'neon' ? 36 : isDark ? 24 : 10;

    let particles: Particle[] = [];
    let sparkles: Sparkle[] = [];

    const smokeColorsDark = [
      'rgba(15, 23, 42, ',    // deep slate
      'rgba(30, 41, 59, ',    // slate-800
      'rgba(2, 44, 34, ',     // subtle emerald smoke
      'rgba(19, 78, 74, ',    // deep cyan/teal smoke
      'rgba(39, 39, 42, ',    // zinc-800
      'rgba(10, 15, 28, ',    // dark navy smoke
    ];

    const smokeColorsNeon = [
      'rgba(6, 182, 212, ',   // electric cyan
      'rgba(16, 185, 129, ',  // neon emerald
      'rgba(217, 70, 239, ',  // neon magenta
      'rgba(99, 102, 241, ',  // electric indigo
      'rgba(2, 44, 34, ',     // emerald undertone
      'rgba(15, 23, 42, ',    // obsidian slate
    ];

    const smokeColorsLight = [
      'rgba(226, 232, 240, ', // slate-200
      'rgba(203, 213, 225, ', // slate-300
      'rgba(209, 250, 229, ', // light emerald mist
      'rgba(241, 245, 249, ', // slate-100
    ];

    const palette =
      effectiveTheme === 'neon'
        ? smokeColorsNeon
        : isDark
        ? smokeColorsDark
        : smokeColorsLight;

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        const radius = Math.random() * 180 + 100;
        const color = palette[Math.floor(Math.random() * palette.length)];
        const maxAlpha =
          effectiveTheme === 'neon'
            ? Math.random() * 0.22 + 0.08
            : isDark
            ? Math.random() * 0.16 + 0.05
            : Math.random() * 0.25 + 0.08;
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius,
          vx: (Math.random() - 0.48) * 0.4,
          vy: -(Math.random() * 0.45 + 0.15),
          angle: Math.random() * Math.PI * 2,
          vAngle: (Math.random() - 0.5) * 0.004,
          alpha: Math.random() * maxAlpha,
          targetAlpha: maxAlpha,
          color,
          seed: Math.random() * 1000,
        });
      }

      sparkles = [];
      for (let i = 0; i < sparkleCount; i++) {
        let sparkColor = 'rgba(52, 211, 153, ';
        if (effectiveTheme === 'neon') {
          const rand = Math.random();
          sparkColor =
            rand > 0.65
              ? 'rgba(0, 240, 255, '
              : rand > 0.3
              ? 'rgba(57, 255, 20, '
              : 'rgba(232, 121, 249, ';
        } else if (isDark) {
          sparkColor = Math.random() > 0.4 ? 'rgba(52, 211, 153, ' : 'rgba(251, 191, 36, ';
        } else {
          sparkColor = 'rgba(16, 185, 129, ';
        }

        sparkles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: effectiveTheme === 'neon' ? Math.random() * 2 + 0.8 : Math.random() * 1.5 + 0.5,
          vy: -(Math.random() * 0.6 + 0.2),
          vx: (Math.random() - 0.5) * 0.3,
          alpha: Math.random() * 0.8 + 0.2,
          life: Math.random() * 300,
          maxLife: Math.random() * 200 + 200,
          color: sparkColor,
        });
      }
    };

    initParticles();

    // Cache pre-rendered soft radial smoke puff canvas for ultra-fast GPU blits
    const puffCacheCanvas = document.createElement('canvas');
    puffCacheCanvas.width = 256;
    puffCacheCanvas.height = 256;
    const pCtx = puffCacheCanvas.getContext('2d');
    if (pCtx) {
      const grad = pCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.7)');
      grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      pCtx.fillStyle = grad;
      pCtx.fillRect(0, 0, 256, 256);
    }

    let time = 0;
    let isVisible = !document.hidden;

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const render = () => {
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      time += 0.008;
      ctx.clearRect(0, 0, width, height);

      // Deep dark atmosphere background gradient
      if (effectiveTheme === 'neon') {
        const bgGrad = ctx.createRadialGradient(
          width * 0.5,
          height * 0.35,
          80,
          width * 0.5,
          height * 0.5,
          Math.max(width, height)
        );
        bgGrad.addColorStop(0, '#0b1329');
        bgGrad.addColorStop(0.35, '#060a17');
        bgGrad.addColorStop(0.75, '#030610');
        bgGrad.addColorStop(1, '#010206');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
      } else if (isDark) {
        const bgGrad = ctx.createRadialGradient(
          width * 0.5,
          height * 0.35,
          100,
          width * 0.5,
          height * 0.5,
          Math.max(width, height)
        );
        bgGrad.addColorStop(0, '#090d16');
        bgGrad.addColorStop(0.5, '#060911');
        bgGrad.addColorStop(1, '#020408');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
      } else {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#f8fafc');
        bgGrad.addColorStop(1, '#f1f5f9');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
      }

      const m = mouseRef.current;

      // Draw and update smoke plumes
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!prefersReducedMotion) {
          // Natural atmospheric wave
          p.x += p.vx + Math.sin(time + p.seed) * 0.35;
          p.y += p.vy;
          p.angle += p.vAngle;

          // Mouse vortex swirl wake
          if (m.x > 0 && m.y > 0) {
            const dx = p.x - m.x;
            const dy = p.y - m.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 220 && dist > 1) {
              const force = ((220 - dist) / 220) * 1.8;
              p.x += (dx / dist) * force;
              p.y += (dy / dist) * force - 0.4;
              p.alpha = Math.min(p.targetAlpha * 1.4, 0.28);
            }
          }

          // Boundary wraps
          if (p.y < -p.radius * 2) {
            p.y = height + p.radius;
            p.x = Math.random() * width;
          }
          if (p.x < -p.radius * 2) p.x = width + p.radius;
          if (p.x > width + p.radius * 2) p.x = -p.radius;
        }

        // Draw radial smoke puff
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = p.alpha;

        const radial = ctx.createRadialGradient(0, 0, 0, 0, 0, p.radius);
        radial.addColorStop(0, p.color + '0.9)');
        radial.addColorStop(0.4, p.color + '0.5)');
        radial.addColorStop(0.8, p.color + '0.15)');
        radial.addColorStop(1, p.color + '0)');

        ctx.fillStyle = radial;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw subtle drifting micro-embers in dark mode
      if (isDarkMode && !prefersReducedMotion) {
        ctx.save();
        for (let i = 0; i < sparkles.length; i++) {
          const s = sparkles[i];
          s.y += s.vy;
          s.x += s.vx + Math.sin(time * 2 + s.life * 0.05) * 0.4;
          s.life++;

          if (s.y < -10 || s.life >= s.maxLife) {
            s.y = height + 10;
            s.x = Math.random() * width;
            s.life = 0;
            s.maxLife = Math.random() * 200 + 200;
          }

          const progress = s.life / s.maxLife;
          const currentAlpha = Math.sin(progress * Math.PI) * s.alpha;

          ctx.fillStyle = s.color + currentAlpha.toFixed(2) + ')';
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
          ctx.fill();

          // Soft ember glow
          ctx.fillStyle = s.color + (currentAlpha * 0.25).toFixed(2) + ')';
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius * 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelAnimationFrame(animationFrameId);
    };
  }, [density, isDarkMode, themeMode, interactive, prefersReducedMotion]);

  if (density === 'off') return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-700"
      style={{ opacity: 1 }}
      aria-hidden="true"
    />
  );
};
