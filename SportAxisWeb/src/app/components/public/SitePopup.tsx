import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useSiteSlides } from '../../hooks/api';

/**
 * The welcome image that pops up when a visitor opens the site.
 *
 * The admin sets it in Admin › Site Content › Welcome Popup. The first
 * active popup slide is shown once per browser session (dismissing it, or
 * navigating away, won't bring it back until a new session — or until the
 * admin swaps in a different image).
 */

interface PopupSlide {
  id: string;
  title?: string | null;
  caption?: string | null;
  imageUrl: string;
  linkUrl?: string | null;
}

const SEEN_KEY = 'sitePopupSeen';

function alreadySeen(id: string): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === id;
  } catch {
    return false;
  }
}
function markSeen(id: string) {
  try {
    sessionStorage.setItem(SEEN_KEY, id);
  } catch {
    /* private mode / storage disabled — just show it every time */
  }
}

export default function SitePopup() {
  const { data } = useSiteSlides('popup');
  const popup = ((data ?? [])[0] ?? null) as PopupSlide | null;

  const [open, setOpen] = useState(false);

  const close = () => {
    if (popup) markSeen(popup.id);
    setOpen(false);
  };

  useEffect(() => {
    if (popup && !alreadySeen(popup.id)) setOpen(true);
  }, [popup]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!popup || !open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={popup.title ?? 'Announcement'}
      onClick={close}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
        >
          <X className="h-4 w-4" />
        </button>

        <img src={popup.imageUrl} alt={popup.title ?? 'Announcement'} className="max-h-[65vh] w-full object-contain bg-gray-50" />

        {(popup.title || popup.caption || popup.linkUrl) && (
          <div className="p-5">
            {popup.title && <h3 className="text-lg font-bold text-gray-900">{popup.title}</h3>}
            {popup.caption && <p className="mt-1 text-sm text-gray-600">{popup.caption}</p>}
            {popup.linkUrl && (
              <a
                href={popup.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
                className="mt-3 inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Learn more
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
