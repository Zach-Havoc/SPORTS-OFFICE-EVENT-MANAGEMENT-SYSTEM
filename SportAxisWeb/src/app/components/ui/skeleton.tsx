import { cn } from "./utils";

/**
 * A travelling highlight rather than a whole-block opacity pulse: the sheen
 * moves on `transform`, so it stays on the compositor, and the placeholder
 * keeps its shape instead of fading the layout in and out.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "after:absolute after:inset-0 after:-translate-x-full",
        "after:bg-gradient-to-r after:from-transparent after:via-card/70 after:to-transparent",
        "after:[animation:shimmer_1.6s_cubic-bezier(0.25,1,0.5,1)_infinite]",
        "motion-reduce:after:hidden",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
