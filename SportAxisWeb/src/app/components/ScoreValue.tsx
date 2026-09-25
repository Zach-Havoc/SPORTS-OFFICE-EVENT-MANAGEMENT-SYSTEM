import { useEffect, useRef, useState } from "react";

import { cn } from "./ui/utils";

/**
 * A score that acknowledges its own change.
 *
 * Purpose: state indication. A live score that silently swaps 54 for 56 is a
 * change nobody sees, which is the one thing a live board exists to show.
 *
 * Deliberately not a count-up. Basketball moves in ones and threes; counting
 * 54 -> 55 -> 56 is decoration that delays the number the viewer wants. The
 * new value appears immediately and the surface behind it acknowledges it.
 *
 * Built as a transition rather than keyframes because scores change in bursts:
 * a transition retargets from wherever the current value is, a keyframe
 * restarts from zero and stutters on the second point of a free throw.
 */
export function ScoreValue({
  value,
  className,
  flashClassName,
}: {
  value: number;
  className?: string;
  /** Override the acknowledgement tint (a dark board wants a lighter one). */
  flashClassName?: string;
}) {
  const [lit, setLit] = useState(false);
  const previous = useRef(value);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setLit(true);
    // Paint the tint, then release it on the next frame so the transition
    // runs on the way *out*. Going in is instant, which is what makes the
    // change register.
    const raf = requestAnimationFrame(() => setLit(false));
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span
      data-lit={lit || undefined}
      className={cn(
        "relative inline-flex items-center justify-center rounded-md px-1.5",
        "transition-[background-color,color] duration-700 ease-[--ease-out-expo]",
        "data-[lit]:duration-0",
        flashClassName ?? "data-[lit]:bg-brand-subtle",
        "motion-reduce:transition-none",
        className,
      )}
    >
      {value}
    </span>
  );
}
