import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { FormError } from '../ui/form-error';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import {
  getStandingsRules,
  updateStandingsRules,
  type MedalPoints,
  type StandingsMethod,
  type StandingsRules,
} from '../../services/api';

const MEDALS: { key: keyof MedalPoints; label: string }[] = [
  { key: 'gold', label: 'Gold' },
  { key: 'silver', label: 'Silver' },
  { key: 'bronze', label: 'Bronze' },
];

/**
 * Settings → Standings: how the college standings (the Rankings page, the
 * standings board and the reports) are ranked.
 */
export default function StandingsRulesCard() {
  const queryClient = useQueryClient();
  const [rules, setRules] = useState<StandingsRules | null>(null);
  const [method, setMethod] = useState<StandingsMethod>('points');
  const [custom, setCustom] = useState<MedalPoints>({ gold: 10, silver: 7, bronze: 5 });
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    getStandingsRules()
      .then((r) => {
        setRules(r);
        setMethod(r.method);
        setCustom(r.customPoints);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load the ranking rules.'));
  }, []);

  const defaults = rules?.defaultPoints ?? { gold: 10, silver: 7, bronze: 5 };
  const customError =
    method !== 'custom'
      ? ''
      : [custom.gold, custom.silver, custom.bronze].some((v) => !Number.isInteger(v) || v < 0)
        ? 'Points must be whole numbers, 0 or more.'
        : custom.silver > custom.gold
          ? "Silver can't be worth more than gold."
          : custom.bronze > custom.silver
            ? "Bronze can't be worth more than silver."
            : '';
  const unchanged =
    rules !== null &&
    method === rules.method &&
    (method !== 'custom' || MEDALS.every(({ key }) => custom[key] === rules.customPoints[key]));

  const save = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const r = await updateStandingsRules(method, custom);
      setRules(r);
      setCustom(r.customPoints);
      await queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      toast.success('Standings ranking updated');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save the ranking rules.');
    } finally {
      setSaving(false);
    }
  };

  const options: { value: StandingsMethod; title: string; body: string }[] = [
    {
      value: 'olympic',
      title: 'Olympic medal ranking',
      body: 'Most golds first, then silvers, then bronzes. No points column.',
    },
    {
      value: 'points',
      title: 'Points-based ranking',
      body: `Gold ${defaults.gold}, Silver ${defaults.silver}, Bronze ${defaults.bronze}. Ranked by points; ties go to the college with more golds.`,
    },
    {
      value: 'custom',
      title: 'Custom university scoring',
      body: "Set the university's own points for each medal. Ranked by points; ties go to more golds.",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-brand-text" />
          Standings ranking
        </CardTitle>
        <p className="text-sm text-text-secondary mt-1">
          How colleges are ranked on the Rankings page, the standings board and the exported reports. A college wins
          a medal when it finishes a sport's bracket in the top three.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadError ? (
          <p className="text-sm text-danger-text">{loadError}</p>
        ) : !rules ? (
          <p className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : (
          <>
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as StandingsMethod)} className="gap-2">
              {options.map((o) => (
                <Label
                  key={o.value}
                  htmlFor={`standings-${o.value}`}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 font-normal ${
                    method === o.value ? 'border-border-strong bg-surface-active' : 'border-border'
                  }`}
                >
                  <RadioGroupItem id={`standings-${o.value}`} value={o.value} className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium text-text">{o.title}</span>
                    <span className="block text-sm text-text-secondary">{o.body}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>

            {method === 'custom' && (
              <div className="space-y-2">
                <div className="grid max-w-md grid-cols-3 gap-3">
                  {MEDALS.map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <Label htmlFor={`points-${key}`}>{label}</Label>
                      <Input
                        id={`points-${key}`}
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={Number.isNaN(custom[key]) ? '' : custom[key]}
                        onChange={(e) => setCustom((c) => ({ ...c, [key]: e.target.valueAsNumber }))}
                      />
                    </div>
                  ))}
                </div>
                {customError && <p className="text-sm text-danger-text">{customError}</p>}
              </div>
            )}

            <FormError message={saveError} />
            <Button onClick={save} disabled={saving || unchanged || !!customError}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
