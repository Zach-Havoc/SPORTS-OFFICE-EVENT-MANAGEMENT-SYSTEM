import * as React from "react";

import { cn } from "./utils";

/**
 * A card is for content that genuinely needs to be lifted off the page. Most
 * grouping in this product does not: use `.section-divide`, a heading and
 * space, or `variant="flat"` instead of boxing everything.
 *
 * Elevation comes from surface contrast first. The page is paper, the card is
 * white; a shadow is only spent when the card is interactive or floating.
 */
function Card({
  className,
  variant = "outlined",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "outlined" | "flat" | "raised";
}) {
  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(
        "flex flex-col rounded-lg text-text",
        variant === "outlined" && "border border-border bg-surface",
        variant === "flat" && "bg-surface-sunken",
        variant === "raised" && "border border-border bg-surface shadow-sm",
        "transition-[box-shadow,border-color,transform] duration-200",
        "data-[interactive]:cursor-pointer data-[interactive]:hover:border-border-strong data-[interactive]:hover:shadow-sm",
        "data-[interactive]:active:translate-y-px motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1 px-5 pt-5",
        "has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-5",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <h3 data-slot="card-title" className={cn("t-section", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("t-supporting", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-5 pt-4 [&:first-child]:pt-5 [&:last-child]:pb-5", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-5 pb-5 pt-4 [.border-t]:pt-5", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
