import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSiteSlides } from '../../hooks/api';

/**
 * The public photo slideshow shown on the Live Events page.
 *
 * Slides are 100% admin-controlled (Admin › Site Content › Live Events
 * Slideshow). If the admin hasn't added any, this renders nothing so the
 * page just starts at the schedule.
 */

interface Slide {
  id: string;
  title?: string | null;
  caption?: string | null;
  imageUrl: string;
  linkUrl?: string | null;
}

const INTERVAL = 6000;

export default function PhotoSlideshow() {
  const { data } = useSiteSlides('carousel');
  const slides = (data ?? []) as Slide[];

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // If slides shrink (admin deletes one), keep the index in range.
  useEffect(() => {
    if (current > slides.length - 1) setCurrent(0);
  }, [slides.length, current]);

  const goTo = useCallback((idx: number) => {
    setCurrent(idx);
    setProgressKey((k) => k + 1);
  }, []);

  const next = useCallback(
    () => goTo(slides.length ? (current + 1) % slides.length : 0),
    [current, slides.length, goTo],
  );
  const prev = useCallback(
    () => goTo(slides.length ? (current - 1 + slides.length) % slides.length : 0),
    [current, slides.length, goTo],
  );

  useEffect(() => {
    if (paused || slides.length < 2) return;
    timer.current = setInterval(next, INTERVAL);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, next, slides.length]);

  if (slides.length === 0) return null;

  const active = slides[current];

  const Frame = active.linkUrl ? 'a' : 'div';
  const frameProps = active.linkUrl
    ? { href: active.linkUrl, target: '_blank', rel: 'noopener noreferrer' }
    : {};

  return (
    <div
      className="group relative mb-8 w-full select-none overflow-hidden rounded-2xl border border-gray-200 bg-gray-900 shadow-lg"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style>{`
        @keyframes ps-kenburns { from { transform: scale(1); } to { transform: scale(1.08); } }
        @keyframes ps-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes ps-fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Stage */}
      <Frame
        {...(frameProps as any)}
        className="relative block w-full overflow-hidden"
        style={{ aspectRatio: '21 / 8', minHeight: 220 }}
      >
        {slides.map((s, i) => (
          <div
            key={s.id}
            className="absolute inset-0 transition-opacity duration-700 ease-out"
            style={{ opacity: i === current ? 1 : 0, zIndex: i === current ? 2 : 1 }}
          >
            <img
              key={i === current ? `on-${progressKey}` : `off-${s.id}`}
              src={s.imageUrl}
              alt={s.title ?? 'Slide'}
              draggable={false}
              className="h-full w-full object-cover"
              style={i === current ? { animation: `ps-kenburns ${INTERVAL}ms linear forwards` } : undefined}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(90deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0) 100%), linear-gradient(0deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 45%)',
              }}
            />
          </div>
        ))}

        {/* Caption */}
        {(active.title || active.caption) && (
          <div
            key={`cap-${progressKey}`}
            className="absolute bottom-0 left-0 z-10 max-w-[75%] p-5 sm:p-7"
            style={{ animation: 'ps-fade-up 0.5s ease-out both' }}
          >
            {active.title && (
              <h3
                className="font-bold leading-tight text-white"
                style={{ fontSize: 'clamp(1.1rem, 2.6vw, 1.9rem)', textShadow: '0 2px 16px rgba(0,0,0,0.5)' }}
              >
                {active.title}
              </h3>
            )}
            {active.caption && (
              <p className="mt-1.5 text-sm text-white/85 sm:text-base" style={{ textShadow: '0 1px 10px rgba(0,0,0,0.5)' }}>
                {active.caption}
              </p>
            )}
          </div>
        )}
      </Frame>

      {/* Arrows (only when there's more than one slide) */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition hover:bg-black/60 group-hover:opacity-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur-sm transition hover:bg-black/60 group-hover:opacity-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Progress bars / dots */}
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                className="h-1 w-8 overflow-hidden rounded-full bg-white/30"
              >
                <span
                  key={i === current ? `p-${progressKey}` : `i-${s.id}`}
                  className="block h-full rounded-full bg-white"
                  style={{
                    transformOrigin: 'left',
                    transform: i < current ? 'scaleX(1)' : i === current ? undefined : 'scaleX(0)',
                    animation:
                      i === current && !paused && slides.length > 1
                        ? `ps-progress ${INTERVAL}ms linear forwards`
                        : undefined,
                  }}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
