/**
 * Stand-in for `sonner` in the web build (aliased in vite.config.ts).
 *
 * The app deliberately mounts no <Toaster /> (see App.tsx), so every
 * `toast.success(...)` / `toast.error(...)` call already draws nothing. This
 * keeps those calls working while leaving sonner's ~19 KB out of the bundle.
 * To bring pop-ups back, mount a Toaster and remove the alias.
 */
type ToastFn = ((message?: unknown, data?: unknown) => string | number) & {
  success: ToastFn;
  error: ToastFn;
  info: ToastFn;
  warning: ToastFn;
  message: ToastFn;
  loading: ToastFn;
  dismiss: (id?: string | number) => void;
  promise: <T>(p: Promise<T> | (() => Promise<T>), data?: unknown) => unknown;
  custom: ToastFn;
};

const noop = () => 0;

export const toast = Object.assign(noop, {
  success: noop,
  error: noop,
  info: noop,
  warning: noop,
  message: noop,
  loading: noop,
  custom: noop,
  dismiss: () => {},
  promise: (p: unknown) => p,
}) as unknown as ToastFn;

export const Toaster = () => null;
