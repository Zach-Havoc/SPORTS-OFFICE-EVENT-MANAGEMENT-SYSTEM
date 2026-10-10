/**
 * Why an action failed, shown inside the form or dialog it came from.
 *
 * The site shows no pop-up messages (sonner is a no-op in the build), so a
 * refused save has to explain itself on the page: render this next to the
 * form's buttons with the message from the server or the check that failed.
 * Renders nothing when there is no message.
 */
import { AlertTriangle } from 'lucide-react';
import { cn } from './utils';

export function FormError({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800',
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}

/** The message to show for a failed request, with a fallback. */
export function errorText(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}
