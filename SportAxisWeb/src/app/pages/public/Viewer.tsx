import { useEffect, useState } from 'react';
import { getEvents, getEventRankings, startWarmup } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Trophy, Calendar, Users, Loader2, Clock, MapPin } from 'lucide-react';
import Loading from '../../components/Loading';

interface Event {
  id: string;
  name: string;
  category: string;
  schedule: string;
  startTime?: string;
  endTime?: string;
  venueName?: string;
  venue?: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  departments: string[];
}

interface Ranking {
  department: string;
  totalScore: number;
  rank: number;
}

export default function PublicViewer() {
  const [events, setEvents] = useState<Event[]>([]);
  const [rankings, setRankings] = useState<Record<string, Ranking[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Helper function to format time
  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  useEffect(() => {
    loadData();

    // Set up polling for live updates every 10 seconds
    const interval = setInterval(() => {
      console.log('Polling for updates...');
      loadData();
    }, 10000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  // Refresh rankings when modal opens
  useEffect(() => {
    if (selectedEvent) {
      const loadEventRankings = async () => {
        try {
          const eventRankings = await getEventRankings(selectedEvent.id);
          if (Array.isArray(eventRankings)) {
            setRankings(prev => ({
              ...prev,
              [selectedEvent.id]: eventRankings
            }));
          }
        } catch (error) {
          console.error('Error loading rankings for modal:', error);
        }
      };
      loadEventRankings();
    }
  }, [selectedEvent]);

  // Auto-retry when server is starting up
  useEffect(() => {
    if (error && autoRetryCount < 3) {
      const isServerStarting = error.includes('starting up') || error.includes('connect to the server');

      if (isServerStarting) {
        console.log(`Auto-retry ${autoRetryCount + 1}/3 in 3 seconds...`);
        const timer = setTimeout(() => {
          setAutoRetryCount(prev => prev + 1);
          setError(null);
          setLoading(true);
          loadData();
        }, 3000);

        return () => clearTimeout(timer);
      }
    }
  }, [error, autoRetryCount]);


  const loadData = async () => {
    try {
      console.log('Loading events data...');
      setError(null);
      await startWarmup();
      const eventsData = await getEvents();
      console.log('Events loaded:', eventsData);

      // Normalize events to ensure all required fields exist
      const normalizedEvents = (eventsData || []).map((event: any) => ({
        ...event,
        departments: event.departments || [],
        criteria: event.criteria || []
      }));

      setEvents(normalizedEvents);

      // Load rankings for ongoing events
      const ongoingEvents = normalizedEvents.filter((e: Event) => e.status === 'ongoing');
      const rankingsData: Record<string, Ranking[]> = {};
      
      for (const event of ongoingEvents) {
        try {
          console.log(`Fetching rankings for event ${event.id}...`);
          const eventRankings = await getEventRankings(event.id);
          console.log(`Rankings fetched for event ${event.id}:`, eventRankings);
          
          // Handle both array responses and error objects
          if (Array.isArray(eventRankings)) {
            rankingsData[event.id] = eventRankings;
          } else {
            console.log(`Non-array response for event ${event.id}, setting empty array`);
            rankingsData[event.id] = [];
          }
        } catch (error: any) {
          console.error(`Error loading rankings for event ${event.id}:`, error);
          // Set empty array for events with errors - don't break the whole page
          rankingsData[event.id] = [];
        }
      }
      
      console.log('All rankings loaded:', rankingsData);
      setRankings(rankingsData);
      setLastUpdate(new Date());

      // Reset auto-retry count on success
      setAutoRetryCount(0);
    } catch (error: any) {
      console.error('Error loading public data:', error);
      console.error('Error details:', error.message, error.stack);
      setError(error.message || 'Failed to load data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ongoing': return 'bg-green-500';
      case 'upcoming': return 'bg-blue-500';
      case 'completed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const ongoingEvents = events.filter(e => e.status === 'ongoing');

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Loading fullScreen={false} message="Loading events..." />
      </div>
    );
  }

  if (error) {
    const isServerStarting = error.includes('starting up') || error.includes('connect to the server');
    const willAutoRetry = isServerStarting && autoRetryCount < 3;

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className={isServerStarting ? "border-yellow-200 bg-yellow-50" : "border-red-200 bg-red-50"}>
          <CardContent className="py-8 text-center">
            {isServerStarting ? (
              <>
                <div className="inline-flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-yellow-100">
                  <Loader2 className="h-6 w-6 text-yellow-600 animate-spin" />
                </div>
                <p className="text-yellow-800 font-semibold mb-2">Server is Waking Up</p>
                <p className="text-yellow-700 text-sm mb-4">
                  The server goes to sleep when inactive.
                  {willAutoRetry ? (
                    <> Retrying automatically in a moment... (Attempt {autoRetryCount + 1}/3)</>
                  ) : (
                    <> Please click refresh to try again.</>
                  )}
                </p>
                <button
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                    setAutoRetryCount(0);
                    loadData();
                  }}
                  className="px-6 py-3 bg-yellow-600 text-white rounded-md text-sm font-medium hover:bg-yellow-700 transition-colors shadow-sm"
                >
                  Refresh Now
                </button>
              </>
            ) : (
              <>
                <p className="text-red-600 font-semibold mb-2">Error Loading Data</p>
                <p className="text-red-500 text-sm mb-4">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                    setAutoRetryCount(0);
                    loadData();
                  }}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Retry
                </button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Live Events</h1>
            <Badge className="bg-red-500 text-white animate-pulse">
              ● Live
            </Badge>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Ongoing Events */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Ongoing Events</h2>
        {ongoingEvents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No ongoing events at the moment
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ongoingEvents.map(event => (
              <Card 
                key={event.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedEvent(event)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <Badge className={getStatusColor(event.status)}>
                      {event.status}
                    </Badge>
                    <Trophy className="h-5 w-5 text-yellow-500" />
                  </div>
                  <CardTitle className="text-xl">{event.name}</CardTitle>
                  <CardDescription>{event.category}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-2" />
                      {new Date(event.schedule).toLocaleDateString()}
                      {event.startTime && event.endTime && (
                        <span className="ml-2 text-blue-600 font-medium">
                          • {formatTime(event.startTime)} - {formatTime(event.endTime)}
                        </span>
                      )}
                    </div>
                    {(event.venueName || event.venue) && (
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-2 text-red-500" />
                        <span className="font-medium text-gray-800">{event.venueName || event.venue}</span>
                      </div>
                    )}
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="h-4 w-4 mr-2" />
                      {(event.departments || []).length} departments
                    </div>

                    {/* Rankings */}
                    {rankings[event.id] && rankings[event.id].length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="font-semibold text-sm mb-3">Current Rankings</h4>
                        <div className="space-y-2">
                          {rankings[event.id].slice(0, 3).map((ranking, index) => (
                            <div key={ranking.department} className="flex justify-between items-center text-sm">
                              <div className="flex items-center">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-2 ${
                                  index === 0 ? 'bg-yellow-400 text-yellow-900' :
                                  index === 1 ? 'bg-gray-300 text-gray-700' :
                                  'bg-orange-300 text-orange-900'
                                }`}>
                                  {ranking.rank}
                                </span>
                                <span className="font-medium">{event.departments[Number(ranking.department)] || ranking.department}</span>
                              </div>
                              <span className="font-bold text-blue-600">{Number(ranking.totalScore || 0).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Event Detail Modal */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedEvent && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <DialogTitle className="text-2xl mb-2">{selectedEvent.name}</DialogTitle>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(selectedEvent.status)}>
                        {selectedEvent.status}
                      </Badge>
                      <Badge variant="outline">{selectedEvent.category}</Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Event Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-500">Date</p>
                      <p className="font-medium">{new Date(selectedEvent.schedule).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                  </div>
                  {selectedEvent.startTime && selectedEvent.endTime && (
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Time</p>
                        <p className="font-medium">{formatTime(selectedEvent.startTime)} - {formatTime(selectedEvent.endTime)}</p>
                      </div>
                    </div>
                  )}
                  {(selectedEvent.venueName || selectedEvent.venue) && (
                    <div className="flex items-center gap-3 md:col-span-2">
                      <MapPin className="h-5 w-5 text-red-500" />
                      <div>
                        <p className="text-sm text-gray-500">Venue</p>
                        <p className="font-medium text-gray-900">{selectedEvent.venueName || selectedEvent.venue}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Departments */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Participating Departments ({(selectedEvent.departments || []).length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(selectedEvent.departments || []).map((dept) => (
                      <Badge key={dept} variant="secondary" className="text-sm">
                        {dept}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Full Rankings */}
                {rankings[selectedEvent.id] && rankings[selectedEvent.id].length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Trophy className="h-5 w-5" />
                      Current Rankings
                    </h3>
                    <div className="space-y-2">
                      {rankings[selectedEvent.id].map((ranking, index) => (
                        <div 
                          key={ranking.department} 
                          className={`flex justify-between items-center p-3 rounded-lg ${
                            index === 0 ? 'bg-yellow-50 border border-yellow-200' :
                            index === 1 ? 'bg-gray-50 border border-gray-200' :
                            index === 2 ? 'bg-orange-50 border border-orange-200' :
                            'bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              index === 0 ? 'bg-yellow-400 text-yellow-900' :
                              index === 1 ? 'bg-gray-400 text-gray-900' :
                              index === 2 ? 'bg-orange-400 text-orange-900' :
                              'bg-blue-500 text-white'
                            }`}>
                              {ranking.rank}
                            </span>
                            <span className="font-medium">{selectedEvent.departments[Number(ranking.department)] || ranking.department}</span>
                          </div>
                          <span className="font-bold text-blue-600 text-lg">{Number(ranking.totalScore || 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Rankings Message */}
                {(!rankings[selectedEvent.id] || rankings[selectedEvent.id].length === 0) && (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No rankings available yet</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}