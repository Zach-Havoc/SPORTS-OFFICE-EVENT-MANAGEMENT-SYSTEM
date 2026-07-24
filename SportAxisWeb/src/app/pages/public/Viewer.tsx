import { useEffect, useState } from 'react';
import { getEvents, getEventRankings, getLeaderboard, getCategories, startWarmup } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Trophy, Calendar, Users, Medal, Award, Crown, Filter, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import DepartmentCarousel from '../../components/DepartmentCarousel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import Loading from '../../components/Loading';

interface Event {
  id: string;
  name: string;
  category: string;
  schedule: string;
  startTime?: string;
  endTime?: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  departments: string[];
}

interface Ranking {
  department: string;
  totalScore: number;
  rank: number;
}

interface LeaderboardEntry {
  department: string;
  totalPoints: number;
  eventsParticipated: number;
  rank: number;
  gold: number;
  silver: number;
  bronze: number;
}

export default function PublicViewer() {
  const [events, setEvents] = useState<Event[]>([]);
  const [rankings, setRankings] = useState<Record<string, Ranking[]>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('overall');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRetryCount, setAutoRetryCount] = useState(0);

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

    // Set up polling for live updates every 30 seconds
    const interval = setInterval(() => {
      console.log('Polling for updates...');
      loadData();
    }, 30000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  // Reload leaderboard when category changes
  useEffect(() => {
    loadLeaderboard(selectedCategory);
  }, [selectedCategory]);

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

  const loadLeaderboard = async (category: string) => {
    try {
      const leaderboardData = await getLeaderboard(category === 'overall' ? undefined : category);
      console.log(`Leaderboard loaded for category ${category}:`, leaderboardData);
      setLeaderboard(leaderboardData || []);
    } catch (error: any) {
      console.error(`Error loading leaderboard for category ${category}:`, error);
      setLeaderboard([]);
      // Don't show error toast for empty results, just show empty state
    }
  };

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

      // Load categories
      const categoriesData = await getCategories();
      console.log('Categories loaded:', categoriesData);
      setCategories(categoriesData || []);

      // Load leaderboard
      await loadLeaderboard(selectedCategory);

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
  const upcomingEvents = events.filter(e => e.status === 'upcoming');

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

      {/* Department Carousel */}
      <div className="mb-8">
        <DepartmentCarousel />
      </div>

      {/* Department Rankings */}
      <Card className="mb-8 bg-gradient-to-br from-red-50 to-pink-50 border-2 border-primary">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Crown className="h-6 w-6 text-yellow-600" />
              <CardTitle className="text-xl sm:text-2xl">Department Rankings</CardTitle>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardDescription className="flex-1">
                {selectedCategory === 'overall' 
                  ? 'Top performing departments across all competitions'
                  : `Top performing departments in ${selectedCategory} competitions`
                }
              </CardDescription>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full sm:w-[180px] bg-white">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="overall">Overall</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Badge variant="outline" className="bg-white text-xs sm:text-sm text-center">
                  Based on Event Wins
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {leaderboard.length > 0 ? (
            <>
              <div className="grid gap-3">
                {leaderboard.slice(0, 5).map((entry, index) => (
                  <div
                    key={entry.department}
                    className={`p-3 sm:p-4 rounded-lg transition-all hover:scale-[1.02] ${
                      index === 0
                        ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 border-2 border-yellow-400'
                        : index === 1
                        ? 'bg-gradient-to-r from-gray-100 to-gray-50 border-2 border-gray-400'
                        : index === 2
                        ? 'bg-gradient-to-r from-orange-100 to-orange-50 border-2 border-orange-400'
                        : 'bg-white border-2 border-gray-200'
                    }`}
                  >
                    {/* Mobile Layout - Stacked */}
                    <div className="flex sm:hidden flex-col gap-2">
                      {/* Top Row: Rank, Department, Points */}
                      <div className="flex items-start gap-2">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                            index === 0
                              ? 'bg-yellow-400 text-yellow-900'
                              : index === 1
                              ? 'bg-gray-400 text-gray-900'
                              : index === 2
                              ? 'bg-orange-400 text-orange-900'
                              : 'bg-blue-500 text-white'
                          }`}
                        >
                          {entry.rank}
                        </div>
                        <div className="flex-1 min-w-0 mr-2">
                          <div className="font-bold text-sm text-gray-900 leading-tight break-words">
                            {entry.department}
                          </div>
                          <div className="text-xs text-gray-600 mt-0.5">
                            {entry.eventsParticipated} {entry.eventsParticipated === 1 ? 'event' : 'events'}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-auto">
                          <div className="text-lg font-bold text-blue-600 leading-tight">
                            {Math.round(entry.totalPoints)}
                          </div>
                          <div className="text-[9px] text-gray-500 uppercase leading-tight">pts</div>
                        </div>
                      </div>
                      
                      {/* Bottom Row: Medals */}
                      <div className="flex items-center justify-evenly gap-1 pt-2 border-t border-gray-200">
                        <div className="flex items-center gap-1">
                          <Trophy className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
                          <span className="font-bold text-yellow-700 text-xs">{entry.gold}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Medal className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          <span className="font-bold text-gray-600 text-xs">{entry.silver}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Award className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                          <span className="font-bold text-orange-600 text-xs">{entry.bronze}</span>
                        </div>
                      </div>
                    </div>

                    {/* Desktop Layout - Single Row */}
                    <div className="hidden sm:flex items-center justify-between">
                      {/* Rank & Department */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 ${
                            index === 0
                              ? 'bg-yellow-400 text-yellow-900'
                              : index === 1
                              ? 'bg-gray-400 text-gray-900'
                              : index === 2
                              ? 'bg-orange-400 text-orange-900'
                              : 'bg-blue-500 text-white'
                          }`}
                        >
                          {entry.rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-lg text-gray-900 truncate">
                            {entry.department}
                          </div>
                          <div className="text-sm text-gray-600">
                            {entry.eventsParticipated} {entry.eventsParticipated === 1 ? 'event' : 'events'}
                          </div>
                        </div>
                      </div>

                      {/* Medals */}
                      <div className="flex items-center gap-4 mr-4">
                        <div className="flex items-center gap-1">
                          <Trophy className="h-5 w-5 text-yellow-500" />
                          <span className="font-bold text-yellow-700">{entry.gold}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Medal className="h-5 w-5 text-gray-400" />
                          <span className="font-bold text-gray-600">{entry.silver}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Award className="h-5 w-5 text-orange-400" />
                          <span className="font-bold text-orange-600">{entry.bronze}</span>
                        </div>
                      </div>

                      {/* Total Points */}
                      <div className="text-right flex-shrink-0">
                        <div className="text-2xl font-bold text-blue-600">
                          {Math.round(entry.totalPoints)}
                        </div>
                        <div className="text-xs text-gray-500 uppercase">points</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {leaderboard.length > 5 && (
                <div className="mt-4 text-center">
                  <a
                    href="/leaderboard"
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm inline-flex items-center gap-1"
                  >
                    View Full Leaderboard
                    <Trophy className="h-4 w-4" />
                  </a>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center">
              <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-2">No Rankings Available</p>
              <p className="text-sm text-gray-500">
                {selectedCategory === 'overall' 
                  ? 'No department rankings data yet. Scores will appear once events are judged.'
                  : `No rankings found for ${selectedCategory} category. Try selecting a different category or check back later.`
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="ongoing" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="ongoing">
            Ongoing ({ongoingEvents.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming ({upcomingEvents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ongoing" className="mt-6">
          {ongoingEvents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                No ongoing events at the moment
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {ongoingEvents.map(event => (
                <Card key={event.id} className="hover:shadow-lg transition-shadow">
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
                                  <span className="font-medium">{ranking.department}</span>
                                </div>
                                <span className="font-bold text-blue-600">{ranking.totalScore.toFixed(2)}</span>
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
        </TabsContent>

        <TabsContent value="upcoming" className="mt-6">
          {upcomingEvents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                No upcoming events scheduled
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {upcomingEvents.map(event => (
                <Card key={event.id}>
                  <CardHeader>
                    <Badge className={`${getStatusColor(event.status)} w-fit mb-2`}>
                      {event.status}
                    </Badge>
                    <CardTitle className="text-xl">{event.name}</CardTitle>
                    <CardDescription>{event.category}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        {new Date(event.schedule).toLocaleDateString()}
                        {event.startTime && event.endTime && (
                          <span className="ml-2 text-blue-600 font-medium">
                            • {formatTime(event.startTime)} - {formatTime(event.endTime)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="h-4 w-4 mr-2" />
                        {(event.departments || []).length} departments participating
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}