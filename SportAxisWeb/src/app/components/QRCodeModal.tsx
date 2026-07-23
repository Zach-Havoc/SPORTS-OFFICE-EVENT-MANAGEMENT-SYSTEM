import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Download, Copy, Check, Smartphone, ChevronDown, ChevronUp, Code2 } from 'lucide-react';
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

  const scorePayloadExample = JSON.stringify({
    department: "Department Name",
    judgeName: "Judge Full Name",
    scores: { "Criterion 1": 85, "Criterion 2": 90 },
    totalScore: 87.5,
  }, null, 2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Judge QR Code
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
              <Button size="sm" variant="outline" onClick={() => copy(webUrl, 'Link copied!')}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Button onClick={handleDownloadQR} className="w-full">
            <Download className="h-4 w-4 mr-2" />
            Download QR Code (PNG)
          </Button>

          {/* ── Mobile App Integration Docs ── */}
          <div className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setShowDocs(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-700"
            >
              <span className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-blue-600" />
                Mobile App Integration
              </span>
              {showDocs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showDocs && (
              <div className="p-4 space-y-5 text-sm">

                {/* How it works */}
                <div>
                  <p className="font-semibold text-gray-800 mb-2">How it works</p>
                  <ol className="space-y-1 text-gray-600 list-decimal list-inside text-xs leading-relaxed">
                    <li>Mobile app scans the QR code</li>
                    <li>Parse <code className="bg-gray-100 px-1 rounded">eventId</code>, <code className="bg-gray-100 px-1 rounded">token</code>, <code className="bg-gray-100 px-1 rounded">apiBase</code>, and <code className="bg-gray-100 px-1 rounded">apiKey</code> from the URL</li>
                    <li>Call the <strong>Get Event</strong> endpoint to fetch event details (criteria, departments)</li>
                    <li>Judge selects a department, scores each criterion</li>
                    <li>Call the <strong>Submit Score</strong> endpoint — no login required</li>
                  </ol>
                </div>

                {/* Values from this QR */}
                <div>
                  <p className="font-semibold text-gray-800 mb-2 flex items-center gap-1">
                    <Code2 className="h-4 w-4" /> Values in this QR
                  </p>
                  <div className="space-y-2">
                    {[
                      { label: 'eventId', value: eventId },
                      { label: 'token', value: qrToken },
                      { label: 'apiBase', value: apiBase },
                      { label: 'apiKey', value: publicAnonKey },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-xs font-mono text-purple-700 w-16 shrink-0">{label}</span>
                        <code className="flex-1 text-xs bg-gray-100 px-2 py-1 rounded truncate font-mono">{value}</code>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => copy(value, `${label} copied`)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 1 – Get Event */}
                <div className="space-y-1">
                  <span className="inline-block text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    Step 1 — Get Event Details
                  </span>
                  <div className="bg-gray-900 rounded-lg p-3 text-xs font-mono text-green-400 leading-relaxed overflow-x-auto">
                    <span className="text-yellow-400">GET</span>{' '}
                    <span className="text-white break-all">
                      {apiBase}/judge/event/{eventId}/{qrToken}
                    </span>
                    <br /><br />
                    <span className="text-gray-400">// Headers</span><br />
                    <span className="text-blue-300">Authorization</span>:{' '}
                    <span className="text-orange-300">Bearer {'<apiKey>'}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Returns: <code className="bg-gray-100 px-1 rounded">{'{ event: { name, departments[], criteria[], status, ... } }'}</code>
                  </p>
                </div>

                {/* Step 2 – Submit Score */}
                <div className="space-y-1">
                  <span className="inline-block text-xs font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded">
                    Step 2 — Submit Score
                  </span>
                  <div className="bg-gray-900 rounded-lg p-3 text-xs font-mono text-green-400 leading-relaxed overflow-x-auto">
                    <span className="text-yellow-400">POST</span>{' '}
                    <span className="text-white break-all">
                      {apiBase}/judge/score/{eventId}/{qrToken}
                    </span>
                    <br /><br />
                    <span className="text-gray-400">// Headers</span><br />
                    <span className="text-blue-300">Authorization</span>:{' '}
                    <span className="text-orange-300">Bearer {'<apiKey>'}</span><br />
                    <span className="text-blue-300">Content-Type</span>:{' '}
                    <span className="text-orange-300">application/json</span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Request body:</p>
                    <pre className="bg-gray-900 text-green-400 text-xs font-mono rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre">
                      {scorePayloadExample}
                    </pre>
                  </div>
                  <p className="text-xs text-gray-500">
                    Returns: <code className="bg-gray-100 px-1 rounded">{'{ success: true, message: "Score submitted successfully" }'}</code>
                  </p>
                </div>

                {/* URL Parsing hint */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
                  <p className="font-semibold">Parsing the QR URL (Flutter / React Native)</p>
                  <pre className="text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre text-blue-900">
{`final uri = Uri.parse(scannedUrl);
final segments = uri.pathSegments;
// segments: ["judge-qr", eventId, token]
final eventId = segments[1];
final token   = segments[2];
final apiBase = uri.queryParameters["apiBase"];
final apiKey  = uri.queryParameters["apiKey"];`}
                  </pre>
                </div>

                <p className="text-xs text-gray-400 text-center">
                  No judge login required — the QR token authenticates the session.
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
