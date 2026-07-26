import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Calendar as CalendarIcon, CheckCircle, XCircle, Clock, Users, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { getAthletes, getEvents, markAttendance, getAttendanceRecords } from '../../services/api';

interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  department: string;
  status: string;
}

interface Event {
  id: string;
  name: string;
  sport: string;
  schedule: string;
  venue: string;
}

interface AttendanceRecord {
  id: string;
  athleteId: string;
  eventId: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes: string;
  recordedBy: string;
}

export default function CoachAttendance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late' | 'excused'>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'coach') {
      navigate('/login');
      return;
    }
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [athletesData, eventsData] = await Promise.all([
        getAthletes(),
        getEvents()
      ]);
      setAthletes(athletesData);
      setEvents(eventsData.filter((e: Event) => e.sport)); // Only sports events

      // Initialize attendance to 'present' for all athletes
      const initialAttendance: Record<string, 'present' | 'absent' | 'late' | 'excused'> = {};
      athletesData.forEach((athlete: Athlete) => {
        initialAttendance[athlete.id] = 'present';
      });
      setAttendance(initialAttendance);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = (athleteId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    setAttendance(prev => ({ ...prev, [athleteId]: status }));
  };

  const handleSaveAttendance = async () => {
    if (!selectedEvent && !selectedDate) {
      toast.error('Please select an event or date');
      return;
    }

    try {
      setSaving(true);
      const records = Object.entries(attendance).map(([athleteId, status]) => ({
        athleteId,
        eventId: selectedEvent || 'training',
        date: selectedDate,
        status,
        notes: notes[athleteId] || ''
      }));

      await markAttendance(records);
      toast.success('Attendance marked successfully');

      // Reset to 'present' for all
      const resetAttendance: Record<string, 'present' | 'absent' | 'late' | 'excused'> = {};
      athletes.forEach((athlete) => {
        resetAttendance[athlete.id] = 'present';
      });
      setAttendance(resetAttendance);
      setNotes({});
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      toast.error(error.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800 border-green-300';
      case 'absent': return 'bg-red-100 text-red-800 border-red-300';
      case 'late': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'excused': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle className="h-4 w-4" />;
      case 'absent': return <XCircle className="h-4 w-4" />;
      case 'late': return <Clock className="h-4 w-4" />;
      case 'excused': return <CheckCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  const filteredAthletes = athletes.filter(athlete =>
    athlete.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    athlete.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    athlete.studentId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    present: Object.values(attendance).filter(s => s === 'present').length,
    absent: Object.values(attendance).filter(s => s === 'absent').length,
    late: Object.values(attendance).filter(s => s === 'late').length,
    excused: Object.values(attendance).filter(s => s === 'excused').length,
  };

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Mark Attendance</h1>
        <p className="text-gray-600 mt-2">Track athlete attendance for training and events</p>
      </div>

      {/* Selection Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Attendance Details</CardTitle>
          <CardDescription>Select event and date to mark attendance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Event (Optional)</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
              >
                <option value="">Training Session</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.name} - {event.sport}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date *</label>
              <input
                type="date"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Present</p>
                <p className="text-2xl font-bold text-green-600">{stats.present}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Absent</p>
                <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Late</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.late}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Excused</p>
                <p className="text-2xl font-bold text-blue-600">{stats.excused}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search athletes..."
              className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Attendance List */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Athletes ({filteredAthletes.length})</CardTitle>
          <CardDescription>Mark attendance status for each athlete</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading athletes...</div>
          ) : filteredAthletes.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">No athletes found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAthletes.map(athlete => (
                <div key={athlete.id} className="border rounded-lg p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold">
                        {athlete.firstName} {athlete.lastName}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {athlete.studentId} • {athlete.department}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={attendance[athlete.id] === 'present' ? 'default' : 'outline'}
                        onClick={() => handleMarkAttendance(athlete.id, 'present')}
                        className={attendance[athlete.id] === 'present' ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Present
                      </Button>
                      <Button
                        size="sm"
                        variant={attendance[athlete.id] === 'late' ? 'default' : 'outline'}
                        onClick={() => handleMarkAttendance(athlete.id, 'late')}
                        className={attendance[athlete.id] === 'late' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
                      >
                        <Clock className="h-4 w-4 mr-1" />
                        Late
                      </Button>
                      <Button
                        size="sm"
                        variant={attendance[athlete.id] === 'excused' ? 'default' : 'outline'}
                        onClick={() => handleMarkAttendance(athlete.id, 'excused')}
                        className={attendance[athlete.id] === 'excused' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Excused
                      </Button>
                      <Button
                        size="sm"
                        variant={attendance[athlete.id] === 'absent' ? 'default' : 'outline'}
                        onClick={() => handleMarkAttendance(athlete.id, 'absent')}
                        className={attendance[athlete.id] === 'absent' ? 'bg-red-600 hover:bg-red-700' : ''}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Absent
                      </Button>
                    </div>
                  </div>

                  {(attendance[athlete.id] === 'late' || attendance[athlete.id] === 'excused' || attendance[athlete.id] === 'absent') && (
                    <div className="mt-3">
                      <input
                        type="text"
                        placeholder="Add notes (optional)"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={notes[athlete.id] || ''}
                        onChange={(e) => setNotes(prev => ({ ...prev, [athlete.id]: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveAttendance} disabled={saving || filteredAthletes.length === 0} size="lg">
          {saving ? 'Saving...' : 'Save Attendance'}
        </Button>
      </div>
    </div>
  );
}
