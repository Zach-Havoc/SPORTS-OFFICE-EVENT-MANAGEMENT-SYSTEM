import { useEffect, useState } from 'react';
import { getLeaderboard, startWarmup } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Trophy, Medal, Award } from 'lucide-react';
import Loading from '../../components/Loading';

interface LeaderboardEntry {
  department: string;
  totalPoints: number;
  eventsParticipated: number;
  rank: number;
  gold: number;
  silver: number;
  bronze: number;
}

export default function PublicLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    loadLeaderboard();

    // Set up polling for live updates every 30 seconds
    const interval = setInterval(() => {
      console.log('Polling for leaderboard updates...');
      loadLeaderboard();
    }, 30000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, []);

  const loadLeaderboard = async () => {
    try {
      await startWarmup();
      const raw: any[] = await getLeaderboard();
      // API returns `total` and `event_count`; map to the expected shape
      const data = raw.map((entry, idx) => ({
        department: entry.department,
        totalPoints: Number(entry.total ?? entry.totalPoints ?? 0),
        eventsParticipated: entry.event_count ?? entry.eventsParticipated ?? 0,
        rank: idx + 1,
        gold: entry.gold ?? 0,
        silver: entry.silver ?? 0,
        bronze: entry.bronze ?? 0,
      }));
      setLeaderboard(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Loading fullScreen={false} message="Loading leaderboard..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Departmental Leaderboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Rankings</CardTitle>
          <CardDescription>Departmental performance across all events</CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No data available yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Rank</th>
                    <th className="text-left py-3 px-4 font-semibold">Department</th>
                    <th className="text-center py-3 px-4 font-semibold hidden sm:table-cell">
                      <Trophy className="h-4 w-4 inline text-yellow-500" />
                    </th>
                    <th className="text-center py-3 px-4 font-semibold hidden sm:table-cell">
                      <Medal className="h-4 w-4 inline text-gray-400" />
                    </th>
                    <th className="text-center py-3 px-4 font-semibold hidden sm:table-cell">
                      <Award className="h-4 w-4 inline text-orange-400" />
                    </th>
                    <th className="text-right py-3 px-4 font-semibold">Total Points</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, index) => (
                    <tr
                      key={entry.department}
                      className={`border-b hover:bg-gray-50 ${
                        index === 0 ? 'bg-yellow-50' :
                        index === 1 ? 'bg-gray-50' :
                        index === 2 ? 'bg-orange-50' :
                        ''
                      }`}
                    >
                      <td className="py-4 px-4">
                        <span className={`font-bold ${
                          entry.rank === 1 ? 'text-yellow-600' :
                          entry.rank === 2 ? 'text-gray-600' :
                          entry.rank === 3 ? 'text-orange-600' :
                          'text-gray-900'
                        }`}>
                          {entry.rank}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-medium">{entry.department}</td>
                      <td className="py-4 px-4 text-center hidden sm:table-cell">{entry.gold}</td>
                      <td className="py-4 px-4 text-center hidden sm:table-cell">{entry.silver}</td>
                      <td className="py-4 px-4 text-center hidden sm:table-cell">{entry.bronze}</td>
                      <td className="py-4 px-4 text-right font-bold text-blue-600 text-lg">
                        {Math.round(entry.totalPoints)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
