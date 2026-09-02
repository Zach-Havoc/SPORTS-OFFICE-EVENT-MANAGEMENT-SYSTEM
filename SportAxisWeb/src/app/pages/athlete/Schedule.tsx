import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Calendar, MapPin, Clock, Trophy } from 'lucide-react';
import { useEvents } from '../../hooks/api';
import { RefreshStatus } from '../../components/RefreshStatus';
import { useDeptAbbreviator } from '../../utils/departments';

interface Event {
  id: string;
  name: string;
  category: string;
  sport: string;
  schedule: string;
  startTime: string;
  endTime: string;
  venue: string;
  status: string;
  departments: string[];
}

export default function AthleteSchedule() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'completed'>('all');

  useEffect(() => {
    if (!user || user.role !== 'athlete') navigate('/login');
  }, [user, navigate]);

  const eventsQuery = useEvents();
  const abbr = useDeptAbbreviator();
  const events: Event[] = useMemo(
    () =>
      [...((eventsQuery.data as Event[]) ?? [])].sort(
        (a, b) => new Date(a.schedule).getTime() - new Date(b.schedule).getTime(),
      ),
    [eventsQuery.data],
  );
  const loading = eventsQuery.isLoading;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (time: string) => {
    return time;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'ongoing': return 'bg-green-100 text-green-800 border-green-300';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    return event.status === filter;
  });

  const upcomingCount = events.filter(e => e.status === 'upcoming').length;
  const ongoingCount = events.filter(e => e.status === 'ongoing').length;

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">My Schedule</h1>
          <RefreshStatus
            fetching={eventsQuery.isFetching && !loading}
            error={eventsQuery.isRefetchError}
            onRetry={() => eventsQuery.refetch()}
          />
        </div>
        <p className="text-gray-600 mt-2">View your upcoming games and events</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{upcomingCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Ongoing Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{ongoingCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{events.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Buttons */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-2 flex-wrap">
            <Badge
              variant={filter === 'all' ? 'default' : 'outline'}
              className="cursor-pointer px-4 py-2"
              onClick={() => setFilter('all')}
            >
              All Events
            </Badge>
            <Badge
              variant={filter === 'upcoming' ? 'default' : 'outline'}
              className="cursor-pointer px-4 py-2"
              onClick={() => setFilter('upcoming')}
            >
              Upcoming
            </Badge>
            <Badge
              variant={filter === 'ongoing' ? 'default' : 'outline'}
              className="cursor-pointer px-4 py-2"
              onClick={() => setFilter('ongoing')}
            >
              Ongoing
            </Badge>
            <Badge
              variant={filter === 'completed' ? 'default' : 'outline'}
              className="cursor-pointer px-4 py-2"
              onClick={() => setFilter('completed')}
            >
              Completed
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              Loading schedule...
            </CardContent>
          </Card>
        ) : filteredEvents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 mb-2">
                {filter === 'all' ? 'No events scheduled' : `No ${filter} events`}
              </p>
              <p className="text-sm text-gray-400">Check back later for updates</p>
            </CardContent>
          </Card>
        ) : (
          filteredEvents.map(event => (
            <Card key={event.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl">{abbr(event.name)}</CardTitle>
                      <Badge variant="secondary">{event.sport}</Badge>
                      <Badge className={getStatusColor(event.status)}>
                        {event.status}
                      </Badge>
                    </div>
                  </div>
                  <Trophy className="h-6 w-6 text-[#C8102E]" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Date</p>
                      <p className="text-sm text-gray-600">{formatDate(event.schedule)}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Time</p>
                      <p className="text-sm text-gray-600">
                        {formatTime(event.startTime)} - {formatTime(event.endTime)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Venue</p>
                      <p className="text-sm text-gray-600">{event.venue || 'TBA'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
