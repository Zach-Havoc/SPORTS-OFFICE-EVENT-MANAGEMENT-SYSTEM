import { useEffect, useState } from 'react';
import { getLeaderboard, startWarmup } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Trophy, Medal, Award } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
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
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Departmental Leaderboard</h1>
            <Badge className="bg-red-500 text-white animate-pulse">
              ● Live
            </Badge>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Top 3 Podium */}
      {leaderboard.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 mb-8 max-w-3xl mx-auto">
          {/* 2nd Place */}
          <div className="flex flex-col items-center pt-12">
            <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mb-2">
              <Medal className="h-8 w-8 text-gray-700" />
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-700">2</div>
              <div className="font-semibold text-sm">{leaderboard[1].department}</div>
              <div className="text-xl font-bold text-blue-600 mt-1">{Math.round(leaderboard[1].totalPoints)}</div>
              <div className="text-xs text-gray-500">points</div>
            </div>
          </div>

          {/* 1st Place */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center mb-2 animate-pulse">
              <Trophy className="h-10 w-10 text-yellow-900" />
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">1</div>
              <div className="font-bold text-base">{leaderboard[0].department}</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">{Math.round(leaderboard[0].totalPoints)}</div>
              <div className="text-xs text-gray-500">points</div>
            </div>
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center pt-16">
            <div className="w-14 h-14 bg-orange-300 rounded-full flex items-center justify-center mb-2">
              <Award className="h-7 w-7 text-orange-900" />
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-orange-700">3</div>
              <div className="font-semibold text-xs">{leaderboard[2].department}</div>
              <div className="text-lg font-bold text-blue-600 mt-1">{Math.round(leaderboard[2].totalPoints)}</div>
              <div className="text-xs text-gray-500">points</div>
            </div>
          </div>
        </div>
      )}

      {/* Full Leaderboard Table */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Rankings</CardTitle>
          <CardDescription>Overall departmental performance across all events</CardDescription>
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
                        index < 3 ? 'bg-blue-50' : ''
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
