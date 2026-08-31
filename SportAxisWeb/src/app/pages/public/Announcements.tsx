import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { RefreshStatus } from '../../components/RefreshStatus';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Megaphone, Search, Calendar, User, UserPlus, Mail, CheckCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { applyForTryout, verifyTryoutEmail } from '../../services/api';
import { useAnnouncements, useDepartments } from '../../hooks/api';

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
  const announcementsQuery = useAnnouncements();
  const departmentsQuery = useDepartments();

  const announcements = useMemo<Announcement[]>(
    () =>
      [...((announcementsQuery.data as Announcement[]) ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [announcementsQuery.data],
  );
  const departments: Department[] = departmentsQuery.data ?? [];
  const loading = announcementsQuery.isLoading;

  const [searchQuery, setSearchQuery] = useState('');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [step, setStep] = useState<'form' | 'verify' | 'success'>('form');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
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

  const deptByName = useMemo(
    () => new Map(departments.map((d) => [d.name, d])),
    [departments],
  );

  // ── Field validation ────────────────────────────────────────────────
  const STUDENT_ID_RE = /^\d{2}-\d{5}$/;                       // ##-#####
  const BATSTATEU_EMAIL_RE = /@([a-z0-9-]+\.)?batstate-u\.edu\.ph$/i; // ...@[sub.]batstate-u.edu.ph

  const validateForm = () => {
    const e: Record<string, string> = {};
    if (!formData.firstName.trim()) e.firstName = 'Required';
    if (!formData.lastName.trim()) e.lastName = 'Required';
    if (!STUDENT_ID_RE.test(formData.studentId.trim()))
      e.studentId = 'Use the format ##-##### (e.g. 00-00000)';
    if (!formData.department) e.department = 'Please select your department';
    if (formData.phone.replace(/\D/g, '').length !== 11)
      e.phone = 'Mobile number must be exactly 11 digits';
    if (!BATSTATEU_EMAIL_RE.test(formData.email.trim()))
      e.email = 'Use your BatStateU email (must end in @batstate-u.edu.ph)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const clearError = (field: string) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));

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
    setErrors({});
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

    if (!validateForm()) {
      toast.error('Please fix the highlighted fields');
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
      setErrors({});
    }
  };

  const getUniqueSports = () => {
    const sports = announcements
      .map(a => a.sport)
      .filter(Boolean)
      .filter((value, index, self) => self.indexOf(value) === index);
    return ['all', ...sports];
  };

  const hasActiveFilters = searchQuery.trim() !== '' || sportFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setSportFilter('all');
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <header className="mb-8 pb-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">Announcements</h1>
          <RefreshStatus
            fetching={announcementsQuery.isFetching && !announcementsQuery.isLoading}
            error={announcementsQuery.isRefetchError}
            onRetry={() => announcementsQuery.refetch()}
          />
        </div>
        <p className="text-gray-500 text-sm mt-1.5">
          Latest tryout calls and updates from coaching staff.
        </p>
      </header>

      {/* Search and Filter */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search — primary, grows to fill */}
          <div role="search" className="relative flex-1 min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by title, sport, or coach"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-9 pr-9"
              aria-label="Search announcements"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Secondary filter */}
          <Select value={sportFilter} onValueChange={setSportFilter}>
            <SelectTrigger className="h-10 w-full sm:w-48" aria-label="Filter by sport">
              <SelectValue placeholder="All sports" />
            </SelectTrigger>
            <SelectContent>
              {getUniqueSports().map(sport => (
                <SelectItem key={sport} value={sport}>
                  {sport === 'all' ? 'All sports' : sport}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Result count + clear */}
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">
            Showing <span className="font-medium text-gray-700">{filteredAnnouncements.length}</span> of {announcements.length} announcements
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              Loading announcements...
            </CardContent>
          </Card>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-700">
              {hasActiveFilters ? 'No announcements match your filters' : 'No announcements yet'}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {hasActiveFilters ? 'Try a different search term or sport.' : 'Check back later for updates from coaches.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <X className="h-4 w-4" />
                Clear filters
              </button>
            )}
          </div>
        ) : (
          filteredAnnouncements.map((announcement) => (
            <Card key={announcement.id} className="border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <CardTitle className="text-lg font-semibold">{announcement.title}</CardTitle>
                      {announcement.sport && (
                        <Badge variant="secondary" className="font-normal">{announcement.sport}</Badge>
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
                    aria-invalid={!!errors.firstName}
                    className={errors.firstName ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    onChange={(e) => {
                      setFormData({ ...formData, firstName: e.target.value });
                      clearError('firstName');
                    }}
                    required
                  />
                  {errors.firstName && <p className="text-xs text-red-600">{errors.firstName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    aria-invalid={!!errors.lastName}
                    className={errors.lastName ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    onChange={(e) => {
                      setFormData({ ...formData, lastName: e.target.value });
                      clearError('lastName');
                    }}
                    required
                  />
                  {errors.lastName && <p className="text-xs text-red-600">{errors.lastName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="studentId">Student ID *</Label>
                  <Input
                    id="studentId"
                    inputMode="numeric"
                    placeholder="00-00000"
                    value={formData.studentId}
                    aria-invalid={!!errors.studentId}
                    className={errors.studentId ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 7);
                      const val = digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits;
                      setFormData({ ...formData, studentId: val });
                      clearError('studentId');
                    }}
                    required
                  />
                  {errors.studentId && (
                    <p className="text-xs text-red-600">{errors.studentId}</p>
                  )}
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
                  <Select
                    value={formData.department || undefined}
                    onValueChange={(v) => {
                      setFormData({ ...formData, department: v });
                      clearError('department');
                    }}
                  >
                    {/* Trigger shows the abbreviation; the dropdown shows full names */}
                    <SelectTrigger
                      id="department"
                      aria-invalid={!!errors.department}
                      className={errors.department ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    >
                      {formData.department ? (
                        <span>
                          {deptByName.get(formData.department)?.abbreviation || formData.department}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Select Department</span>
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id || dept.name} value={dept.name}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.department && (
                    <p className="text-xs text-red-600">{errors.department}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="09123456789"
                    maxLength={11}
                    value={formData.phone}
                    aria-invalid={!!errors.phone}
                    className={errors.phone ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 11) });
                      clearError('phone');
                    }}
                    required
                  />
                  {errors.phone ? (
                    <p className="text-xs text-red-600">{errors.phone}</p>
                  ) : (
                    <p className="text-xs text-gray-500">11-digit mobile number, digits only.</p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">University Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="00-00000@g.batstate-u.edu.ph"
                    value={formData.email}
                    aria-invalid={!!errors.email}
                    className={errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      clearError('email');
                    }}
                    required
                  />
                  {errors.email ? (
                    <p className="text-xs text-red-600">{errors.email}</p>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Must be your BatStateU email (ending in <span className="font-medium">@batstate-u.edu.ph</span>). A verification code will be sent.
                    </p>
                  )}
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
