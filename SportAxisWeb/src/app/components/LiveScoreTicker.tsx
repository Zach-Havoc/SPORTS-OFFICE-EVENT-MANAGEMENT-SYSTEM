import { useEffect, useState } from 'react';
import { Trophy, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

interface ScoreUpdate {
  id: string;
  event: string;
  department: string;
  score: number;
  timestamp: number;
}

export function LiveScoreTicker() {
  const [updates, setUpdates] = useState<ScoreUpdate[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Simulated score updates - in production this would come from real-time subscriptions
    const mockUpdates: ScoreUpdate[] = [
      { id: '1', event: 'Dance Competition', department: 'Computer Science', score: 95, timestamp: Date.now() },
      { id: '2', event: 'Singing Contest', department: 'Engineering', score: 92, timestamp: Date.now() },
      { id: '3', event: 'Debate Competition', department: 'Business Admin', score: 89, timestamp: Date.now() },
    ];
    
    setUpdates(mockUpdates);
  }, []);

  useEffect(() => {
    if (updates.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % updates.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [updates.length]);

  if (updates.length === 0) return null;

  const currentUpdate = updates[currentIndex];

  return (
    <motion.div
      key={currentUpdate.id}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-gradient-to-r from-red-600 to-red-700 text-white py-3 px-4 rounded-lg shadow-lg"
    >
      <div className="flex items-center gap-3">
        <Trophy className="h-5 w-5 text-yellow-300 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">{currentUpdate.event}</p>
          <p className="text-xs opacity-90">{currentUpdate.department} scored {currentUpdate.score} points</p>
        </div>
        <TrendingUp className="h-4 w-4 text-green-300 flex-shrink-0" />
      </div>
    </motion.div>
  );
}
