interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

/**
 * Three bouncing dots were the old loader. Bounce easing reads as dated and
 * it says nothing about what the app is doing, so this is a single settling
 * mark on an exponential curve plus a determinate-looking track: weight
 * arriving, not a ball dropping.
 */
function Mark({ size }: { size: "lg" | "sm" }) {
  return (
    <div className={size === "lg" ? "relative mb-7" : "relative mb-5"}>
      <img
        src="/sportaxis-mark.png"
        alt=""
        aria-hidden="true"
        className={
          size === "lg"
            ? "h-24 w-24 object-contain animate-settle"
            : "h-14 w-14 object-contain animate-settle"
        }
      />
    </div>
  );
}

function Track({ wide }: { wide: boolean }) {
  return (
    <div
      className={
        (wide ? "w-44" : "w-32") +
        " relative mt-5 h-0.5 overflow-hidden rounded-full bg-border"
      }
    >
      <div className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary [animation:loading-bar_1.2s_cubic-bezier(0.25,1,0.5,1)_infinite] motion-reduce:animate-none motion-reduce:w-full" />
    </div>
  );
}

export default function Loading({ message = "Loading", fullScreen = true }: LoadingProps) {
  if (fullScreen) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-50 flex min-h-[100dvh] w-full items-center justify-center bg-background"
      >
        <div className="flex flex-col items-center px-4 py-12">
          <Mark size="lg" />
          <p className="text-base font-medium text-foreground">{message}</p>
          <Track wide />
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full flex-col items-center justify-center py-12"
    >
      <Mark size="sm" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      <Track wide={false} />
    </div>
  );
}
