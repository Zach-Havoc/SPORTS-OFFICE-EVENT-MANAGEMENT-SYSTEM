import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Download, Check, Mail } from 'lucide-react';
import { sendEventQr } from '../services/api';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';


interface QRCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  qrToken: string;
}

export function QRCodeModal({ open, onOpenChange, eventId, eventName, qrToken }: QRCodeModalProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // A different event (or reopening) starts back at "Email to committee".
  useEffect(() => { if (open) setSent(false); }, [open, eventId]);

  const emailCommittee = async () => {
    try {
      setSending(true);
      const result = await sendEventQr(eventId);
      if (result.sent.length > 0) setSent(true);
      if (result.failed.length > 0) {
        toast.error(`Could not email ${result.failed.map(f => f.email).join(', ')}. Try again.`);
      } else if (result.sent.length === 0) {
        toast.error('The committee member has no email address; they got the in-app notification only.');
      }
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

  return (
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

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button onClick={handleDownloadQR}>
              <Download className="h-4 w-4 mr-2" />
              Download PNG
            </Button>
            <Button variant="secondary" onClick={emailCommittee} disabled={sending || sent}>
              {sent ? <Check className="h-4 w-4 mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              {sending ? 'Sending…' : sent ? 'Sent' : 'Email to committee'}
            </Button>
          </div>
          <p className="-mt-2 text-center text-xs text-gray-500">
            The committee member gets this QR code by email when assigned. Use this if they need it again.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
