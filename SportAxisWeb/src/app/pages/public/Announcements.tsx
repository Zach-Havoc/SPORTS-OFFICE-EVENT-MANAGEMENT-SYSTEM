import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Megaphone, Search, Calendar, User, UserPlus, Mail, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getAnnouncements, applyForTryout, verifyTryoutEmail, getDepartments } from '../../services/api';

interface Announcement {
  id: string;
  title: string;
  content: string;
  sport: string;
  coachId: string;
  coachName: string;
  isTryout: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Department {
  id: string;
  name: string;
  abbreviation: string;
}

export default function PublicAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [step, setStep] = useState<'form' | 'verify' | 'success'>('form');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    studentId: '',
    department: '',
    phone: '',
    yearLevel: '1st Year',
    verificationCode: ''
  });

  useEffect(() => {
    loadAnnouncements();
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const data = await getDepartments();
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await getAnnouncements();
      // Sort by date, newest first
      const sorted = data.sort((a: Announcement, b: Announcement) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setAnnouncements(sorted);
    } catch (error) {
      console.error('Error loading announcements:', error);
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleApplyClick = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setStep('form');
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      studentId: '',
      department: '',
      phone: '',
      yearLevel: '1st Year',
      verificationCode: ''
    });
    setDialogOpen(true);
  };

  const handleSendVerification = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email format
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim());
    if (!isValidEmail) {
      toast.error('Please enter a valid email address');
      return;
    }

    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.studentId || !formData.department || !formData.phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const res: any = await verifyTryoutEmail(formData.email);
      if (res?.dev_code) {
        toast.success(`Verification code: ${res.dev_code} (Code sent to your email/log)`);
      } else {
        toast.success('Verification code sent to your email!');
      }
      setStep('verify');
    } catch (error: any) {
      console.error('Error sending verification:', error);
      toast.error(error.message || 'Failed to send verification code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.verificationCode) {
      toast.error('Please enter the verification code');
      return;
    }

    if (!selectedAnnouncement) return;

    try {
      setSubmitting(true);
      await applyForTryout({
        announcementId: selectedAnnouncement.id,
        sport: selectedAnnouncement.sport,
        coachId: selectedAnnouncement.coachId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        studentId: formData.studentId,
        department: formData.department,
        phone: formData.phone,
        yearLevel: formData.yearLevel,
        verificationCode: formData.verificationCode
      });
      setStep('success');
    } catch (error: any) {
      console.error('Error submitting application:', error);
      toast.error(error.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setStep('form');
      setSelectedAnnouncement(null);
    }
  };

  const getUniqueSports = () => {
    const sports = announcements
      .map(a => a.sport)
      .filter(Boolean)
      .filter((value, index, self) => self.indexOf(value) === index);
    return ['all', ...sports];
  };

  const filteredAnnouncements = announcements.filter(announcement => {
    const matchesSearch =
      announcement.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      announcement.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      announcement.sport.toLowerCase().includes(searchQuery.toLowerCase()) ||
      announcement.coachName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSport = sportFilter === 'all' || announcement.sport === sportFilter;

    return matchesSearch && matchesSport;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Megaphone className="h-8 w-8 text-red-600" />
          <h1 className="text-3xl font-bold text-gray-900">Announcements</h1>
        </div>
        <p className="text-gray-600">Stay updated with the latest tryouts, events, and sports news</p>
      </div>

      {/* Search and Filter */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search announcements..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-64">
              <Select value={sportFilter} onValueChange={setSportFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by sport" />
                </SelectTrigger>
                <SelectContent>
                  {getUniqueSports().map(sport => (
                    <SelectItem key={sport} value={sport}>
                      {sport === 'all' ? 'All Sports' : sport}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Announcements List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              Loading announcements...
            </CardContent>
          </Card>
        ) : filteredAnnouncements.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Megaphone className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 mb-2">
                {searchQuery || sportFilter !== 'all'
                  ? 'No announcements match your filters'
                  : 'No announcements yet'}
              </p>
              <p className="text-sm text-gray-400">
                {searchQuery || sportFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Check back later for updates from coaches'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAnnouncements.map((announcement) => (
            <Card key={announcement.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl">{announcement.title}</CardTitle>
                      {announcement.sport && (
                        <Badge variant="secondary">{announcement.sport}</Badge>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Coach {announcement.coachName}
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {formatDate(announcement.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{announcement.content}</p>
                {announcement.isTryout && (
                  <div className="mt-4 pt-4 border-t">
                    <Button onClick={() => handleApplyClick(announcement)} className="w-full sm:w-auto">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Apply for Tryout
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Tryout Application Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {step === 'form' ? 'Apply for Tryout' : step === 'verify' ? 'Email Verification' : 'Application Successful'}
            </DialogTitle>
            <DialogDescription>
              {step === 'form'
                ? `Fill in your information to apply for ${selectedAnnouncement?.sport || 'this tryout'}`
                : step === 'verify'
                  ? 'Enter the verification code sent to your email'
                  : 'Your application has been received'}
            </DialogDescription>
          </DialogHeader>

          {step === 'form' ? (
            <form onSubmit={handleSendVerification} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="studentId">Student ID *</Label>
                  <Input
                    id="studentId"
                    placeholder="2024-00001"
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="yearLevel">Year Level *</Label>
                  <select
                    id="yearLevel"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.yearLevel}
                    onChange={(e) => setFormData({ ...formData, yearLevel: e.target.value })}
                    required
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department *</Label>
                  <select
                    id="department"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    required
                  >
                    <option value="" disabled>Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id || dept.name} value={dept.name}>
                        {dept.name} {dept.abbreviation ? `(${dept.abbreviation})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+63 912 345 6789"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">University Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="23-75760@g.batstate-u.edu.ph"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Use your BatStateU email address. A verification code will be sent.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  <Mail className="h-4 w-4 mr-2" />
                  {submitting ? 'Sending...' : 'Send Verification Code'}
                </Button>
              </DialogFooter>
            </form>
          ) : step === 'verify' ? (
            <form onSubmit={handleSubmitApplication} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Verification Code Sent</p>
                    <p className="text-sm text-blue-700 mt-1">
                      We've sent a 6-digit verification code to <strong>{formData.email}</strong>.
                      Please check your inbox and enter the code below.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="verificationCode">Verification Code *</Label>
                <Input
                  id="verificationCode"
                  placeholder="Enter 6-digit code"
                  value={formData.verificationCode}
                  onChange={(e) => setFormData({ ...formData, verificationCode: e.target.value })}
                  maxLength={6}
                  required
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setStep('form')}>
                  Back
                </Button>
                <Button type="submit" disabled={submitting}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Application Submitted!</h2>
              <p className="text-gray-600 max-w-md mx-auto">
                Your application for the tryout was completely successful. Please wait for an email containing the next steps, or check back for further announcements.
              </p>
              <div className="pt-6">
                <Button onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">
                  Close Window
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
