import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm",
        "text-text placeholder:text-text-muted",
        "selection:bg-brand-subtle selection:text-brand-text",
        "transition-[background-color,border-color,box-shadow] duration-[140ms]",
        "hover:border-border-strong",
        // The field brightens and the border firms as it takes focus; the
        // outline comes from the one global focus treatment, not a per-field ring.
        "focus-visible:border-border-strong",
        "file:mr-3 file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text",
        "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled",
        "aria-invalid:border-danger aria-invalid:hover:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
