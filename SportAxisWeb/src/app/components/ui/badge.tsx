import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

/**
 * Status badges share the button's role vocabulary so the same word means the
 * same thing wherever it appears. Every filled variant is a subtle tint with
 * a matching border and a darker text, never a saturated block: a row of ten
 * of these sits beside body copy and must not shout over it.
 */
const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap",
    "rounded-sm border px-1.5 py-0.5 text-xs font-medium",
    "[&>svg]:pointer-events-none [&>svg]:size-3",
    "transition-colors duration-[140ms]",
    "overflow-hidden",
  ].join(" "),
  {
    variants: {
      variant: {
        neutral: "border-border bg-surface-sunken text-text-secondary",
        brand: "border-brand-border bg-brand-subtle text-brand-text",
        outline: "border-border bg-transparent text-text-secondary",
        success: "border-success-border bg-success-subtle text-success-foreground",
        warning: "border-warning-border bg-warning-subtle text-warning-foreground",
        danger: "border-danger-border bg-danger-subtle text-danger-text",
        info: "border-info-border bg-info-subtle text-info-foreground",
        /** Solid ink. For the rare badge that must read as a count, not a status. */
        solid: "border-transparent bg-action text-action-on",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
