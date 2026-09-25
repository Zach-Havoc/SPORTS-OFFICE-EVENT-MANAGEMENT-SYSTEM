import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Download, Copy, Check } from 'lucide-react';
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
              Scan to open web scoring page <em>or</em> parse in the mobile app
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

          <Button onClick={handleDownloadQR} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download QR Code (PNG)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
