import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';

interface Event {
  id: string;
  name: string;
  category: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  progress: number;
  judgesAssigned: number;
  date: string;
}

interface EventTableProps {
  events: Event[];
}

export default function EventTable({ events }: EventTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ongoing':
        return 'bg-green-500';
      case 'upcoming':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ongoing':
        return <Badge className="bg-green-100 text-green-800">Ongoing</Badge>;
      case 'upcoming':
        return <Badge className="bg-blue-100 text-blue-800">Upcoming</Badge>;
      case 'completed':
        return <Badge className="bg-gray-100 text-gray-800">Completed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Monitoring</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-sm">{event.name}</h3>
                  {getStatusBadge(event.status)}
                </div>
                <p className="text-xs text-gray-500 mb-2">{event.category}</p>
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <span>{event.date}</span>
                  <span>•</span>
                  <span>{event.judgesAssigned} judges assigned</span>
                </div>
              </div>
              <div className="w-32">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium">{event.progress}%</span>
                </div>
                <Progress value={event.progress} className="h-2" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
