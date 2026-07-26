import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getEvents, getDepartments, getCategories, createEvent, updateEvent, deleteEvent } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Calendar, Edit, Plus, Trash2, Users, QrCode, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '../../components/ui/checkbox';
import { QRCodeModal } from '../../components/QRCodeModal';
import { PrintableScoreSheetModal } from '../../components/admin/PrintableScoreSheetModal';
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
  criteria: Array<{ name: string; weight: number; max_score?: number }>;
  qrToken?: string;
}

export default function AdminEvents() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedEventForQR, setSelectedEventForQR] = useState<Event | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedEventForPrint, setSelectedEventForPrint] = useState<Event | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    schedule: '',
    startTime: '',
    endTime: '',
    status: 'upcoming' as 'upcoming' | 'ongoing' | 'completed',
    departments: [] as string[],
    criteria: [{ name: '', weight: 0 }]
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    
    // Debug: Check session token
    const sessionToken = localStorage.getItem('sessionToken');
    console.log('Events page - Session token exists:', !!sessionToken);
    console.log('Events page - Session token:', sessionToken);
    
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    try {
      const [eventsData, deptData, catData] = await Promise.all([
        getEvents(),
        getDepartments(),
        getCategories()
      ]);

      // Normalize events to ensure all required fields exist
      const normalizedEvents = (eventsData || []).map((event: any) => ({
        ...event,
        departments: event.departments || [],
        criteria: event.criteria || []
      }));

      setEvents(normalizedEvents);
      setDepartments(deptData);
      
      // Deduplicate categories by name and log for debugging
      console.log('Raw categories from API:', catData);
      const uniqueCategories = catData.reduce((acc: any[], cat: any) => {
        if (!acc.find(c => c.name === cat.name)) {
          acc.push(cat);
        }
        return acc;
      }, []);
      console.log('Deduplicated categories:', uniqueCategories);
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (event?: Event) => {
    if (event) {
      setEditingEvent(event);
      setFormData({
        name: event.name,
        category: event.category,
        schedule: event.schedule.split('T')[0],
        startTime: event.startTime || '',
        endTime: event.endTime || '',
        status: event.status,
        departments: event.departments || [],
        criteria: (event.criteria || []).length > 0 ? event.criteria : [{ name: '', weight: 0 }]
      });
    } else {
      setEditingEvent(null);
      setFormData({
        name: '',
        category: '',
        schedule: '',
        startTime: '',
        endTime: '',
        status: 'upcoming',
        departments: [],
        criteria: [{ name: '', weight: 0 }]
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.category || !formData.schedule || formData.departments.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const eventData = {
        ...formData,
        criteria: formData.criteria.filter(c => c.name && c.weight > 0)
      };

      if (editingEvent) {
        await updateEvent(editingEvent.id, eventData);
        toast.success('Event updated successfully');
      } else {
        await createEvent(eventData);
        toast.success('Event created successfully');
      }

      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving event:', error);
      
      // Check if it's an authentication error
      if (error.message && error.message.includes('session has expired')) {
        toast.error('Your session has expired. Redirecting to login...');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        toast.error(error.message || 'Failed to save event');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      await deleteEvent(id);
      toast.success('Event deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  const toggleDepartment = (deptName: string) => {
    setFormData(prev => ({
      ...prev,
      departments: prev.departments.includes(deptName)
        ? prev.departments.filter(d => d !== deptName)
        : [...prev.departments, deptName]
    }));
  };

  const SPORT_CRITERIA_PRESETS: Record<string, Array<{ name: string; weight: number; max_score: number }>> = {
    Basketball: [
      { name: 'Technical Execution & Shooting', weight: 30, max_score: 30 },
      { name: 'Offense & Defense Strategy',     weight: 30, max_score: 30 },
      { name: 'Teamwork & Ball Movement',        weight: 25, max_score: 25 },
      { name: 'Sportsmanship & Discipline',      weight: 15, max_score: 15 },
    ],
    Volleyball: [
      { name: 'Attacking & Spiking',             weight: 30, max_score: 30 },
      { name: 'Defense & Reception',             weight: 30, max_score: 30 },
      { name: 'Setting & Team Coordination',     weight: 25, max_score: 25 },
      { name: 'Serving & Court Movement',        weight: 15, max_score: 15 },
    ],
    Badminton: [
      { name: 'Stroke & Shot Precision',         weight: 35, max_score: 35 },
      { name: 'Footwork & Court Coverage',       weight: 30, max_score: 30 },
      { name: 'Tactical Awareness & Agility',    weight: 25, max_score: 25 },
      { name: 'Sportsmanship',                   weight: 10, max_score: 10 },
    ],
    Football: [
      { name: 'Ball Control & Passing',          weight: 30, max_score: 30 },
      { name: 'Offensive & Defensive Execution', weight: 30, max_score: 30 },
      { name: 'Physical Fitness & Movement',     weight: 25, max_score: 25 },
      { name: 'Tactical Discipline & Teamwork',  weight: 15, max_score: 15 },
    ],
    'Track & Field': [
      { name: 'Time / Distance Performance',     weight: 50, max_score: 50 },
      { name: 'Technique & Form',                weight: 30, max_score: 30 },
      { name: 'Pacing & Endurance',              weight: 20, max_score: 20 },
    ],
    Swimming: [
      { name: 'Stroke Technique & Efficiency',   weight: 40, max_score: 40 },
      { name: 'Turn & Start Execution',          weight: 30, max_score: 30 },
      { name: 'Speed & Endurance',               weight: 30, max_score: 30 },
    ],
    Tennis: [
      { name: 'Serve & Groundstrokes',           weight: 35, max_score: 35 },
      { name: 'Footwork & Positioning',          weight: 30, max_score: 30 },
      { name: 'Shot Selection & Strategy',       weight: 25, max_score: 25 },
      { name: 'Sportsmanship',                   weight: 10, max_score: 10 },
    ],
    'Table Tennis': [
      { name: 'Serve & Return Accuracy',         weight: 35, max_score: 35 },
      { name: 'Rally Control & Shot Selection',  weight: 35, max_score: 35 },
      { name: 'Speed & Reaction Time',           weight: 20, max_score: 20 },
      { name: 'Sportsmanship',                   weight: 10, max_score: 10 },
    ],
    Cultural: [
      { name: 'Choreography & Technique',        weight: 35, max_score: 35 },
      { name: 'Synchronization & Precision',     weight: 30, max_score: 30 },
      { name: 'Showmanship & Expression',        weight: 20, max_score: 20 },
      { name: 'Costume & Musicality',            weight: 15, max_score: 15 },
    ],
    Default: [
      { name: 'Technical Execution',             weight: 40, max_score: 40 },
      { name: 'Team Coordination & Strategy',    weight: 30, max_score: 30 },
      { name: 'Performance & Discipline',        weight: 20, max_score: 20 },
      { name: 'Sportsmanship',                   weight: 10, max_score: 10 },
    ],
  };

  const autoFillCriteria = (sportCategory?: string) => {
    const targetCategory = sportCategory || formData.category || 'Default';
    const preset = SPORT_CRITERIA_PRESETS[targetCategory] || SPORT_CRITERIA_PRESETS['Default'];
    setFormData(prev => ({
      ...prev,
      criteria: [...preset],
    }));
    toast.success(`Auto-filled criteria preset for ${targetCategory}`);
  };

  const addCriterion = () => {
    setFormData(prev => ({
      ...prev,
      criteria: [...prev.criteria, { name: '', weight: 0 }]
    }));
  };

  const removeCriterion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      criteria: prev.criteria.filter((_, i) => i !== index)
    }));
  };

  const updateCriterion = (index: number, field: 'name' | 'weight', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      criteria: prev.criteria.map((c, i) => 
        i === index ? { ...c, [field]: value } : c
      )
    }));
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const period = Number(hours) >= 12 ? 'PM' : 'AM';
    const formattedHours = Number(hours) % 12 || 12;
    return `${formattedHours}:${minutes} ${period}`;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Loading fullScreen={false} message="Loading events..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Events</h1>
          <p className="text-gray-500 mt-1">Create and manage competition events</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Create Event
        </Button>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {events.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No events yet. Create your first event!
            </CardContent>
          </Card>
        ) : (
          events.map(event => (
            <Card key={event.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={
                        event.status === 'ongoing' ? 'bg-green-500' :
                        event.status === 'upcoming' ? 'bg-blue-500' :
                        'bg-gray-500'
                      }>
                        {event.status}
                      </Badge>
                      <Badge variant="outline">{event.category}</Badge>
                    </div>
                    <CardTitle>{event.name}</CardTitle>
                    <CardDescription className="mt-2 space-y-1">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        {new Date(event.schedule).toLocaleDateString()}
                        {event.startTime && event.endTime && (
                          <span className="ml-2 text-blue-600">
                            • {formatTime(event.startTime)} - {formatTime(event.endTime)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        {(event.departments || []).length} departments
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleOpenDialog(event)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDelete(event.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      title="Print Score Sheet Template"
                      onClick={() => {
                        setSelectedEventForPrint(event);
                        setPrintModalOpen(true);
                      }}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      title="Show QR Code"
                      onClick={() => {
                        setSelectedEventForQR(event);
                        setQrModalOpen(true);
                      }}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold mb-1">Departments:</p>
                    <div className="flex flex-wrap gap-1">
                      {(event.departments || []).map(dept => (
                        <Badge key={dept} variant="secondary">{dept}</Badge>
                      ))}
                    </div>
                  </div>
                  {(event.criteria || []).length > 0 && (
                    <div>
                      <p className="text-sm font-semibold mb-1">Scoring Criteria:</p>
                      <div className="text-sm text-gray-600">
                        {(event.criteria || []).map((c, i) => (
                          <span key={i}>
                            {c.name} ({c.weight}%)
                            {i < (event.criteria || []).length - 1 && ', '}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Event' : 'Create New Event'}</DialogTitle>
            <DialogDescription>
              Fill in the event details and scoring criteria
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Event Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Dance Competition"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat, index) => (
                      <SelectItem key={cat.id || `cat-${cat.name}-${index}`} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v as any })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule">Schedule *</Label>
              <Input
                id="schedule"
                type="date"
                value={formData.schedule}
                onChange={e => setFormData({ ...formData, schedule: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                  placeholder="e.g., 07:00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                  placeholder="e.g., 08:00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Participating Departments *</Label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                {departments.map(dept => (
                  <div key={dept.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={dept.id}
                      checked={formData.departments.includes(dept.name)}
                      onCheckedChange={() => toggleDepartment(dept.name)}
                    />
                    <label htmlFor={dept.id} className="text-sm cursor-pointer">
                      {dept.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Scoring Criteria</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => autoFillCriteria()}>
                    ⚡ Auto-Fill Preset
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={addCriterion}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Criterion
                  </Button>
                </div>
              </div>
              {formData.criteria.map((criterion, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Criterion name"
                    value={criterion.name}
                    onChange={e => updateCriterion(index, 'name', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Weight %"
                    value={criterion.weight || ''}
                    onChange={e => updateCriterion(index, 'weight', Number(e.target.value))}
                    className="w-24"
                    min="0"
                    max="100"
                  />
                  {formData.criteria.length > 1 && (
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="outline"
                      onClick={() => removeCriterion(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingEvent ? 'Update' : 'Create'} Event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      {selectedEventForQR && selectedEventForQR.qrToken && (
        <QRCodeModal 
          open={qrModalOpen} 
          onOpenChange={setQrModalOpen} 
          eventId={selectedEventForQR.id}
          eventName={selectedEventForQR.name}
          qrToken={selectedEventForQR.qrToken}
        />
      )}

      {/* Printable Score Sheet Modal */}
      <PrintableScoreSheetModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        event={selectedEventForPrint}
      />
    </div>
  );
}