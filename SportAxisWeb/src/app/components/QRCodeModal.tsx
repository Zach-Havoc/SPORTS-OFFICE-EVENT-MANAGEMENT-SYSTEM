import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Download, Copy, Check, Mail } from 'lucide-react';
import { sendEventQr, type CommitteeEmailResult } from '../services/api';
import { CommitteeEmailDialog } from './CommitteeEmailDialog';
import { useState } from 'react';
import { toast } from 'sonner';


interface QRCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  qrToken: string;
}

export function QRCodeModal({ open, onOpenChange, eventId, eventName, qrToken }: QRCodeModalProps) {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailResult, setEmailResult] = useState<CommitteeEmailResult | null>(null);

  const emailCommittee = async () => {
    try {
      setSending(true);
      setEmailResult(await sendEventQr(eventId));
    } catch (e: any) {
      toast.error(e?.message || 'Could not email the QR code');
    } finally {
      setSending(false);
    }
  };

  // Web URL — used by browsers to open the web scoring page
  // The mobile app reads its API base URL from its own env config (EXPO_PUBLIC_API_URL)
  const webUrl = `${window.location.origin}/judge-qr/${eventId}/${qrToken}`;
  const qrUrl = webUrl;

  const handleDownloadQR = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${eventName.replace(/\s+/g, '-')}-QR-Code.png`;
      a.click();
      toast.success('QR Code downloaded');
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(new XMLSerializer().serializeToString(svg));
  };

  const copy = async (text: string, label = 'Copied!') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(label);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <>
    <CommitteeEmailDialog result={emailResult} eventName={eventName} onClose={() => setEmailResult(null)} />
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Committee QR Code
          </DialogTitle>
          <DialogDescription>
            Scoring access for <strong>{eventName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {/* QR Code */}
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white p-4 rounded-xl shadow-sm border-2 border-gray-100">
              <QRCodeSVG
                id="qr-code-svg"
                value={qrUrl}
                size={220}
                level="H"
                includeMargin
              />
            </div>
            <p className="text-xs text-gray-500 text-center">
              Scan with the SportsAxis app, or open it in a browser to score on the web
            </p>
          </div>

          {/* Web link */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Web Scoring Link</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={webUrl}
                className="flex-1 px-3 py-2 text-xs border rounded-md bg-gray-50 truncate"
              />
              <Button size="sm" variant="secondary" onClick={() => copy(webUrl, 'Link copied!')}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button onClick={handleDownloadQR}>
              <Download className="h-4 w-4 mr-2" />
              Download PNG
            </Button>
            <Button variant="secondary" onClick={emailCommittee} disabled={sending}>
              <Mail className="h-4 w-4 mr-2" />
              {sending ? 'Sending…' : 'Email to committee'}
            </Button>
          </div>
          <p className="-mt-2 text-center text-xs text-gray-500">
            Committee members get this QR code by email when they're assigned. Use this to send it again.
          </p>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
