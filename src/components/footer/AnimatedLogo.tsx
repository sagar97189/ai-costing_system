import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';

export function AnimatedLogo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const textWrapperRef = useRef<HTMLDivElement>(null);
  const filledTextRef = useRef<HTMLSpanElement>(null);

  const xTo = useRef<gsap.QuickToFunc>();
  const yTo = useRef<gsap.QuickToFunc>();

  useEffect(() => {
    if (!filledTextRef.current) return;
    // Set up GSAP quickTo for ultra-smooth custom CSS variables
    xTo.current = gsap.quickTo(filledTextRef.current, '--mouse-x', { duration: 0.2, ease: 'power3.out' });
    yTo.current = gsap.quickTo(filledTextRef.current, '--mouse-y', { duration: 0.2, ease: 'power3.out' });
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !textWrapperRef.current || !filledTextRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    // Calculate cursor position relative to the text wrapper for accurate masking
    const textRect = textWrapperRef.current.getBoundingClientRect();
    const x = e.clientX - textRect.left;
    const y = e.clientY - textRect.top;

    if (xTo.current && yTo.current) {
      xTo.current(x);
      yTo.current(y);
    }

    // Parallax logic relative to container center
    const containerCenterX = rect.width / 2;
    const containerCenterY = rect.height / 2;
    const mouseXFromCenter = e.clientX - rect.left;
    const mouseYFromCenter = e.clientY - rect.top;

    const moveX = ((mouseXFromCenter - containerCenterX) / containerCenterX) * 8;
    const moveY = ((mouseYFromCenter - containerCenterY) / containerCenterY) * 8;

    gsap.to(textWrapperRef.current, {
      x: moveX,
      y: moveY,
      duration: 0.6,
      ease: 'power2.out'
    });

    // Smoothly fade in the mask
    gsap.to(filledTextRef.current, {
      opacity: 1,
      duration: 0.2,
      ease: 'power2.out'
    });
  };

  const handleMouseLeave = () => {
    if (!textWrapperRef.current || !filledTextRef.current) return;

    // Fade out the mask
    gsap.to(filledTextRef.current, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.out'
    });

    // Reset Parallax
    gsap.to(textWrapperRef.current, {
      x: 0,
      y: 0,
      duration: 1.2,
      ease: 'power3.out'
    });
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full pt-10 md:pt-20 pb-0 flex justify-center items-center group cursor-default z-10 perspective-[1000px] pointer-events-auto"
    >
      <div
        ref={textWrapperRef}
        className="relative transition-transform duration-[1s] ease-[cubic-bezier(0.22,0.61,0.36,1)] group-hover:scale-[1.02] w-full flex justify-center"
      >
        <div
          className="relative font-sans font-black leading-none tracking-tight w-full text-center"
          style={{ fontSize: 'clamp(60px, 25vw, 600px)' }}
        >
          {/* Base Outline Layer (Always Visible) */}
          <span
            className="relative z-10 text-transparent pointer-events-none select-none block"
            style={{ WebkitTextStroke: '1px rgba(255,255,255,0.25)' }}
          >
            Amanzi
          </span>

          {/*s Filled Spotlight Layer */}
          <span
            ref={filledTextRef}
            className="absolute inset-0 z-20 text-transparent bg-clip-text pointer-events-none opacity-0 block"
            style={{
              '--mouse-x': '500',
              '--mouse-y': '200',
              // Layer 1: Moving Light Sweep highlight
              // Layer 2: Cool green/cyan gradient base
              backgroundImage: 'linear-gradient(110deg, transparent 20%, rgba(255,255,255,0.6) 30%, transparent 40%), linear-gradient(to right, #DDF568, #9DF6AF, #8CF1E8, #A0F2F9, #DDF568)',
              backgroundSize: '200% auto, 200% auto',
              WebkitMaskImage: 'radial-gradient(circle clamp(110px, 15vw, 150px) at calc(var(--mouse-x) * 1px) calc(var(--mouse-y) * 1px), black 0%, black 45%, transparent 100%)',
              maskImage: 'radial-gradient(circle clamp(110px, 15vw, 150px) at calc(var(--mouse-x) * 1px) calc(var(--mouse-y) * 1px), black 0%, black 45%, transparent 100%)',
            } as React.CSSProperties}
          >
            Amanzi
          </span>

          {/* Animation for the background shifting and the light sweep */}
          <style>{`
          .group:hover span.bg-clip-text {
            animation: spotlight-shift 4s linear infinite;
          }
          @keyframes spotlight-shift {
            0% { background-position: -200% center, 0% center; }
            100% { background-position: 200% center, 200% center; }
          }
        `}</style>
        </div>
      </div>
    </div>
  );
}
