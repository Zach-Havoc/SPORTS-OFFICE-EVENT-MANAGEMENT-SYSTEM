import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getEvents, getEventReport, exportReport } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { FileDown, FileText } from 'lucide-react';
import { toast } from 'sonner';
import Loading from '../../components/Loading';

interface Event {
  id: string;
  name: string;
  status: string;
}

export default function AdminReports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    loadEvents();
  }, [user, navigate]);

  const loadEvents = async () => {
    try {
      const data = await getEvents();
      setEvents(data.filter((e: Event) => e.status === 'completed' || e.status === 'ongoing'));
    } catch (error) {
      console.error('Error loading events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async (eventId: string) => {
    try {
      const data = await getEventReport(eventId);
      setReport(data);
    } catch (error) {
      console.error('Error loading report:', error);
      toast.error('Failed to load report');
    }
  };

  const handleExport = async (format: 'pdf' | 'csv') => {
    if (!selectedEvent) {
      toast.error('Please select an event first');
      return;
    }

    try {
      const data = await exportReport(selectedEvent, format);
      toast.success(`Report exported as ${format.toUpperCase()}`);
      // In a real implementation, this would trigger a download
      console.log('Export data:', data);
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Failed to export report');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Loading fullScreen={false} message="Loading reports..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Reports & Results</h1>
        <p className="text-gray-500 mt-1">Generate and export event reports</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Event</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select value={selectedEvent} onValueChange={(v) => { setSelectedEvent(v); loadReport(v); }}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Choose an event" />
              </SelectTrigger>
              <SelectContent>
                {events.map(event => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name} ({event.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={() => handleExport('pdf')} disabled={!selectedEvent}>
              <FileDown className="h-4 w-4 mr-2" />
              Export PDF
            </Button>

            <Button onClick={() => handleExport('csv')} disabled={!selectedEvent} variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardHeader>
            <CardTitle>Event Report Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Event Details</h3>
                <p className="text-sm text-gray-600">Event: {report.eventName}</p>
                <p className="text-sm text-gray-600">Date: {new Date(report.date).toLocaleDateString()}</p>
                <p className="text-sm text-gray-600">Participants: {report.participants}</p>
              </div>

              {report.rankings && report.rankings.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Final Rankings</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Rank</th>
                          <th className="text-left py-2">College</th>
                          <th className="text-right py-2">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.rankings.map((r: any, i: number) => (
                          <tr key={i} className="border-b">
                            <td className="py-2">{r.rank}</td>
                            <td className="py-2">{r.department}</td>
                            <td className="py-2 text-right font-semibold">{r.score}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!report && selectedEvent && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No report data available for this event
          </CardContent>
        </Card>
      )}
    </div>
  );
}