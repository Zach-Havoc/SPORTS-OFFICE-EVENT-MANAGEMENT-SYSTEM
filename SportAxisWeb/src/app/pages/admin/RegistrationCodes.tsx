import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getRegistrationCodes, createRegistrationCode, revokeRegistrationCode } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Plus, Copy, Trash2, CheckCircle2, XCircle, Clock, Shield, User } from 'lucide-react';
import { toast } from 'sonner';
import Loading from '../../components/Loading';

interface RegistrationCode {
  code: string;
  role: 'admin' | 'coach' | 'athlete' | 'judge';
  label: string;
  used: boolean;
  usedBy: string | null;
  usedAt: number | null;
  createdBy: string;
  createdAt: number;
  expiresAt: number | null;
}

export default function AdminRegistrationCodes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [codes, setCodes] = useState<RegistrationCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  const [formData, setFormData] = useState({
    role: 'judge' as 'admin' | 'coach' | 'athlete' | 'judge',
    label: '',
    expiresInDays: 0
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    loadCodes();
    const interval = setInterval(loadCodes, 30000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  const loadCodes = async () => {
    try {
      const data = await getRegistrationCodes();
      // Sort: active codes first, then by creation date
      const sorted = data.sort((a: RegistrationCode, b: RegistrationCode) => {
        if (a.used !== b.used) return a.used ? 1 : -1;
        return b.createdAt - a.createdAt;
      });
      setCodes(sorted);
    } catch (error) {
      console.error('Error loading registration codes:', error);
      toast.error('Failed to load registration codes');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const result = await createRegistrationCode({
        role: formData.role,
        label: formData.label || `${formData.role.charAt(0).toUpperCase() + formData.role.slice(1)} Registration Code`,
        expiresInDays: formData.expiresInDays > 0 ? formData.expiresInDays : undefined
      });

      toast.success(`Registration code generated: ${result.code.code}`);
      setDialogOpen(false);
      setFormData({ role: 'judge', label: '', expiresInDays: 0 });
      loadCodes();
    } catch (error: any) {
      console.error('Error generating code:', error);
      toast.error(error.message || 'Failed to generate code');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard!');
  };

  const handleRevoke = async (code: string) => {
    if (!confirm('Are you sure you want to revoke this registration code?')) return;

    try {
      await revokeRegistrationCode(code);
      toast.success('Registration code revoked');
      loadCodes();
    } catch (error: any) {
      console.error('Error revoking code:', error);
      toast.error(error.message || 'Failed to revoke code');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpired = (expiresAt: number | null) => {
    if (!expiresAt) return false;
    return expiresAt < Date.now();
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Loading fullScreen={false} message="Loading registration codes..." />
      </div>
    );
  }

  const activeCodes = codes.filter(c => !c.used && !isExpired(c.expiresAt));
  const usedCodes = codes.filter(c => c.used);
  const expiredCodes = codes.filter(c => !c.used && isExpired(c.expiresAt));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Registration Codes</h1>
          <p className="text-gray-500 mt-1">Generate and manage registration codes for all user roles</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Generate Code
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Active Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{activeCodes.length}</div>
            <p className="text-xs text-gray-500 mt-1">Ready to use</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Used Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{usedCodes.length}</div>
            <p className="text-xs text-gray-500 mt-1">Accounts created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Expired Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-600">{expiredCodes.length}</div>
            <p className="text-xs text-gray-500 mt-1">No longer valid</p>
          </CardContent>
        </Card>
      </div>

      {/* Security Notice */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">Security Note</p>
              <p className="text-sm text-blue-700 mt-1">
                Registration codes are required to create admin, coach, athlete, and judge accounts.
                Public viewers can access the system freely without creating accounts.
                Share codes securely and revoke them after use or if compromised.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Codes */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Active Codes
        </h2>
        {activeCodes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No active codes. Generate a new one to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {activeCodes.map(code => (
              <Card key={code.code}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <code className="text-2xl font-mono font-bold bg-gray-100 px-3 py-1 rounded">
                          {code.code}
                        </code>
                        <Badge variant={code.role === 'admin' ? 'default' : 'secondary'}>
                          {code.role === 'admin' && <><Shield className="h-3 w-3 mr-1" /> Admin</>}
                          {code.role === 'coach' && <><User className="h-3 w-3 mr-1" /> Coach</>}
                          {code.role === 'athlete' && <><User className="h-3 w-3 mr-1" /> Athlete</>}
                          {code.role === 'judge' && <><User className="h-3 w-3 mr-1" /> Judge</>}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{code.label}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Created by {code.createdBy}</span>
                        <span>•</span>
                        <span>{formatDate(code.createdAt)}</span>
                        {code.expiresAt && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Expires {formatDate(code.expiresAt)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleCopyCode(code.code)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleRevoke(code.code)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Used Codes */}
      {usedCodes.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <XCircle className="h-5 w-5 text-gray-600" />
            Used Codes
          </h2>
          <div className="space-y-4">
            {usedCodes.map(code => (
              <Card key={code.code} className="bg-gray-50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <code className="text-lg font-mono font-bold text-gray-500 px-3 py-1">
                          {code.code}
                        </code>
                        <Badge variant="outline">
                          {code.role === 'admin' && <><Shield className="h-3 w-3 mr-1" /> Admin</>}
                          {code.role === 'coach' && <><User className="h-3 w-3 mr-1" /> Coach</>}
                          {code.role === 'athlete' && <><User className="h-3 w-3 mr-1" /> Athlete</>}
                          {code.role === 'judge' && <><User className="h-3 w-3 mr-1" /> Judge</>}
                        </Badge>
                        <Badge variant="secondary">Used</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{code.label}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Used by {code.usedBy}</span>
                        <span>•</span>
                        <span>{code.usedAt && formatDate(code.usedAt)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Expired Codes */}
      {expiredCodes.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-red-600" />
            Expired Codes
          </h2>
          <div className="space-y-4">
            {expiredCodes.map(code => (
              <Card key={code.code} className="bg-red-50 border-red-200">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <code className="text-lg font-mono font-bold text-red-600 line-through px-3 py-1">
                          {code.code}
                        </code>
                        <Badge variant="outline" className="border-red-300 text-red-700">
                          {code.role === 'admin' && <><Shield className="h-3 w-3 mr-1" /> Admin</>}
                          {code.role === 'coach' && <><User className="h-3 w-3 mr-1" /> Coach</>}
                          {code.role === 'athlete' && <><User className="h-3 w-3 mr-1" /> Athlete</>}
                          {code.role === 'judge' && <><User className="h-3 w-3 mr-1" /> Judge</>}
                        </Badge>
                        <Badge className="bg-red-600">Expired</Badge>
                      </div>
                      <p className="text-sm text-red-700 mb-1">{code.label}</p>
                      <div className="flex items-center gap-4 text-xs text-red-600">
                        <span>Expired {code.expiresAt && formatDate(code.expiresAt)}</span>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleRevoke(code.code)}
                      className="border-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Generate Code Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Registration Code</DialogTitle>
            <DialogDescription>
              Create a new registration code for any user role
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select value={formData.role} onValueChange={(v: 'admin' | 'coach' | 'athlete' | 'judge') => setFormData({ ...formData, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="athlete">Athlete - View schedule & performance</SelectItem>
                  <SelectItem value="coach">Coach - Manage athletes & teams</SelectItem>
                  <SelectItem value="judge">Judge - Score events</SelectItem>
                  <SelectItem value="admin">Admin - Full system access</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Label (Optional)</Label>
              <Input
                id="label"
                value={formData.label}
                onChange={e => setFormData({ ...formData, label: e.target.value })}
                placeholder={`e.g., "John's Judge Access"`}
              />
              <p className="text-xs text-gray-500">
                A description to help you remember what this code is for
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiresInDays">Expires In (Days)</Label>
              <Input
                id="expiresInDays"
                type="number"
                min="0"
                value={formData.expiresInDays}
                onChange={e => setFormData({ ...formData, expiresInDays: Number(e.target.value) })}
                placeholder="0"
              />
              <p className="text-xs text-gray-500">
                Leave as 0 for codes that never expire
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={generating}>
                {generating ? 'Generating...' : 'Generate Code'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
