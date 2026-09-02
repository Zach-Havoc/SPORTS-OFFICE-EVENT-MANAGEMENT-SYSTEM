import { Loader2, AlertTriangle } from 'lucide-react';
import { cn } from './ui/utils';

/**
 * Small, non-blocking data-freshness indicator for page headers.
 *
 *  - While a background refetch is in flight (and data is already on screen):
 *    a quiet "Updating…" line — never a full-page spinner.
 *  - If a background refetch fails but we still have the last good data:
 *    a subtle amber chip with an optional Retry. The stale data stays visible.
 *
 * Pass `fetching` = `isFetching && !isLoading`, and `error` = `isRefetchError`
 * (i.e. the query errored but still holds previously-fetched data).
 */
export function RefreshStatus({
  fetching,
  error,
  onRetry,
  className,
}: {
  fetching?: boolean;
  error?: boolean;
  onRetry?: () => void;
  className?: string;
}) {
  if (error) {
    return (
      <span
        role="status"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700',
          className,
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Couldn&rsquo;t refresh
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="underline underline-offset-2 hover:no-underline"
          >
            Retry
          </button>
        )}
      </span>
    );
  }

  if (fetching) {
    return (
      <span
        role="status"
        className={cn('inline-flex items-center gap-1.5 text-xs text-gray-400', className)}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Updating&hellip;
      </span>
    );
  }

  return null;
}
