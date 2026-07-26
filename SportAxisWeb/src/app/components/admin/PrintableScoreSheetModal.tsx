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

  const isBasketballEvent = (event.category || '').toLowerCase().includes('basketball') || (event.name || '').toLowerCase().includes('basketball');
  const [formType, setFormType] = useState<'basketball' | 'standard'>(isBasketballEvent ? 'basketball' : 'basketball');

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:w-full print:p-0 print:m-0 print:border-none print:shadow-none">
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex justify-between items-center text-xl font-bold">
            <div className="flex items-center gap-3">
              <span>Official Score Sheet Template</span>
              {/* Form Type Toggle Switch */}
              <div className="flex bg-gray-100 p-1 rounded-lg border text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFormType('basketball')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    formType === 'basketball'
                      ? 'bg-red-600 text-white shadow-sm font-bold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🏀 Basketball Form
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('standard')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    formType === 'standard'
                      ? 'bg-red-600 text-white shadow-sm font-bold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📋 Criteria Form
                </button>
              </div>
            </div>
            <Button size="sm" onClick={handlePrint} className="bg-red-600 hover:bg-red-700 text-white gap-2">
              <Printer className="h-4 w-4" />
              Print / Save as PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Printable Score Sheet Body */}
        <div id="printable-score-sheet" className="bg-white p-6 rounded-lg text-black font-sans print:p-4">
          {formType === 'basketball' ? (
            <div className="space-y-3">
              {/* Header */}
              <div className="text-center border-b-2 border-red-700 pb-2">
                <h1 className="text-xl font-black text-red-800 uppercase tracking-wide">BATSTATEU ARASOF SPORTS OFFICE</h1>
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">SPORTAXIS OFFICIAL BASKETBALL GAME SCORE SHEET</p>
                <div className="mt-1 inline-block px-3 py-0.5 bg-red-100 text-red-800 rounded font-bold text-[10px] uppercase border border-red-300">
                  EVENT: {event.name}
                </div>
              </div>

              {/* Game Info Table */}
              <table className="w-full border-collapse border-2 border-black text-xs font-bold">
                <tbody>
                  <tr>
                    <td className="border-2 border-black p-2 w-1/4">TEAM A: <span className="text-red-700 font-extrabold">{event.departments[0] || 'TEAM A'}</span></td>
                    <td className="border-2 border-black p-2 w-1/4">TEAM B: <span className="text-red-700 font-extrabold">{event.departments[1] || 'TEAM B'}</span></td>
                    <td className="border-2 border-black p-2 w-1/4">GYM: {event.venueName || 'SPORTS COMPLEX'}</td>
                    <td className="border-2 border-black p-2 w-1/4">DATE: {formattedDate}</td>
                  </tr>
                </tbody>
              </table>

              {/* Running Score Box */}
              <div className="border-2 border-black p-2 bg-gray-50 text-[10px]">
                <div className="font-bold mb-1">RUNNING SCORE :</div>
                <div className="font-mono text-center leading-relaxed tracking-wider">
                  1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 43 44 45 46 47 48 49<br/>
                  50 51 52 53 54 55 56 57 58 59 60 61 62 63 64 65 66 67 68 69 70 71 72 73 74 75 76 77 78 79 80 81 82 83 84 85 86 87 88 89 90 91 92 93 94 95<br/>
                  96 97 98 99 100
                </div>
              </div>

              {/* Matched Teams Quarter Summary Table */}
              <table className="w-full border-collapse border-2 border-black text-xs font-bold text-center">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border-2 border-black p-1 text-left w-1/4">MATCHED TEAMS</th>
                    <th className="border-2 border-black p-1">1ST QUARTER</th>
                    <th className="border-2 border-black p-1">2ND QUARTER</th>
                    <th className="border-2 border-black p-1">3RD QUARTER</th>
                    <th className="border-2 border-black p-1">4TH QUARTER</th>
                    <th className="border-2 border-black p-1">1ST OT</th>
                    <th className="border-2 border-black p-1">2ND OT</th>
                    <th className="border-2 border-black p-1 bg-red-700 text-white">FINAL SCORE</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border-2 border-black p-2 text-left text-red-700 font-extrabold">{event.departments[0] || 'TEAM A'}</td>
                    <td className="border-2 border-black p-2"></td>
                    <td className="border-2 border-black p-2"></td>
                    <td className="border-2 border-black p-2"></td>
                    <td className="border-2 border-black p-2"></td>
                    <td className="border-2 border-black p-2"></td>
                    <td className="border-2 border-black p-2"></td>
                    <td className="border-2 border-black p-2 bg-gray-100 font-extrabold text-sm"></td>
                  </tr>
                  <tr>
                    <td className="border-2 border-black p-2 text-left text-red-700 font-extrabold">{event.departments[1] || 'TEAM B'}</td>
                    <td className="border-2 border-black p-2"></td>
                    <td className="border-2 border-black p-2"></td>
                    <td className="border-2 border-black p-2"></td>
                    <td className="border-2 border-black p-2"></td>
                    <td className="border-2 border-black p-2"></td>
                    <td className="border-2 border-black p-2"></td>
                    <td className="border-2 border-black p-2 bg-gray-100 font-extrabold text-sm"></td>
                  </tr>
                </tbody>
              </table>

              {/* TEAM A ROSTER TABLE */}
              <div className="text-[11px] font-bold text-red-800 uppercase mt-2">TEAM A: {event.departments[0] || 'TEAM A'} ROSTER & FOULS</div>
              <table className="w-full border-collapse border-2 border-black text-xs">
                <thead>
                  <tr className="bg-red-700 text-white font-bold">
                    <th className="border-2 border-black p-1 w-[8%] text-center">QUARTER</th>
                    <th className="border-2 border-black p-1 text-left pl-2">PLAYERS</th>
                    <th className="border-2 border-black p-1 w-[10%] text-center">JERSEY #</th>
                    <th className="border-2 border-black p-1 w-[18%] text-center">FOULS</th>
                    <th className="border-2 border-black p-1 w-[5%] text-center">1ST Q</th>
                    <th className="border-2 border-black p-1 w-[5%] text-center">2ND Q</th>
                    <th className="border-2 border-black p-1 w-[5%] text-center">3RD Q</th>
                    <th className="border-2 border-black p-1 w-[5%] text-center">4TH Q</th>
                    <th className="border-2 border-black p-1 w-[5%] text-center">1ST OT</th>
                    <th className="border-2 border-black p-1 w-[5%] text-center">2ND OT</th>
                    <th className="border-2 border-black p-1 w-[6%] text-center">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="h-5">
                      <td className="border-2 border-black text-center text-[9px] font-bold">1 2 3 4</td>
                      <td className="border-2 border-black px-2"></td>
                      <td className="border-2 border-black text-center"></td>
                      <td className="border-2 border-black text-center">
                        <span className="inline-block border border-black w-3.5 h-3.5 text-[9px] leading-tight mx-0.5 font-bold">1</span>
                        <span className="inline-block border border-black w-3.5 h-3.5 text-[9px] leading-tight mx-0.5 font-bold">2</span>
                        <span className="inline-block border border-black w-3.5 h-3.5 text-[9px] leading-tight mx-0.5 font-bold">3</span>
                        <span className="inline-block border border-black w-3.5 h-3.5 text-[9px] leading-tight mx-0.5 font-bold">4</span>
                        <span className="inline-block border border-black w-3.5 h-3.5 text-[9px] leading-tight mx-0.5 font-bold">5</span>
                      </td>
                      <td className="border-2 border-black"></td>
                      <td className="border-2 border-black"></td>
                      <td className="border-2 border-black"></td>
                      <td className="border-2 border-black"></td>
                      <td className="border-2 border-black"></td>
                      <td className="border-2 border-black"></td>
                      <td className="border-2 border-black bg-gray-100"></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* TEAM B ROSTER TABLE */}
              <div className="text-[11px] font-bold text-red-800 uppercase mt-2">TEAM B: {event.departments[1] || 'TEAM B'} ROSTER & FOULS</div>
              <table className="w-full border-collapse border-2 border-black text-xs">
                <thead>
                  <tr className="bg-red-700 text-white font-bold">
                    <th className="border-2 border-black p-1 w-[8%] text-center">QUARTER</th>
                    <th className="border-2 border-black p-1 text-left pl-2">PLAYERS</th>
                    <th className="border-2 border-black p-1 w-[10%] text-center">JERSEY #</th>
                    <th className="border-2 border-black p-1 w-[18%] text-center">FOULS</th>
                    <th className="border-2 border-black p-1 w-[5%] text-center">1ST Q</th>
                    <th className="border-2 border-black p-1 w-[5%] text-center">2ND Q</th>
                    <th className="border-2 border-black p-1 w-[5%] text-center">3RD Q</th>
                    <th className="border-2 border-black p-1 w-[5%] text-center">4TH Q</th>
                    <th className="border-2 border-black p-1 w-[5%] text-center">1ST OT</th>
                    <th className="border-2 border-black p-1 w-[5%] text-center">2ND OT</th>
                    <th className="border-2 border-black p-1 w-[6%] text-center">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="h-5">
                      <td className="border-2 border-black text-center text-[9px] font-bold">1 2 3 4</td>
                      <td className="border-2 border-black px-2"></td>
                      <td className="border-2 border-black text-center"></td>
                      <td className="border-2 border-black text-center">
                        <span className="inline-block border border-black w-3.5 h-3.5 text-[9px] leading-tight mx-0.5 font-bold">1</span>
                        <span className="inline-block border border-black w-3.5 h-3.5 text-[9px] leading-tight mx-0.5 font-bold">2</span>
                        <span className="inline-block border border-black w-3.5 h-3.5 text-[9px] leading-tight mx-0.5 font-bold">3</span>
                        <span className="inline-block border border-black w-3.5 h-3.5 text-[9px] leading-tight mx-0.5 font-bold">4</span>
                        <span className="inline-block border border-black w-3.5 h-3.5 text-[9px] leading-tight mx-0.5 font-bold">5</span>
                      </td>
                      <td className="border-2 border-black"></td>
                      <td className="border-2 border-black"></td>
                      <td className="border-2 border-black"></td>
                      <td className="border-2 border-black"></td>
                      <td className="border-2 border-black"></td>
                      <td className="border-2 border-black"></td>
                      <td className="border-2 border-black bg-gray-100"></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Team Fouls Bar */}
              <div className="flex justify-between items-center text-xs font-bold border-2 border-black p-2 bg-gray-50">
                <div>
                  TEAM FOULS 1ST HALF: 
                  <span className="ml-1 inline-flex gap-0.5">
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <span key={n} className="border-2 border-black w-4 h-4 text-center text-[10px] leading-4 bg-white">{n}</span>
                    ))}
                  </span>
                </div>
                <div>
                  TECHNICAL FOULS: 
                  <span className="ml-1 inline-flex gap-0.5">
                    {[1,2,3,4,5,6].map(n => (
                      <span key={n} className="border-2 border-black w-4 h-4 text-center text-[10px] leading-4 bg-white">{n}</span>
                    ))}
                  </span>
                </div>
                <div>
                  TEAM FOULS 2ND HALF: 
                  <span className="ml-1 inline-flex gap-0.5">
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <span key={n} className="border-2 border-black w-4 h-4 text-center text-[10px] leading-4 bg-white">{n}</span>
                    ))}
                  </span>
                </div>
              </div>

              {/* Timeouts & Signatures Row */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <table className="border-collapse border-2 border-black text-[10px] font-bold text-center">
                  <thead>
                    <tr className="bg-red-700 text-white">
                      <th className="border-2 border-black p-1 text-left w-1/4">TIME OUT</th>
                      <th className="border-2 border-black p-1">30 SEC</th>
                      <th className="border-2 border-black p-1">30 SEC</th>
                      <th className="border-2 border-black p-1">FULL</th>
                      <th className="border-2 border-black p-1">FULL</th>
                      <th className="border-2 border-black p-1">FULL</th>
                      <th className="border-2 border-black p-1">TO+1</th>
                      <th className="border-2 border-black p-1">TO+1</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border-2 border-black p-1 text-left">CALLED BY</td>
                      <td className="border-2 border-black"></td><td className="border-2 border-black"></td><td className="border-2 border-black"></td><td className="border-2 border-black"></td><td className="border-2 border-black"></td><td className="border-2 border-black"></td><td className="border-2 border-black"></td>
                    </tr>
                    <tr>
                      <td className="border-2 border-black p-1 text-left">ON CLOCK</td>
                      <td className="border-2 border-black"></td><td className="border-2 border-black"></td><td className="border-2 border-black"></td><td className="border-2 border-black"></td><td className="border-2 border-black"></td><td className="border-2 border-black"></td><td className="border-2 border-black"></td>
                    </tr>
                    <tr>
                      <td className="border-2 border-black p-1 text-left">QUARTER</td>
                      <td className="border-2 border-black"></td><td className="border-2 border-black"></td><td className="border-2 border-black"></td><td className="border-2 border-black"></td><td className="border-2 border-black"></td><td className="border-2 border-black">1ST OT</td><td className="border-2 border-black">2ND OT</td>
                    </tr>
                  </tbody>
                </table>

                <div className="text-xs font-bold space-y-2 pl-4">
                  <div>OFFICIAL REF : <div className="border-b-2 border-black w-full mt-1"></div></div>
                  <div>SCORE KEEPER : <div className="border-b-2 border-black w-full mt-1"></div></div>
                  <div>TIME KEEPER : <div className="border-b-2 border-black w-full mt-1"></div></div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Event Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm mb-6 bg-gray-50 p-4 rounded border border-gray-200">
                <div>
                  <p className="mb-1"><span className="font-bold text-gray-700">Event Name:</span> <span className="font-semibold text-black">{event.name}</span></p>
                  <p className="mb-1"><span className="font-bold text-gray-700">Sport Category:</span> {event.category}</p>
                  <p><span className="font-bold text-gray-700">Venue / Gym:</span> {event.venueName || 'Main Sports Complex'}</p>
                </div>
                <div>
                  <p className="mb-1"><span className="font-bold text-gray-700">Date:</span> {formattedDate}</p>
                  <p className="mb-1"><span className="font-bold text-gray-700">Scheduled Time:</span> {event.startTime || '09:00'} - {event.endTime || '12:00'}</p>
                  <p><span className="font-bold text-gray-700">Event ID:</span> <span className="font-mono text-xs text-gray-600">{event.id}</span></p>
                </div>
              </div>

              {/* Standard Criteria Reference Banner */}
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
            </>
          )}
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
