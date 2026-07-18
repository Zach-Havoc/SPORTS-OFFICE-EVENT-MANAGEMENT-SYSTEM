import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { TrendingUp, Trophy, Calendar, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { getMyPerformance } from '../../services/api';

interface PerformanceRecord {
  id: string;
  eventId: string;
  eventName: string;
  sport: string;
  metrics: Record<string, any>;
  overallRating: number;
  coachNotes: string;
  recordedAt: string;
}

export default function AthletePerformance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [performances, setPerformances] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'athlete') {
      navigate('/login');
      return;
    }
    loadPerformance();
  }, [user, navigate]);

  const loadPerformance = async () => {
    try {
      setLoading(true);
      const data = await getMyPerformance();
      setPerformances(data);
    } catch (error) {
      console.error('Error loading performance:', error);
      toast.error('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return 'text-green-600';
    if (rating >= 6) return 'text-blue-600';
    if (rating >= 4) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRatingBadgeColor = (rating: number) => {
    if (rating >= 8) return 'bg-green-100 text-green-800 border-green-300';
    if (rating >= 6) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (rating >= 4) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  const averageRating = performances.length > 0
    ? performances.reduce((sum, p) => sum + p.overallRating, 0) / performances.length
    : 0;

  const latestPerformance = performances.length > 0 ? performances[0] : null;

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Performance</h1>
        <p className="text-gray-600 mt-2">Track your progress and achievements</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{performances.length}</div>
            <p className="text-xs text-gray-500 mt-1">Performance evaluations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Average Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getRatingColor(averageRating)}`}>
              {averageRating > 0 ? averageRating.toFixed(1) : '-'}/10
            </div>
            <p className="text-xs text-gray-500 mt-1">Overall performance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Latest Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getRatingColor(latestPerformance?.overallRating || 0)}`}>
              {latestPerformance ? `${latestPerformance.overallRating}/10` : '-'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Most recent evaluation</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Trend */}
      {performances.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Performance Trend</CardTitle>
            <CardDescription>Your ratings over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-around gap-2">
              {performances.slice(0, 10).reverse().map((perf, index) => (
                <div key={perf.id} className="flex-1 flex flex-col items-center">
                  <div
                    className={`w-full rounded-t transition-all ${
                      perf.overallRating >= 8 ? 'bg-green-500' :
                      perf.overallRating >= 6 ? 'bg-blue-500' :
                      perf.overallRating >= 4 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ height: `${(perf.overallRating / 10) * 100}%` }}
                  />
                  <p className="text-xs text-gray-600 mt-2">{perf.overallRating}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Records */}
      <Card>
        <CardHeader>
          <CardTitle>Performance History</CardTitle>
          <CardDescription>Detailed records of your evaluations</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading performance data...</div>
          ) : performances.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 mb-2">No performance records yet</p>
              <p className="text-sm text-gray-400">Your coach will record your performance after games and training</p>
            </div>
          ) : (
            <div className="space-y-4">
              {performances.map(record => (
                <div key={record.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-lg">{record.eventName}</h4>
                        <Badge variant="secondary">{record.sport}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(record.recordedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge className={getRatingBadgeColor(record.overallRating)}>
                        <Trophy className="h-3 w-3 mr-1" />
                        {record.overallRating}/10
                      </Badge>
                    </div>
                  </div>

                  {Object.keys(record.metrics).length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                      {record.metrics.points !== undefined && (
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-xs text-gray-600">Points</p>
                          <p className="font-semibold text-lg">{record.metrics.points}</p>
                        </div>
                      )}
                      {record.metrics.assists !== undefined && (
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-xs text-gray-600">Assists</p>
                          <p className="font-semibold text-lg">{record.metrics.assists}</p>
                        </div>
                      )}
                      {record.metrics.rebounds !== undefined && (
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-xs text-gray-600">Rebounds</p>
                          <p className="font-semibold text-lg">{record.metrics.rebounds}</p>
                        </div>
                      )}
                      {record.metrics.time && (
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-xs text-gray-600">Time</p>
                          <p className="font-semibold text-lg">{record.metrics.time}</p>
                        </div>
                      )}
                      {record.metrics.distance && (
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-xs text-gray-600">Distance</p>
                          <p className="font-semibold text-lg">{record.metrics.distance}</p>
                        </div>
                      )}
                      {record.metrics.height && (
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-xs text-gray-600">Height</p>
                          <p className="font-semibold text-lg">{record.metrics.height}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {record.coachNotes && (
                    <div className="bg-blue-50 rounded p-3">
                      <p className="text-xs font-medium text-blue-900 mb-1">Coach Feedback</p>
                      <p className="text-sm text-blue-800">{record.coachNotes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
