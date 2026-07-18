import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getEvents } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Calendar, Users, ArrowRight } from 'lucide-react';

interface Event {
  id: string;
  name: string;
  category: string;
  schedule: string;
  status: string;
  departments: string[];
}

export default function JudgeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'judge') {
      navigate('/login');
      return;
    }
    loadEvents();
  }, [user, navigate]);

  const loadEvents = async () => {
    try {
      const data = await getEvents();

      // Normalize events to ensure all required fields exist
      const normalizedEvents = (data || []).map((e: any) => ({
        ...e,
        departments: e.departments || [],
        criteria: e.criteria || []
      }));

      // Filter to show only ongoing events for judges
      setEvents(normalizedEvents.filter((e: Event) => e.status === 'ongoing'));
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Judge Panel</h1>
        <p className="text-gray-500 mt-1">Welcome, {user?.name}. Select an event to start scoring.</p>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No ongoing events available for scoring at the moment
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map(event => (
            <Card key={event.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Badge className="bg-green-500 w-fit mb-2">Ongoing</Badge>
                <CardTitle className="text-xl">{event.name}</CardTitle>
                <CardDescription>{event.category}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    {new Date(event.schedule).toLocaleDateString()}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="h-4 w-4 mr-2" />
                    {(event.departments || []).length} departments
                  </div>

                  <Link to={`/judge/event/${event.id}`} className="block mt-4">
                    <Button className="w-full">
                      Start Scoring
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
