import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Download, Copy, Check, Smartphone, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [showDocs, setShowDocs] = useState(false);

  // ─── QR Code URL ──────────────────────────────────────────────────────────
  // Format: /judge-qr/{eventId}/{qrToken}
  // Mobile app parses this URL to extract token and makes API calls to backend
  const qrUrl = `${window.location.origin}/judge-qr/${eventId}/${qrToken}`;

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
          <DialogTitle>Judge Scoring Access</DialogTitle>
          <DialogDescription>
            <strong>{eventName}</strong> — Scan with mobile app or access online
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {/* QR Code Display */}
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
            <p className="text-sm text-gray-600 text-center font-medium">
              Scan with mobile app or access online
            </p>
          </div>

          {/* Direct URL Link */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
              Scoring URL
            </label>
            <div className="flex gap-2">
              <input
                readOnly
                value={qrUrl}
                className="flex-1 px-3 py-2 text-xs border rounded-md bg-gray-50 font-mono"
              />
              <Button size="sm" variant="outline" onClick={() => copy(qrUrl, 'Link copied!')}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Download Button */}
          <Button onClick={handleDownloadQR} className="w-full bg-blue-600 hover:bg-blue-700">
            <Download className="h-4 w-4 mr-2" />
            Download QR Code (PNG)
          </Button>

          {/* Mobile App Info */}
          <div className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setShowDocs(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors text-sm font-semibold text-blue-900"
            >
              <span className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Mobile App Setup
              </span>
              {showDocs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showDocs && (
              <div className="p-4 space-y-4 text-sm">
                <div>
                  <p className="font-semibold text-gray-800 mb-3">How to use on mobile:</p>
                  <ol className="space-y-2 text-gray-700 list-decimal list-inside text-sm">
                    <li>Open the SportAxis Judge app</li>
                    <li>Tap the camera icon to scan QR code</li>
                    <li>Point at this QR code</li>
                    <li>App auto-loads event details (departments, criteria)</li>
                    <li>Select department and enter scores</li>
                    <li>Submit — scores sync to the dashboard</li>
                  </ol>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <p className="text-xs text-blue-800 font-medium">
                    ✓ QR token authenticates the session — no login required
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase">Token Values:</p>
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <span className="text-gray-600">Event ID:</span>
                      <span className="text-gray-800 break-all">{eventId}</span>
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <span className="text-gray-600">QR Token:</span>
                      <span className="text-gray-800 break-all">{qrToken}</span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-500 italic">
                  Works offline — scores submit when connection is available
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
