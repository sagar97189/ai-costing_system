import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { ArrowDown, ArrowRight, Mail, CheckCircle2, XCircle, Cpu, Layers } from 'lucide-react';
import { Footer } from './components/footer/Footer';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function Header() {
  return (
    <header className="fixed top-0 left-0 w-full z-40 px-4 py-[0.85rem] md:px-7 md:py-4 flex items-center justify-between bg-gradient-to-b from-[#06111f] to-transparent">
      <div className="font-anton uppercase text-[clamp(0.92rem,1.5vw,1.25rem)] tracking-[0.08em] text-powder">
        Amanzi
      </div>

      <nav className="hidden md:flex items-center gap-6 bg-ice-900/60 backdrop-blur-md px-6 py-2 rounded-full text-xs font-mono uppercase tracking-wider border border-white/5">
        <a href="#features" className="hover:text-signal transition-colors">Features</a>
        <a href="#lookbook" className="hover:text-signal transition-colors">Lookbook</a>
        <a href="#api" className="hover:text-signal transition-colors">API Specs</a>
      </nav>

      <div className="px-3 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs uppercase font-mono tracking-wider border border-gear/30 bg-gear/10 text-gear rounded-full">
        login
      </div>
    </header>
  );
}

const HERO_COPY = [
  {
    title: <>Automated Data, <br />Zero Friction</>,
    desc: "Extract features, BOMs, and dimensions from engineering drawings with our AI engine. Built for fast RFQ turnarounds."
  },
  {
    title: <>Instant Quoting, <br />Maximum Margins</>,
    desc: "Connect your ERP to our API and turn incoming PDFs directly into actionable pricing models in seconds."
  },
  {
    title: <>Intelligent Routing, <br />No Guesswork</>,
    desc: "Let AI parse the geometry and instantly route RFQs to the correct machining centers based on tolerances."
  }
];

const HERO_IMAGES = [
  '/assets/animation/hero.jpg',
  '/assets/animation/hero3 (1).jpg',
  '/assets/animation/hero3 (2).jpg'
];

function HeroSection() {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false); // start fade out
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % HERO_COPY.length);
        setFade(true); // start fade in
      }, 1000); // Wait for fade out
    }, 4500); // cycle duration

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="h-screen relative flex flex-col justify-between overflow-hidden bg-[#050d16]">

      {/* Background Image Carousel */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-black">
        {HERO_IMAGES.map((img, i) => (
          <img
            key={img}
            src={img}
            alt="Hero background"
            className={`absolute inset-0 w-full h-full object-cover mix-blend-lighten ${index === i ? 'opacity-60' : 'opacity-0'}`}
            style={{
              transition: 'opacity 1s ease-in-out, transform 8s ease-out',
              transform: index === i ? 'scale(1.15)' : 'scale(1)'
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-start justify-center w-full max-w-[min(1380px,100%)] mx-auto px-[clamp(1rem,3vw,2.25rem)] text-left">
        <div className={`transition-all duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)] transform ${fade ? 'opacity-100 translate-y-0 scale-100 blur-none' : 'opacity-0 translate-y-12 scale-[1.03] blur-md'}`}>
          <h1 className="font-anton uppercase text-[clamp(3rem,7.8vw,6.6rem)] leading-[1.06] max-w-4xl text-powder drop-shadow-2xl relative group cursor-crosshair text-left">
            <span className="relative inline-block text-left">
              <span className="inline-block text-left transition-opacity duration-300 group-hover:opacity-0">
                {HERO_COPY[index].title}
              </span>

              {/* Shattered Pieces */}
              <span
                className="absolute inset-0 text-left text-powder opacity-0 group-hover:opacity-100 transition-all duration-[400ms] ease-[cubic-bezier(0.175,0.885,0.32,1.275)] transform group-hover:-translate-x-[2%] group-hover:-translate-y-[4%] group-hover:rotate-[-2deg]"
                style={{ clipPath: 'polygon(0 0, 55% 0, 45% 50%, 35% 100%, 0 100%)' }}
                aria-hidden="true"
              >
                {HERO_COPY[index].title}
              </span>
              <span
                className="absolute inset-0 text-left text-powder opacity-0 group-hover:opacity-100 transition-all duration-[500ms] ease-[cubic-bezier(0.175,0.885,0.32,1.275)] transform group-hover:translate-x-[3%] group-hover:-translate-y-[2%] group-hover:rotate-[2deg]"
                style={{ clipPath: 'polygon(55% 0, 100% 0, 100% 45%, 45% 50%)' }}
                aria-hidden="true"
              >
                {HERO_COPY[index].title}
              </span>
              <span
                className="absolute inset-0 text-left text-powder opacity-0 group-hover:opacity-100 transition-all duration-[450ms] ease-[cubic-bezier(0.175,0.885,0.32,1.275)] transform group-hover:translate-x-[1%] group-hover:translate-y-[4%] group-hover:rotate-[1deg]"
                style={{ clipPath: 'polygon(45% 50%, 100% 45%, 100% 100%, 35% 100%)' }}
                aria-hidden="true"
              >
                {HERO_COPY[index].title}
              </span>
            </span>
          </h1>
          <p className="mt-6 font-mono text-ice-200 max-w-lg text-sm md:text-base leading-relaxed transition-opacity duration-1000 delay-100">
            {HERO_COPY[index].desc}
          </p>
          <div className="mt-8 transition-opacity duration-1000 delay-200">
            <button className="px-5 py-2 md:px-6 md:py-2.5 text-xs md:text-sm uppercase font-mono tracking-wider border border-gear/30 bg-gear/10 text-gear rounded-full hover:bg-gear/20 transition-colors">
              Get Started
            </button>
          </div>
        </div>
      </div>



      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-ice-950/40 via-transparent to-ice-950/80 z-0 mix-blend-multiply" />
    </section>
  );
}

const FEATURE_ITEMS = [
  {
    name: "RFQ Management",
    type: "Input",
    detail:
      "Capture customer RFQs, quantities, delivery requirements, customer details, and attached engineering drawings in one structured workflow.",
    stat: "RFQ → Structured Request",
  },
  {
    name: "ED Extraction",
    type: "AI Drawing Reading",
    detail:
      "AI reads engineering drawings and extracts dimensions, materials, tolerances, notes, child parts, and manufacturing details.",
    stat: "Drawing → Extracted Data",
  },
  {
    name: "Standard ED Mapping",
    type: "Normalization",
    detail:
      "Different customer drawing styles are converted into one internal standard ED format for comparison, validation, and approval.",
    stat: "Customer ED → Standard ED",
  },
  {
    name: "BOM Generation",
    type: "Bill of Materials",
    detail:
      "Generate parent-child BOM structures from assemblies, ballooned drawings, child parts, quantities, and extracted part details.",
    stat: "Assembly → Multi-Level BOM",
  },
  {
    name: "Part Master Matching",
    type: "Similarity Search",
    detail:
      "Use embeddings and similarity search to detect duplicate or similar parts before creating a new master part record.",
    stat: "Duplicate Reduction",
  },
  {
    name: "Routing Management",
    type: "Operations",
    detail:
      "Map operation sequences, machines, setup time, cycle time, alternate routing, wastage, and process-level manufacturing logic.",
    stat: "Part → Routing Plan",
  },
  {
    name: "Manufacturing Intelligence",
    type: "Production Logic",
    detail:
      "Connect BOM, routing, machine usage, labor, tooling, rejection, overhead, and wastage into one manufacturing costing flow.",
    stat: "BOM + Routing + Machine",
  },
  {
    name: "AI Cost Estimation",
    type: "Costing Engine",
    detail:
      "Estimate material, machine, labor, power, tooling, rejection, overhead, and wastage cost to support faster quotation decisions.",
    stat: "RFQ → Estimated Cost",
  },
];

function FeatureJumpSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const [progress, setProgress] = useState(0);

  // Load image sequence
  useEffect(() => {
    const frameCount = 100;
    for (let i = 0; i < frameCount; i++) {
      const img = new Image();
      const currentFrame = i.toString().padStart(3, '0');
      img.src = `/assets/animation/–_sec__Engineer_uploads_${currentFrame}.jpg`;
      imagesRef.current.push(img);
    }
  }, []);

  // Sync canvas with scroll
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let ctx = gsap.context(() => {
      const sequence = { frame: 0 };

      const render = () => {
        if (!canvas || !context) return;
        const frameIndex = Math.round(sequence.frame);
        const img = imagesRef.current[frameIndex];

        if (img && img.complete && img.naturalWidth > 0) {
          const hRatio = canvas.width / img.width;
          const vRatio = canvas.height / img.height;
          const ratio = Math.max(hRatio, vRatio);
          const centerShift_x = (canvas.width - img.width * ratio) / 2;
          const centerShift_y = (canvas.height - img.height * ratio) / 2;

          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(img, 0, 0, img.width, img.height,
            centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
        }
      };

      const handleResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        render();
      };

      handleResize();
      window.addEventListener('resize', handleResize);

      if (imagesRef.current[0]) {
        imagesRef.current[0].onload = render;
      }

      gsap.to(sequence, {
        frame: 99,
        snap: "frame",
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.5,
          onUpdate: render
        }
      });

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      const start = sectionRef.current.offsetTop;
      const range = sectionRef.current.offsetHeight - window.innerHeight;
      const currentScroll = window.scrollY - start;
      const p = Math.max(0, Math.min(1, currentScroll / range));
      setProgress(p);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const activeIndex = Math.min(
    FEATURE_ITEMS.length - 1,
    Math.floor(progress * FEATURE_ITEMS.length)
  );

  return (
    <section ref={sectionRef} className="h-[820vh] relative bg-ice-950" id="features">
      <div className="sticky top-0 h-screen w-full overflow-hidden flex flex-col justify-center">

        {/* Dynamic Image Sequence Background */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <canvas
            ref={canvasRef}
            className="w-full h-full object-cover mix-blend-lighten"
          />
        </div>

        {/* Existing Tech BG pattern over it */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div
            className="w-full h-full bg-transparent"
            style={{
              backgroundImage: 'linear-gradient(rgba(152, 245, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(152, 245, 255, 0.05) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              transform: `translateY(${-(progress * 100)}px)`
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-[min(1380px,100%)] mx-auto px-[clamp(1rem,3vw,2.25rem)] grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

          {/* Left Copy */}
          <div>
            <h2 className="font-anton uppercase text-[clamp(3rem,6vw,5.5rem)] leading-[1.02] text-powder mb-6">
              From RFQ <br />
              <span className="text-ice-800" style={{ WebkitTextStroke: '1px #98f5ff' }}>
                to Costing
              </span>
              <br />
              with AI
            </h2>
            <p className="font-mono text-ice-200 max-w-sm text-sm leading-relaxed">
              Each scroll step highlights one major function of the AI-assisted manufacturing costing system,
              from customer request to engineer-approved cost estimation.
            </p>
          </div>

          {/* Right Cards Sliding In */}
          <div className="relative h-[24rem] w-full max-w-[min(24rem,calc(100vw-2rem))] ml-auto perspective-1000">
            {FEATURE_ITEMS.map((item, idx) => {
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;

              let transform = 'translateX(120%) rotateY(-20deg)';
              let opacity = 0;

              if (isActive) {
                transform = 'translateX(0) rotateY(0)';
                opacity = 1;
              } else if (isPast) {
                transform = 'translateX(-120%) rotateY(20deg) scale(0.9)';
                opacity = 0;
              }

              return (
                <div
                  key={item.name}
                  className="absolute inset-0 bg-[#0a1628]/80 backdrop-blur-xl border border-white/10 rounded-xl p-8 flex flex-col justify-between shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                  style={{ transform, opacity, visibility: opacity > 0 ? 'visible' : 'hidden' }}
                >
                  <div>
                    <div className="inline-block px-3 py-1 bg-gear/10 border border-gear/30 text-gear rounded-full text-xs font-mono uppercase mb-4">
                      0{idx + 1} // {item.type}
                    </div>
                    <h3 className="font-anton uppercase text-3xl mb-4 text-powder">{item.name}</h3>
                    <p className="font-mono text-sm text-ice-200 leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                  <div className="pt-6 border-t border-white/10 mt-6 flex justify-between items-center">
                    <span className="font-mono text-xs uppercase text-signal">Metric</span>
                    <span className="font-mono text-sm font-medium text-powder">{item.stat}</span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>


      </div>
    </section>
  );
}

function TiltCard({ item }: { item: any }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Reduced rotation intensity for hexagons
    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;

    setRotation({ x: rotateX, y: rotateY });
  };

  const handleMouseEnter = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => { });
    }
  };

  const handleMouseLeave = () => {
    setRotation({ x: 0, y: 0 });
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative group overflow-hidden bg-[#030811] transition-transform duration-200 ease-out cursor-crosshair shadow-2xl w-full aspect-[0.866] hover:z-50"
      style={{
        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale3d(1.02, 1.02, 1.02)`
      }}
    >
      <video
        ref={videoRef}
        src={item.video}
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-100"
      />
      {/* Lightened overlay to drastically increase visibility as requested */}
      <div className="absolute inset-0 bg-[#050c16]/20 group-hover:bg-transparent transition-colors duration-500 pointer-events-none" />

      {/* Centered content block */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 text-center">
        <h3 className="text-white text-xl md:text-2xl font-sans font-bold uppercase tracking-[0.1em] mb-4 md:mb-6 drop-shadow-lg">
          {item.title}
        </h3>
        <button className="border-2 border-white px-5 py-2 md:px-6 md:py-2 text-white text-[10px] md:text-xs font-sans font-bold uppercase tracking-widest pointer-events-auto hover:bg-white hover:text-[#050c16] transition-colors shadow-lg">
          Learn More
        </button>
      </div>
    </div>
  );
}

const LOOKBOOK_ITEMS = [
  {
    video: '/assets/animation/visual.mp4',
    eyebrow: 'AI Parser',
    title: 'Feature Analysis',
    copy: 'A deep learning model identifying critical geometric features across varying blueprint standards.',
  },
  {
    video: '/assets/animation/visual2.mp4',
    eyebrow: 'Data Tables',
    title: 'BOM Extraction',
    copy: 'Extracting clean, hierarchical Bill of Materials data directly from complex PDF assemblies.',
  },
  {
    video: '/assets/animation/visual3.mp4',
    eyebrow: 'Routing',
    title: 'Automated Costing',
    copy: 'Generating immediate, accurate cost estimates based on machine run-time and material volume.',
  },
];

function LookbookSection() {
  const containerRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useLayoutEffect(() => {
    let ctx = gsap.context(() => {
      // Initialize cards at scale 0
      gsap.set(cardsRef.current, { scale: 0, opacity: 0 });

      // Create scroll-triggered animation timeline
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "center center",
          end: "+=150%", // How much scroll distance the animation spans
          pin: true,     // Pin the section while animating
          scrub: 1,      // Smoothly tie animation to scroll
          onUpdate: (self) => {
            setScrollProgress(self.progress);
          }
        }
      });

      tl.to(cardsRef.current, {
        scale: 1,
        opacity: 1,
        stagger: 0.3, // Animate one by one
        duration: 1,
        ease: "power2.out",
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  let activeIndex = 0;
  if (scrollProgress < 0.33) activeIndex = 0;
  else if (scrollProgress < 0.66) activeIndex = 1;
  else activeIndex = 2;

  const displayIndex = hoverIndex !== null ? hoverIndex : activeIndex;

  const lines = [
    "System lookbook",
    "Processing logic,",
    "visualized"
  ];

  return (
    <section ref={containerRef} className="py-24 md:py-32 relative min-h-screen flex items-center overflow-hidden" id="lookbook">
      {/* Texture applied via global CSS, this section is transparent so it shows through */}
      <div className="w-full max-w-[min(1380px,100%)] mx-auto px-[clamp(1rem,3vw,2.25rem)]">

        <h2 className="font-anton uppercase text-[clamp(2.2rem,6vw,4.8rem)] leading-[1.06] max-w-[22ch] mb-16 flex flex-col">
          {lines.map((line, idx) => (
            <span
              key={idx}
              onMouseEnter={() => setHoverIndex(idx)}
              onMouseLeave={() => setHoverIndex(null)}
              className={`transition-all duration-500 cursor-default ${displayIndex === idx ? 'text-powder opacity-100' : 'text-ice-200/30 opacity-50'
                }`}
            >
              {line}
            </span>
          ))}
        </h2>

        <div className="flex flex-col md:flex-row justify-center items-center pb-20 md:pb-40 gap-4 md:gap-4">
          {LOOKBOOK_ITEMS.map((item, idx) => {
            return (
              <div
                key={idx}
                ref={(el) => { cardsRef.current[idx] = el; }}
                className="w-[90%] sm:w-[70%] md:w-[32%] relative z-10"
              >
                <TiltCard item={item} />
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}

function CTASection() {
  const cards = [
    { src: '/assets/animation/visual.mp4', top: '10%', left: '5%', width: 'w-48', delay: '0s' },
    { src: '/assets/animation/visual2.mp4', top: '55%', left: '12%', width: 'w-64', delay: '2s' },
    { src: '/assets/animation/visual3.mp4', top: '15%', left: '75%', width: 'w-56', delay: '1s' },
    { src: '/assets/animation/visual.mp4', top: '65%', left: '82%', width: 'w-40', delay: '3s' },
    { src: '/assets/animation/visual2.mp4', top: '-5%', left: '40%', width: 'w-52', delay: '1.5s' },
    { src: '/assets/animation/visual3.mp4', top: '80%', left: '45%', width: 'w-48', delay: '0.5s' },
  ];

  return (
    <section className="relative py-32 md:py-48 overflow-hidden border-t border-white/5 bg-[#030811]">
      <style>{`
        @keyframes float-slow {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(2deg); }
          100% { transform: translateY(0px) rotate(-1deg); }
        }
      `}</style>

      {/* Floating Cards Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {cards.map((card, idx) => (
          <div
            key={idx}
            className={`absolute ${card.width} aspect-[4/3] rounded-xl overflow-hidden border border-white/10 opacity-40 blur-[3px]`}
            style={{
              top: card.top,
              left: card.left,
              animation: `float-slow 8s ease-in-out infinite alternate ${card.delay}`
            }}
          >
            <video src={card.src} autoPlay muted loop playsInline className="w-full h-full object-cover" />
          </div>
        ))}
        {/* Radial gradient overlay to fade edges and center text area */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#030811_80%)]" />
      </div>

      <div className="relative z-10 w-full max-w-[min(1000px,100%)] mx-auto px-[clamp(1rem,3vw,2.25rem)] text-center flex flex-col items-center">
        <h2 className="font-anton uppercase text-[clamp(2rem,4.5vw,4rem)] leading-[1.1] text-powder drop-shadow-2xl">
          Transform Your Engineering Data <br />
          Into Instant Quotes With <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gear to-signal inline-block mt-4 border border-white/10 px-8 py-2 rounded-2xl bg-[#0a1628]/60 backdrop-blur-md shadow-2xl">
            Treeline Supply
          </span>
        </h2>

        <button className="mt-10 flex items-center justify-center gap-3 bg-gear text-ice-950 font-mono font-bold uppercase text-sm tracking-wider px-10 py-4 rounded-full hover:bg-white transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_-10px_rgba(152,245,255,0.5)]">
          <span>Explore API Specs</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}

function ComparisonSection() {
  const amanziFeatures = [
    "Fast, Automated Feature Extraction",
    "Instant, Accurate Quoting Engine",
    "Native BOM & Dimension Parsing",
    "Integrates Directly with ERP",
    "99.8% Accuracy on Complex Drawings"
  ];

  const otherFeatures = [
    "Slow, Manual Review Process",
    "Guesswork and Margin Leakage",
    "Tedious Manual Data Entry",
    "Disconnected Spreadsheet Silos",
    "High Risk of Human Error"
  ];

  return (
    <section className="py-24 md:py-32 relative bg-[#030811] overflow-hidden" id="comparison">
      <div className="w-full max-w-[min(1100px,100%)] mx-auto px-[clamp(1rem,3vw,2.25rem)] relative z-10 flex flex-col items-center">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-block border border-[#ef4444]/30 px-3 py-1 rounded text-[10px] font-mono uppercase tracking-widest text-[#ef4444] mb-6 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            Comparison
          </div>
          <h2 className="font-sans font-medium text-[clamp(2rem,3.5vw,3rem)] leading-tight text-powder">
            What Sets Amanzi Apart From <br /> Other Solutions
          </h2>
        </div>

        {/* Comparison Card */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 rounded-2xl border border-white/5 bg-[#0a1628]/40 backdrop-blur-xl overflow-hidden shadow-2xl relative">

          {/* Amanzi Side (Highlighted) */}
          <div className="p-8 md:p-12 relative border-b md:border-b-0 md:border-r border-white/5">
            {/* Inner Glow / Border effect for highlight */}
            <div className="absolute inset-0 border-[1.5px] border-[#10b981] rounded-2xl pointer-events-none" style={{ margin: '1px' }} />
            <div className="absolute inset-0 bg-[#10b981]/[0.03] rounded-2xl pointer-events-none" style={{ margin: '1px' }} />

            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-10">
                <Cpu className="w-8 h-8 text-powder" />
                <div className="flex flex-col">
                  <h3 className="font-sans font-medium text-2xl text-powder leading-none">Amanzi</h3>
                  <span className="font-mono text-xs text-ice-200 mt-1 uppercase tracking-wider">AI System</span>
                </div>
              </div>

              <ul className="flex flex-col gap-6">
                {amanziFeatures.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-4">
                    <CheckCircle2 className="w-6 h-6 text-[#10b981] flex-shrink-0 mt-0.5" />
                    <span className="font-sans text-[17px] text-powder/90 font-medium">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Others Side */}
          <div className="p-8 md:p-12 relative">
            <div className="flex items-center gap-4 mb-10">
              <Layers className="w-8 h-8 text-white/60" />
              <h3 className="font-sans font-medium text-2xl text-white/60 leading-none">Others</h3>
            </div>

            <ul className="flex flex-col gap-6">
              {otherFeatures.map((feat, idx) => (
                <li key={idx} className="flex items-start gap-4">
                  <XCircle className="w-6 h-6 text-[#ef4444] flex-shrink-0 mt-0.5" />
                  <span className="font-sans text-[17px] text-white/60 font-medium">{feat}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </section>
  );
}

function App() {
  return (
    <div className="bg-ice-950 min-h-screen relative selection:bg-signal selection:text-ice-950">
      <Header />
      <main>
        <HeroSection />
        <LookbookSection />
        <FeatureJumpSection />
        <ComparisonSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}

export default App;
