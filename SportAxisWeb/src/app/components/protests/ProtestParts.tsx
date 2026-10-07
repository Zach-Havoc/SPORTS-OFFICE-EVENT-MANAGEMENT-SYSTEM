/**
 * Pieces the coach and office Appeals pages share: status labels, the
 * 12-hour window countdown, a link to a submitted form, and a PDF picker.
 */
import { useRef } from 'react';
import { FileText, Paperclip, X } from 'lucide-react';
import type { Protest } from '../../services/api';

export const STATUS_LABEL: Record<Protest['status'], string> = {
  open: 'Under review',
  awaiting_counter: 'Waiting for counter',
  upheld: 'Upheld',
  dismissed: 'Dismissed',
};

export const STATUS_STYLE: Record<Protest['status'], string> = {
  open: 'bg-amber-100 text-amber-800',
  awaiting_counter: 'bg-sky-100 text-sky-800',
  upheld: 'bg-emerald-100 text-emerald-700',
  dismissed: 'bg-slate-100 text-slate-600',
};

export function fmtWhen(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** "3h 20m left" / "closed", for a deadline. */
export function timeLeft(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return '';
  const mins = Math.round((new Date(iso).getTime() - now) / 60000);
  if (mins <= 0) return 'closed';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h ? `${h}h ` : ''}${m}m left`;
}

/** Opens a submitted form (PDF) in a new tab. */
export function FormLink({ url, label }: { url: string | null | undefined; label: string }) {
  if (!url) return <span className="text-xs text-gray-400">No form attached</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-800 transition-colors hover:border-gray-400"
    >
      <FileText className="h-3.5 w-3.5 text-red-600" />
      {label}
    </a>
  );
}

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Picks the formal form: a PDF of at most 10 MB. Anything else is refused
 * here, before upload, with the reason passed to onError.
 */
export function PdfPicker({
  file,
  onChange,
  onError,
  label = 'Attach the formal form (PDF)',
}: {
  file: File | null;
  onChange: (f: File | null) => void;
  onError: (message: string) => void;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = '';
          if (!f) return;
          if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) return onError('The form has to be a PDF.');
          if (f.size > MAX_BYTES) return onError('The PDF is larger than 10 MB.');
          onChange(f);
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-500"
      >
        <Paperclip className="h-4 w-4" />
        {file ? 'Replace PDF' : label}
      </button>
      {file && (
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700">
          <FileText className="h-3.5 w-3.5 shrink-0 text-red-600" />
          <span className="max-w-[16rem] truncate">{file.name}</span>
          <button type="button" onClick={() => onChange(null)} aria-label="Remove the PDF" className="text-gray-400 hover:text-gray-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      )}
    </div>
  );
}
