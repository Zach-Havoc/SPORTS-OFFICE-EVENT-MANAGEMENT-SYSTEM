import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Printer, X } from 'lucide-react';

interface PrintableScoreSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: {
    id: string;
    name: string;
    category: string;
    schedule: string;
    startTime?: string;
    endTime?: string;
    venueName?: string;
    departments: string[];
    criteria: Array<{ name: string; weight: number; max_score?: number }>;
    qrToken?: string;
  } | null;
}

export const PrintableScoreSheetModal: React.FC<PrintableScoreSheetModalProps> = ({
  isOpen,
  onClose,
  event,
}) => {
  if (!event) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = event.schedule
    ? new Date(event.schedule).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:w-full print:p-0 print:m-0 print:border-none print:shadow-none">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex justify-between items-center text-xl font-bold">
            <span>Official Scoring Sheet Template</span>
            <Button size="sm" onClick={handlePrint} className="bg-red-600 hover:bg-red-700 text-white gap-2">
              <Printer className="h-4 w-4" />
              Print / Save as PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Printable Score Sheet Body */}
        <div id="printable-score-sheet" className="bg-white p-6 rounded-lg text-black font-sans print:p-8">
          {/* Header Section */}
          <div className="border-b-2 border-red-700 pb-4 mb-6 text-center relative">
            <h1 className="text-2xl font-black tracking-wide text-red-800 uppercase">
              BatStateU ARASOF Sports Office
            </h1>
            <p className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              SportAxis Event Management & Official Scoring System
            </p>
            <div className="mt-2 inline-block px-4 py-1 bg-red-100 text-red-800 rounded font-bold text-xs uppercase tracking-widest border border-red-300">
              OFFICIAL HANDWRITTEN SCORE SHEET (OCR FORMATTED)
            </div>
          </div>

          {/* Event Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm mb-6 bg-gray-50 p-4 rounded border border-gray-200">
            <div>
              <p className="mb-1"><span className="font-bold text-gray-700">Event Name:</span> <span className="font-semibold text-black">{event.name}</span></p>
              <p className="mb-1"><span className="font-bold text-gray-700">Sport Category:</span> {event.category}</p>
              <p><span className="font-bold text-gray-700">Venue:</span> {event.venueName || 'Main Sports Complex'}</p>
            </div>
            <div>
              <p className="mb-1"><span className="font-bold text-gray-700">Date:</span> {formattedDate}</p>
              <p className="mb-1"><span className="font-bold text-gray-700">Time:</span> {event.startTime || '09:00'} - {event.endTime || '12:00'}</p>
              <p><span className="font-bold text-gray-700">Event ID:</span> <span className="font-mono text-xs text-gray-600">{event.id}</span></p>
            </div>
          </div>

          {/* Criteria Reference Banner */}
          <div className="mb-6">
            <h2 className="text-md font-bold text-red-800 uppercase tracking-wide mb-2 border-b pb-1">
              Judging Criteria & Maximum Points
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {event.criteria.map((crit, idx) => (
                <div key={idx} className="border border-gray-300 p-2 rounded bg-gray-50">
                  <p className="font-bold text-gray-900">{idx + 1}. {crit.name}</p>
                  <p className="text-gray-600">Weight: {crit.weight}% | Max Score: {crit.max_score || (crit.weight ? (crit.weight / 10).toFixed(1) : '10.0')}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Scoring Table with Boxed Layout for Handwriting & OCR */}
          <div className="mb-6">
            <h2 className="text-md font-bold text-red-800 uppercase tracking-wide mb-2">
              Scores Entry Grid (Write scores clearly inside the boxes)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border-2 border-gray-800 text-sm">
                <thead>
                  <tr className="bg-red-800 text-white">
                    <th className="border border-gray-800 p-2 text-left w-12">#</th>
                    <th className="border border-gray-800 p-2 text-left">Participating Department / Team</th>
                    {event.criteria.map((crit, idx) => (
                      <th key={idx} className="border border-gray-800 p-2 text-center w-28">
                        <div>C{idx + 1}: {crit.name}</div>
                        <div className="text-[10px] font-normal opacity-90">(Max {crit.max_score || 10})</div>
                      </th>
                    ))}
                    <th className="border border-gray-800 p-2 text-center w-28">Total Score</th>
                  </tr>
                </thead>
                <tbody>
                  {event.departments.map((dept, dIdx) => (
                    <tr key={dIdx} className={dIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-800 p-3 font-bold text-center">{dIdx + 1}</td>
                      <td className="border border-gray-800 p-3 font-bold text-gray-900">{dept}</td>
                      {event.criteria.map((_, cIdx) => (
                        <td key={cIdx} className="border border-gray-800 p-3 text-center">
                          <div className="w-20 h-10 border-2 border-dashed border-gray-400 mx-auto rounded flex items-center justify-center font-mono text-lg font-bold text-gray-700 bg-white">
                            {/* Blank score box for handwriting */}
                          </div>
                        </td>
                      ))}
                      <td className="border border-gray-800 p-3 text-center">
                        <div className="w-20 h-10 border-2 border-gray-600 mx-auto rounded flex items-center justify-center font-mono text-lg font-bold bg-gray-100">
                          {/* Total Score box */}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Instructions & OCR Markers */}
          <div className="border border-gray-300 p-3 rounded text-xs text-gray-600 mb-6 bg-yellow-50">
            <p className="font-bold text-yellow-900 mb-1">📋 Instructions for Scoring & OCR Scanning:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Write scores legibly using black or dark blue ink inside each dashed box.</li>
              <li>When finished, open the <strong>SportsAxis Mobile App</strong> and log in as a Judge.</li>
              <li>Scan this form using the <strong>OCR Score Capture</strong> feature to automatically import the written scores.</li>
            </ol>
          </div>

          {/* Signatures & Certification */}
          <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-gray-300">
            <div>
              <p className="text-xs text-gray-500 mb-8">Judge Name & Signature:</p>
              <div className="border-b border-black w-3/4 mb-1"></div>
              <p className="text-xs font-bold text-gray-700">Official Facilitator / Judge</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-8">Chief Scorer Verification:</p>
              <div className="border-b border-black w-3/4 mb-1"></div>
              <p className="text-xs font-bold text-gray-700">Sports Office Chief Officer</p>
            </div>
          </div>
        </div>

        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={onClose} className="gap-2">
            <X className="h-4 w-4" /> Close
          </Button>
          <Button onClick={handlePrint} className="bg-red-600 hover:bg-red-700 text-white gap-2">
            <Printer className="h-4 w-4" /> Print Sheet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
