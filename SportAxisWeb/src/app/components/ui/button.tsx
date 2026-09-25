import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "./utils";

/**
 * The primary action is ink, not the brand red.
 *
 * This product's brand colour is red. When the primary button, the active
 * nav item and the delete button are all red, none of them means anything.
 * Ink carries "do the main thing", crimson carries identity and selection,
 * and a red button now unambiguously means destructive.
 */
const buttonVariants = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap shrink-0",
    "font-medium",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-[140ms] ease-[cubic-bezier(0.25,1,0.5,1)]",
    "active:translate-y-px active:duration-75",
    "motion-reduce:transition-none motion-reduce:active:translate-y-0",
    "disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--focus-ring]",
    "aria-invalid:outline-[--danger]",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-action text-action-on shadow-xs hover:bg-action-hover hover:shadow-sm active:shadow-none",
        brand:
          "bg-brand text-brand-on shadow-xs hover:bg-brand-hover hover:shadow-sm active:shadow-none",
        secondary:
          "border border-border bg-surface text-text shadow-xs hover:bg-surface-hover hover:border-border-strong active:bg-surface-active",
        ghost:
          "text-text-secondary hover:bg-surface-active hover:text-text active:bg-surface-active",
        destructive:
          "bg-danger text-white shadow-xs hover:brightness-[0.94] active:brightness-90",
        "destructive-subtle":
          "border border-danger-border bg-danger-subtle text-danger-text hover:bg-danger-subtle hover:border-danger",
        link: "h-auto p-0 text-brand-text underline decoration-[color-mix(in_oklch,var(--brand)_32%,transparent)] underline-offset-4 hover:decoration-[--brand] active:translate-y-0",
      },
      size: {
        sm: "h-8 rounded-sm px-2.5 text-[0.8125rem] has-[>svg]:px-2",
        default: "h-9 rounded-md px-3.5 text-sm has-[>svg]:px-3",
        lg: "h-11 rounded-md px-5 text-[0.9375rem] has-[>svg]:px-4",
        icon: "size-9 rounded-md",
        "icon-sm": "size-8 rounded-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Swaps the label for a spinner and blocks input, keeping the button's width. */
    loading?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  // asChild renders someone else's element; a spinner cannot be injected into
  // it without breaking Slot's single-child contract.
  if (asChild) {
    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  return (
    <button
      data-slot="button"
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {/* The label stays in flow but invisible, so the button does not resize
          when it starts loading and the layout around it never shifts. */}
      <span
        className={cn(
          "inline-flex items-center gap-2",
          loading && "invisible",
        )}
      >
        {children}
      </span>
      {loading ? (
        <Loader2
          aria-hidden="true"
          className="absolute size-4 animate-spin motion-reduce:animate-none"
        />
      ) : null}
    </button>
  );
}

export { Button, buttonVariants };
