import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Swords } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAthletes,
  useCategories,
  useCoachProfile,
  useDisciplineEntries,
  useAssignDisciplineEntry,
  useRemoveDisciplineEntry,
} from '../../hooks/api';
import type { DisciplineEntry } from '../../services/api';
import Loading from '../../components/Loading';

const NONE = '__none__';

interface LineDef {
  category: string;   // full discipline name, e.g. "Badminton — M Singles A"
  label: string;      // "Singles A" | "Singles B" | "Doubles"
  slot: 'A' | 'B' | 'CD';
}

function athleteName(a: any): string {
  return [a.firstName, a.lastName].filter(Boolean).join(' ').trim() || a.email || 'Unnamed';
}

export default function CoachLineup() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role !== 'coach') navigate('/login');
  }, [user, navigate]);

  const profile = useCoachProfile();
  const categoriesQ = useCategories();
  const athletesQ = useAthletes();

  const categories = (categoriesQ.data ?? []) as Array<{ name: string; parentSport?: string; division?: string }>;
  const athletes = (athletesQ.data ?? []) as any[];

  // Racquet sports this coach runs = their sports that also exist as a parent sport.
  const coachSports: string[] = profile.data?.sports ?? [];
  const racquetSports = useMemo(() => {
    const parents = new Set(categories.map((c) => c.parentSport).filter(Boolean) as string[]);
    return [...parents].filter((s) => coachSports.includes(s)).sort();
  }, [categories, coachSports]);

  const [sport, setSport] = useState<string>('');
  const [gender, setGender] = useState<'M' | 'W'>('M');

  useEffect(() => {
    if (!sport && racquetSports.length) setSport(racquetSports[0]);
  }, [racquetSports, sport]);

  useEffect(() => {
    const g = profile.data?.genderCategory;
    if (g === 'Women') setGender('W');
    else if (g === 'Men') setGender('M');
  }, [profile.data?.genderCategory]);

  const lines: LineDef[] = useMemo(() => {
    if (!sport) return [];
    const mine = categories.filter((c) => c.parentSport === sport && (c.division ?? '').startsWith(gender));
    const order: Array<[LineDef['slot'], string]> = [['A', 'Singles A'], ['B', 'Singles B'], ['CD', 'Doubles']];
    return order
      .map(([slot, label]) => {
        const cat = mine.find((c) =>
          slot === 'CD' ? (c.division ?? '').includes('Doubles') : (c.division ?? '').endsWith(`Singles ${slot}`),
        );
        return cat ? { category: cat.name, label, slot } : null;
      })
      .filter((x): x is LineDef => !!x);
  }, [categories, sport, gender]);

  const entriesQ = useDisciplineEntries(
    { parentSport: sport || undefined, division: gender },
    { enabled: !!sport },
  );
  const byCategory = useMemo(() => {
    const m = new Map<string, DisciplineEntry[]>();
    for (const e of (entriesQ.data ?? [])) {
      m.set(e.category, [...(m.get(e.category) ?? []), e]);
    }
    return m;
  }, [entriesQ.data]);

  const assignMut = useAssignDisciplineEntry();
  const removeMut = useRemoveDisciplineEntry();

  const pick = (category: string, athleteId: string, pairSlot?: 'C' | 'D') => {
    if (athleteId === NONE) {
      const existing = (byCategory.get(category) ?? []).find((e) => (pairSlot ? e.pairSlot === pairSlot : true));
      if (existing) {
        removeMut.mutate(existing.id, {
          onSuccess: () => toast.success('Slot cleared'),
          onError: (e: any) => toast.error(e?.message || 'Could not clear the slot'),
        });
      }
      return;
    }
    assignMut.mutate(
      { category, athleteId, pairSlot },
      {
        onSuccess: () => toast.success('Line-up updated'),
        onError: (e: any) => toast.error(e?.message || 'Could not save'),
      },
    );
  };

  if (!user) return null;
  if (profile.isLoading || categoriesQ.isLoading) {
    return <div className="page-container px-4 py-8"><Loading fullScreen={false} message="Loading line-up..." /></div>;
  }

  const slotValue = (category: string, pairSlot?: 'C' | 'D') =>
    (byCategory.get(category) ?? []).find((e) => (pairSlot ? e.pairSlot === pairSlot : true))?.athleteId ?? NONE;

  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-6">
        <h1 className="t-page-title flex items-center gap-2">
          <Swords className="h-6 w-6 text-red-700" />
          Racquet Line-up
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Assign your athletes to each line. Singles A and B play their own brackets; C and D play the doubles bracket.
        </p>
      </header>

      {racquetSports.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-gray-500">
            You don't coach a racquet sport (Badminton, Table Tennis). Nothing to set up here.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-3">
            <div className="min-w-[180px]">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Sport</label>
              <Select value={sport} onValueChange={setSport}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {racquetSports.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[140px]">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Division</label>
              <Select value={gender} onValueChange={(v) => setGender(v as 'M' | 'W')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Men</SelectItem>
                  <SelectItem value="W">Women</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            {lines.map((line) => (
              <Card key={line.category}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {line.label}
                    <Badge variant="outline" className="text-[11px] font-normal text-gray-500">{line.category}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {line.slot === 'CD' ? 'Two athletes form the doubles pair.' : 'One athlete represents your college on this line.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {line.slot === 'CD' ? (
                    (['C', 'D'] as const).map((ps) => (
                      <div key={ps}>
                        <label className="mb-1 block text-xs font-medium text-gray-500">Player {ps}</label>
                        <Select value={slotValue(line.category, ps)} onValueChange={(v) => pick(line.category, v, ps)}>
                          <SelectTrigger className="max-w-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>— Unassigned —</SelectItem>
                            {athletes.map((a) => (
                              <SelectItem key={a.id} value={a.id}>{athleteName(a)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))
                  ) : (
                    <Select value={slotValue(line.category)} onValueChange={(v) => pick(line.category, v)}>
                      <SelectTrigger className="max-w-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— Unassigned —</SelectItem>
                        {athletes.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{athleteName(a)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </CardContent>
              </Card>
            ))}
            {lines.length === 0 && (
              <Card><CardContent className="py-8 text-center text-sm text-gray-500">No lines found for this division.</CardContent></Card>
            )}
          </div>

          {athletes.length === 0 && (
            <p className="mt-4 text-sm text-amber-600">
              Add athletes to your roster first. They appear in these dropdowns once you do.
            </p>
          )}
        </>
      )}
    </div>
  );
}
