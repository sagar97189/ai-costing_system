import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

import { FooterBackground } from './FooterBackground';
import { AnimatedLogo } from './AnimatedLogo';
import { SocialIcons } from './SocialIcons';
import { FooterLinks } from './FooterLinks';

gsap.registerPlugin(useGSAP);

export function Footer() {
  const footerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!footerRef.current) return;
    
    const tl = gsap.timeline({ paused: true });
    
    // Animate the huge logo first
    tl.from('.footer-logo-wrapper', {
      y: 100,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out'
    });

    // Animate the footer columns
    tl.from('.footer-column', {
      y: 40,
      opacity: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: 'power2.out'
    }, '-=0.4');

    // Bottom bar
    tl.from('.footer-bottom-bar', {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out'
    }, '-=0.2');

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        tl.play();
        observer.disconnect();
      }
    }, { threshold: 0.15 });

    observer.observe(footerRef.current);

    return () => observer.disconnect();
  }, { scope: footerRef });

  return (
    <footer ref={footerRef} className="relative w-full min-h-screen bg-[#030811] flex flex-col justify-between overflow-hidden pt-20">
      <FooterBackground />
      
      <div ref={contentRef} className="relative z-10 w-full flex flex-col flex-1">
        
        {/* Massive Logo Area - Full Bleed */}
        <div className="footer-logo-wrapper flex-1 flex flex-col justify-end min-h-[40vh] md:min-h-[50vh] w-full px-2 sm:px-4">
          <AnimatedLogo />
        </div>

        {/* Content Layout - Constrained for readability */}
        <div className="max-w-[1500px] mx-auto w-full px-6 md:px-12 flex flex-col lg:flex-row justify-between items-start mt-4 mb-20">
          <div className="footer-column w-full lg:w-auto mb-16 lg:mb-0">
            <SocialIcons />
          </div>
          <FooterLinks />
        </div>

        {/* Bottom Bar - Constrained */}
        <div className="max-w-[1500px] mx-auto w-full px-6 md:px-12">
          <div className="footer-bottom-bar flex flex-col sm:flex-row justify-between items-center py-8 border-t border-white/10 text-[10px] sm:text-xs font-mono uppercase tracking-widest text-white/30 z-20 relative">
            <span>© {new Date().getFullYear()} Amanzi</span>
            <span className="mt-2 sm:mt-0">Made with AI + Engineering</span>
          </div>
        </div>
        
      </div>
    </footer>
  );
}
