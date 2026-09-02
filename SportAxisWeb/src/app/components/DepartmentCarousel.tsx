import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Slide {
  name: string;
  image: string;
  abbreviation: string;
}

const defaultSlides: Slide[] = [
  {
    name: 'College of Informatics and Computing Sciences',
    abbreviation: 'CICS',
    image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1400&h=600&fit=crop&auto=format',
  },
  {
    name: 'College of Engineering',
    abbreviation: 'CET',
    image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1400&h=600&fit=crop&auto=format',
  },
  {
    name: 'College of Business Administration',
    abbreviation: 'CBA',
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1400&h=600&fit=crop&auto=format',
  },
  {
    name: 'College of Medicine',
    abbreviation: 'COM',
    image: 'https://images.unsplash.com/photo-1551601651-2a8555f1a136?w=1400&h=600&fit=crop&auto=format',
  },
  {
    name: 'College of Arts & Humanities',
    abbreviation: 'CAH',
    image: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1400&h=600&fit=crop&auto=format',
  },
];

const INTERVAL = 5000;

export default function DepartmentCarousel() {
  const [slides, setSlides] = useState<Slide[]>(defaultSlides);
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const [textVisible, setTextVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('carouselSlides');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) setSlides(parsed);
      } catch {}
    }
    const handler = () => {
      const s = localStorage.getItem('carouselSlides');
      if (s) try { const p = JSON.parse(s); if (p.length > 0) setSlides(p); } catch {}
    };
    window.addEventListener('carouselSlidesUpdated', handler);
    return () => window.removeEventListener('carouselSlidesUpdated', handler);
  }, []);

  const goTo = useCallback((idx: number, dir: 'next' | 'prev' = 'next') => {
    setTextVisible(false);
    setTimeout(() => {
      setPrev(current);
      setCurrent(idx);
      setDirection(dir);
      setProgressKey(k => k + 1);
      setTextVisible(true);
    }, 80);
  }, [current]);

  const next = useCallback(() => goTo((current + 1) % slides.length, 'next'), [current, slides.length, goTo]);
  const back = useCallback(() => goTo((current - 1 + slides.length) % slides.length, 'prev'), [current, slides.length, goTo]);

  useEffect(() => {
    if (paused) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(next, INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, next]);

  const n = slides.length;

  return (
    <>
      {/* Inject keyframe animations */}
      <style>{`
        @keyframes kb-zoom {
          0%   { transform: scale(1.0) translate(0%, 0%); }
          100% { transform: scale(1.08) translate(-1.5%, -1%); }
        }
        @keyframes kb-zoom-alt {
          0%   { transform: scale(1.0) translate(0%, 0%); }
          100% { transform: scale(1.08) translate(1.5%, -0.5%); }
        }
        @keyframes progress-fill {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes badge-pop {
          0%   { opacity: 0; transform: scale(0.85) translateY(6px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .carousel-text-enter { animation: slide-up 0.45s cubic-bezier(.22,.68,0,1.2) both; }
        .carousel-badge-enter { animation: badge-pop 0.4s cubic-bezier(.22,.68,0,1.2) 0.1s both; }
        .kb-even { animation: kb-zoom ${INTERVAL}ms linear forwards; }
        .kb-odd  { animation: kb-zoom-alt ${INTERVAL}ms linear forwards; }
        .progress-bar {
          transform-origin: left;
          animation: progress-fill ${INTERVAL}ms linear forwards;
        }
        .thumb-img { transition: transform 0.5s cubic-bezier(.22,.68,0,1.2); }
        .thumb-img:hover { transform: scale(1.07); }
      `}</style>

      <div
        className="relative w-full rounded-2xl overflow-hidden select-none"
        style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.28)' }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* ── MAIN STAGE ─────────────────────────────────────────── */}
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: '21/8', minHeight: 260 }}>

          {/* Slides */}
          {slides.map((slide, i) => {
            const isActive = i === current;
            const isPrev = i === prev;
            return (
              <div
                key={`${slide.name}-${i}`}
                className="absolute inset-0"
                style={{
                  zIndex: isActive ? 2 : isPrev ? 1 : 0,
                  opacity: isActive ? 1 : 0,
                  transition: isActive
                    ? 'opacity 0.7s cubic-bezier(.4,0,.2,1)'
                    : isPrev
                    ? 'opacity 0.7s cubic-bezier(.4,0,.2,1)'
                    : 'none',
                }}
              >
                {/* Ken Burns image */}
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    key={isActive ? `active-${progressKey}` : `idle-${i}`}
                    src={slide.image}
                    alt={slide.name}
                    className={`w-full h-full object-cover ${isActive ? (i % 2 === 0 ? 'kb-even' : 'kb-odd') : ''}`}
                    draggable={false}
                  />
                </div>

                {/* Gradient layers */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.28) 55%, rgba(0,0,0,0) 100%)',
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(0deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 45%, rgba(0,0,0,0) 100%)',
                  }}
                />
                {/* Top vignette */}
                <div
                  className="absolute inset-x-0 top-0 h-20"
                  style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 100%)' }}
                />
              </div>
            );
          })}

          {/* ── TOP BAR ─────────────────────────────────────────── */}
          <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-5 pt-4">
            {/* Live badge */}
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-xs font-bold tracking-widest uppercase">Live</span>
            </div>

            {/* Counter + arrows */}
            <div className="flex items-center gap-2">
              <span className="text-white/70 text-xs font-mono tabular-nums">
                {String(current + 1).padStart(2, '0')}&thinsp;/&thinsp;{String(n).padStart(2, '0')}
              </span>
              <button
                onClick={back}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-all duration-200 hover:scale-110 active:scale-95"
                aria-label="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={next}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-all duration-200 hover:scale-110 active:scale-95"
                aria-label="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── TEXT CONTENT ────────────────────────────────────── */}
          <div className="absolute bottom-0 left-0 z-10 pb-6 pl-6 pr-12 sm:pb-8 sm:pl-8 max-w-[70%]">
            {textVisible && (
              <>
                <div className="carousel-badge-enter inline-flex items-center gap-2 mb-3">
                  <span
                    className="text-xs font-black tracking-widest uppercase px-3 py-1 rounded-full"
                    style={{ background: 'var(--primary, #dc2626)', color: '#fff' }}
                  >
                    {slides[current].abbreviation}
                  </span>
                  <span className="text-white/60 text-xs font-medium uppercase tracking-wider">College</span>
                </div>
                <h2
                  className="carousel-text-enter text-white font-black leading-tight"
                  style={{
                    fontSize: 'clamp(1.25rem, 3vw, 2rem)',
                    textShadow: '0 2px 20px rgba(0,0,0,0.4)',
                    letterSpacing: '-0.02em',
                    animationDelay: '0.05s',
                  }}
                >
                  {slides[current].name}
                </h2>
              </>
            )}
          </div>

          {/* ── LARGE SIDE ARROWS (desktop) ─────────────────────── */}
          <button
            onClick={back}
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full items-center justify-center text-white transition-all duration-200 opacity-0 hover:opacity-100 group-hover:opacity-100"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full items-center justify-center text-white transition-all duration-200 opacity-0 hover:opacity-100"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* ── PROGRESS BARS ───────────────────────────────────────── */}
        <div className="absolute bottom-[88px] sm:bottom-[100px] inset-x-0 z-10 flex gap-1 px-5 sm:px-8">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i, i > current ? 'next' : 'prev')}
              className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/25"
              aria-label={`Go to slide ${i + 1}`}
            >
              <div
                key={i === current ? `prog-${progressKey}` : `idle-${i}`}
                className={`h-full rounded-full ${i === current && !paused ? 'progress-bar' : ''}`}
                style={{
                  background: i < current ? 'rgba(255,255,255,0.9)' : i === current ? 'white' : 'transparent',
                  transform: i === current ? (paused ? 'scaleX(0.01)' : undefined) : i < current ? 'scaleX(1)' : 'scaleX(0)',
                  transformOrigin: 'left',
                }}
              />
            </button>
          ))}
        </div>

        {/* ── THUMBNAIL STRIP ─────────────────────────────────────── */}
        <div className="flex bg-gray-950">
          {slides.map((slide, i) => {
            const isActive = i === current;
            return (
              <button
                key={`thumb-${i}`}
                onClick={() => goTo(i, i > current ? 'next' : 'prev')}
                className="relative flex-1 overflow-hidden focus:outline-none group"
                style={{ height: 72 }}
                aria-label={`View ${slide.name}`}
              >
                <img
                  src={slide.image}
                  alt={slide.name}
                  className="thumb-img absolute inset-0 w-full h-full object-cover"
                  style={{ filter: isActive ? 'none' : 'brightness(0.45) saturate(0.7)' }}
                />
                {/* Active indicator top bar */}
                <div
                  className="absolute top-0 inset-x-0 h-0.5 transition-all duration-300"
                  style={{ background: isActive ? 'var(--primary, #dc2626)' : 'transparent' }}
                />
                {/* Gradient + label */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-2 left-0 right-0 px-2 text-center">
                  <span
                    className="text-xs font-black tracking-wider uppercase truncate block"
                    style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: '0.6rem' }}
                  >
                    {slide.abbreviation}
                  </span>
                </div>
                {/* Hover overlay */}
                <div
                  className="absolute inset-0 transition-opacity duration-200 opacity-0 group-hover:opacity-100"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
