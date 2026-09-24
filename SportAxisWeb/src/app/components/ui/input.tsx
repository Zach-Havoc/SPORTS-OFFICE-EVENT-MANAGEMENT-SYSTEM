import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border border-border bg-input-background px-3 py-1 text-base md:text-sm",
        "text-foreground placeholder:text-muted-foreground/80 file:text-foreground",
        "selection:bg-primary selection:text-primary-foreground",
        // The field brightens to the card surface as it takes focus, so the
        // active row is obvious without a heavy ring doing all the work.
        "transition-[background-color,border-color,box-shadow] duration-150",
        "hover:border-border/100 hover:bg-card/60",
        "focus-visible:bg-card focus-visible:border-ring focus-visible:ring-ring/35 focus-visible:ring-[3px]",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/25",
        "dark:bg-input/40 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
