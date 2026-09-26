import { CheckCircle2, MailWarning } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog';
import type { CommitteeEmailResult } from '../services/api';

interface Props {
  /** The result to show; null keeps the popup closed. */
  result: CommitteeEmailResult | null;
  eventName?: string;
  onClose: () => void;
}

/** Popup confirming who the committee QR code email reached (or didn't). */
export function CommitteeEmailDialog({ result, eventName, onClose }: Props) {
  const ok = !!result && result.failed.length === 0 && result.sent.length > 0;

  return (
    <AlertDialog open={!!result} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className={`mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full ${ok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {ok ? <CheckCircle2 className="h-6 w-6" /> : <MailWarning className="h-6 w-6" />}
          </div>
          <AlertDialogTitle className="text-center">
            {ok ? 'Email sent' : result?.sent.length ? 'Email partly sent' : 'Email not sent'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {eventName ? <>The QR code for <strong>{eventName}</strong></> : 'The QR code'}
            {ok ? ' was emailed to the committee member.' : ' could not reach everyone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {result && (
          <ul className="space-y-2 text-sm">
            {result.sent.map((r) => (
              <li key={`s-${r.email}`} className="flex items-start gap-2 rounded-md bg-green-50 px-3 py-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
                <span><span className="font-medium">{r.name}</span> <span className="text-gray-600">· {r.email}</span></span>
              </li>
            ))}
            {result.failed.map((r) => (
              <li key={`f-${r.email}`} className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2">
                <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                <span>
                  <span className="font-medium">{r.name}</span> <span className="text-gray-600">· {r.email}</span>
                  <span className="block text-xs text-red-700">Not delivered. Check the mail settings, then use “Email to committee” to try again.</span>
                </span>
              </li>
            ))}
            {result.noEmail.map((r) => (
              <li key={`n-${r.name}`} className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2">
                <MailWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <span>
                  <span className="font-medium">{r.name}</span>
                  <span className="block text-xs text-amber-800">This account has no email address, so they only got the in-app notification.</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
