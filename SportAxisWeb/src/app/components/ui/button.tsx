import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 select-none",
    "rounded-md text-sm font-medium",
    // Tactile press: the surface takes the weight of the click and settles
    // back on an exponential curve. No bounce, no overshoot.
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.25,1,0.5,1)]",
    "active:translate-y-px active:duration-75",
    "motion-reduce:transition-none motion-reduce:active:translate-y-0",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
    "outline-none focus-visible:ring-ring/45 focus-visible:ring-[3px] focus-visible:ring-offset-1 focus-visible:ring-offset-background",
    "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/92 hover:shadow-sm active:bg-primary active:shadow-none",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/92 hover:shadow-sm active:shadow-none focus-visible:ring-destructive/40",
        outline:
          "border border-border bg-card text-foreground hover:bg-muted hover:border-border active:bg-secondary dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/75 active:bg-secondary",
        ghost:
          "text-foreground hover:bg-muted active:bg-secondary dark:hover:bg-accent/40",
        link: "text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary active:translate-y-0",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-sm gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-11 rounded-lg px-6 has-[>svg]:px-5",
        icon: "size-9 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
