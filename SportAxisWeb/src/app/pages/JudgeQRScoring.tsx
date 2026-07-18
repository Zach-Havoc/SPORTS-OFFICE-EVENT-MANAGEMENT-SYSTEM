import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Calendar, Trophy, AlertCircle, CheckCircle2, QrCode } from 'lucide-react';
import { API_URL } from '../../config/api';

interface Event {
  id: string;
  name: string;
  category: string;
  schedule: string;
  startTime?: string;
  endTime?: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  departments: string[];
  criteria: Array<{ name: string; weight: number }>;
}

export default function JudgeQRScoring() {
  const { eventId, token } = useParams<{ eventId: string; token: string }>();
  const navigate = useNavigate();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    judgeName: '',
    department: '',
    scores: {} as Record<string, number>
  });

  useEffect(() => {
    validateTokenAndLoadEvent();
  }, [eventId, token]);

  const validateTokenAndLoadEvent = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use the Laravel API: GET /api/event/session/{qrToken}
      const response = await fetch(`${API_URL}/event/session/${token}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Invalid QR code or event not found');
      }

      const data = await response.json();
      // Laravel returns { event: {...}, criteria: [...] }
      const evt = data.event ?? data;
      const criteria: Array<{ name: string; weight: number }> =
        (data.criteria ?? evt.criteria ?? []).map((c: any) => ({
          name: c.name,
          weight: c.weight ?? 0,
        }));

      setEvent({ ...evt, criteria });

      // Initialize scores for each criterion
      const initialScores: Record<string, number> = {};
      criteria.forEach((c) => { initialScores[c.name] = 0; });
      setFormData(prev => ({ ...prev, scores: initialScores }));

    } catch (error: any) {
      console.error('Error validating QR token:', error);
      setError(error.message || 'Failed to load event. This QR code may be expired or invalid.');
      toast.error('This event no longer exists or the QR code is invalid.');
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (criterionName: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      scores: {
        ...prev.scores,
        [criterionName]: value
      }
    }));
  };

  const calculateTotalScore = () => {
    if (!event) return 0;
    
    let total = 0;
    event.criteria.forEach(criterion => {
      const score = formData.scores[criterion.name] || 0;
      const weightedScore = (score * criterion.weight) / 100;
      total += weightedScore;
    });
    
    return Math.round(total * 100) / 100;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.judgeName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    
    if (!formData.department) {
      toast.error('Please select a department');
      return;
    }
    
    // Validate all scores are entered
    const allScoresEntered = event?.criteria.every(c => 
      formData.scores[c.name] !== undefined && formData.scores[c.name] > 0
    );
    
    if (!allScoresEntered) {
      toast.error('Please enter scores for all criteria');
      return;
    }
    
    try {
      setSubmitting(true);

      const totalScore = calculateTotalScore();

      // Use the Laravel API: POST /api/scores
      const authToken = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          eventId,
          department: formData.department,
          judgeName: formData.judgeName,
          scores: formData.scores,
          totalScore,
          submittedViaQr: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to submit score');
      }

      toast.success('Score submitted successfully!');
      setSubmitted(true);

    } catch (error: any) {
      console.error('Error submitting score:', error);
      toast.error(error.message || 'Failed to submit score');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const period = Number(hours) >= 12 ? 'PM' : 'AM';
    const formattedHours = Number(hours) % 12 || 12;
    return `${formattedHours}:${minutes} ${period}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Validating QR Code...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-6 w-6" />
              <CardTitle>Invalid QR Code</CardTitle>
            </div>
            <CardDescription className="text-red-600">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              This QR code may be expired, invalid, or the event may no longer exist.
              Please contact the event administrator for assistance.
            </p>
            <Button onClick={() => navigate('/')} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-green-200">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              <CardTitle>Score Submitted!</CardTitle>
            </div>
            <CardDescription>
              Your score for {formData.department} has been recorded successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Score Summary:</p>
              <div className="space-y-1">
                {event?.criteria.map(criterion => (
                  <div key={criterion.name} className="flex justify-between text-sm">
                    <span>{criterion.name}:</span>
                    <span className="font-semibold">{formData.scores[criterion.name]}/100</span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                  <span>Total Score:</span>
                  <span className="text-green-600">{calculateTotalScore()}/100</span>
                </div>
              </div>
            </div>
            
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              View Public Rankings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 text-indigo-600 mb-2">
            <QrCode className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Judge Scoring</h1>
          </div>
          <p className="text-gray-600">Score via QR Code Access</p>
        </div>

        {/* Event Info Card */}
        <Card className="mb-6 border-indigo-200 bg-white/80 backdrop-blur">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2">{event.name}</CardTitle>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="outline" className="bg-indigo-50">
                    {event.category}
                  </Badge>
                  <Badge className={
                    event.status === 'ongoing' ? 'bg-green-500' :
                    event.status === 'upcoming' ? 'bg-blue-500' :
                    'bg-gray-500'
                  }>
                    {event.status}
                  </Badge>
                </div>
                <div className="flex items-center text-gray-600 text-sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  {new Date(event.schedule).toLocaleDateString()}
                  {event.startTime && event.endTime && (
                    <span className="ml-2">
                      • {formatTime(event.startTime)} - {formatTime(event.endTime)}
                    </span>
                  )}
                </div>
              </div>
              <Trophy className="h-8 w-8 text-amber-500" />
            </div>
          </CardHeader>
        </Card>

        {/* Scoring Form */}
        <Card className="bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle>Submit Your Score</CardTitle>
            <CardDescription>
              Enter your name, select the department, and score each criterion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Judge Name */}
              <div className="space-y-2">
                <Label htmlFor="judgeName">Your Name *</Label>
                <Input
                  id="judgeName"
                  value={formData.judgeName}
                  onChange={e => setFormData({ ...formData, judgeName: e.target.value })}
                  placeholder="Enter your full name"
                  required
                />
              </div>

              {/* Department Selection */}
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Select value={formData.department} onValueChange={v => setFormData({ ...formData, department: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department to score" />
                  </SelectTrigger>
                  <SelectContent>
                    {event.departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Scoring Criteria */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Scoring Criteria *</Label>
                {event.criteria.map((criterion, index) => (
                  <div key={index} className="space-y-2 p-4 bg-gray-50 rounded-lg border">
                    <div className="flex justify-between items-center mb-2">
                      <Label htmlFor={`score-${index}`} className="font-medium">
                        {criterion.name}
                      </Label>
                      <Badge variant="secondary">Weight: {criterion.weight}%</Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        id={`score-${index}`}
                        min="0"
                        max="100"
                        value={formData.scores[criterion.name] || 0}
                        onChange={e => handleScoreChange(criterion.name, Number(e.target.value))}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.scores[criterion.name] || 0}
                        onChange={e => handleScoreChange(criterion.name, Number(e.target.value))}
                        className="w-20"
                      />
                      <span className="text-sm text-gray-500">/ 100</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Score Display */}
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-800">Total Weighted Score:</span>
                  <span className="text-2xl font-bold text-indigo-600">{calculateTotalScore()}/100</span>
                </div>
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full h-12 text-lg"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Score'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>University Event Competition Scoring System</p>
          <p className="mt-1">Powered by QR Code Technology</p>
        </div>
      </div>
    </div>
  );
}