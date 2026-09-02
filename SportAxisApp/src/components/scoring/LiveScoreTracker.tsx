import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS, SPACING } from '../../../constants/theme';
import type { EventSession } from '../../types';
import { getSportConfigFromEvent } from '../../utils/sport-config';

// ─────────────────────────────────────────────────────────────────────────────
// LiveScoreTracker — Digital score sheet for real-time game tracking
// Mirrors the paper score sheet so facilitators can use the app instead
// ─────────────────────────────────────────────────────────────────────────────

interface LiveScoreTrackerProps {
  event: EventSession;
  /** When rendered inside its own tab, drop the collapsible section chrome. */
  embedded?: boolean;
}

export function LiveScoreTracker({ event, embedded = false }: LiveScoreTrackerProps) {
  const sportConfig = getSportConfigFromEvent(event.category, event.name);
  const accentColor = sportConfig.color;
  const depts       = event.departments ?? [];
  const teamA       = depts[0] ?? 'TEAM A';
  const teamB       = depts[1] ?? 'TEAM B';

  const [isExpanded, setIsExpanded] = useState(true);

  // Every sport resolves to a sheet — recognised sports get their purpose-built
  // scoreboard; anything else (cultural, chess, arnis, …) gets a generic
  // points sheet so the tab is never empty.
  const renderTracker = () => {
    switch (sportConfig.type) {
      case 'basketball':   return <BasketballTracker teamA={teamA} teamB={teamB} accentColor={accentColor} />;
      case 'volleyball':   return <VolleyballTracker teamA={teamA} teamB={teamB} accentColor={accentColor} />;
      case 'badminton':    return <BadmintonTracker  teamA={teamA} teamB={teamB} accentColor={accentColor} />;
      case 'football':     return <FootballTracker   teamA={teamA} teamB={teamB} accentColor={accentColor} />;
      case 'table-tennis': return <TableTennisTracker teamA={teamA} teamB={teamB} accentColor={accentColor} />;
      case 'tennis':       return <TennisTracker     teamA={teamA} teamB={teamB} accentColor={accentColor} />;
      case 'track-field':  return <TrackFieldTracker depts={depts} accentColor={accentColor} />;
      case 'swimming':     return <SwimmingTracker   depts={depts} accentColor={accentColor} />;
      default:             return <GenericTracker    depts={depts} accentColor={accentColor} />;
    }
  };

  const card = (
    <View style={[styles.trackerCard, { borderColor: `${accentColor}30` }]}>
      <View style={[styles.trackerBanner, { backgroundColor: accentColor }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={sportConfig.icon as any} size={16} color="#fff" />
          <Text style={styles.trackerBannerText}>{event.name.toUpperCase()}</Text>
        </View>
        <Text style={styles.trackerBannerSub}>{sportConfig.label} · App sheet · Not submitted</Text>
      </View>
      {renderTracker()}
    </View>
  );

  if (embedded) return card;

  return (
    <View style={styles.wrapper}>
      {/* ── Section header ─────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.sectionHeader, { borderColor: `${accentColor}40` }]}
        onPress={() => setIsExpanded(v => !v)}
        activeOpacity={0.75}
      >
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionDot, { backgroundColor: accentColor }]} />
          <Text style={styles.sectionTitle}>LIVE SCORE TRACKER</Text>
          <View style={[styles.sectionBadge, { backgroundColor: `${accentColor}15`, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
            <Ionicons name={sportConfig.icon as any} size={12} color={accentColor} />
            <Text style={[styles.sectionBadgeText, { color: accentColor }]}>{sportConfig.label}</Text>
          </View>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={accentColor}
        />
      </TouchableOpacity>

      {isExpanded && card}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Basketball Tracker — Quarter scores + fouls + running total
// ─────────────────────────────────────────────────────────────────────────────

const QTR_LABELS = ['Q1', 'Q2', 'Q3', 'Q4', 'OT1', 'OT2'];

function BasketballTracker({ teamA, teamB, accentColor }: { teamA: string; teamB: string; accentColor: string }) {
  const [scoresA, setScoresA] = useState<string[]>(['', '', '', '', '', '']);
  const [scoresB, setScoresB] = useState<string[]>(['', '', '', '', '', '']);
  const [foulsA,  setFoulsA]  = useState(0);
  const [foulsB,  setFoulsB]  = useState(0);

  const totalA = scoresA.reduce((s, v) => s + (parseInt(v) || 0), 0);
  const totalB = scoresB.reduce((s, v) => s + (parseInt(v) || 0), 0);
  const leadA  = totalA > totalB;
  const leadB  = totalB > totalA;

  const setScore = (team: 'A' | 'B', idx: number, val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    if (team === 'A') setScoresA(prev => { const n = [...prev]; n[idx] = cleaned; return n; });
    else              setScoresB(prev => { const n = [...prev]; n[idx] = cleaned; return n; });
  };

  return (
    <View style={styles.trackerBody}>
      {/* Running score display */}
      <View style={styles.scoreboardDisplay}>
        <View style={[styles.sbTeamBlock, leadA && { borderBottomWidth: 3, borderBottomColor: accentColor }]}>
          <Text style={styles.sbTeamName} numberOfLines={1}>{teamA}</Text>
          <Text style={[styles.sbBigScore, leadA && { color: accentColor }]}>{totalA}</Text>
        </View>
        <View style={styles.sbVsBlock}>
          <Text style={styles.sbVs}>VS</Text>
          {totalA !== totalB && (
            <View style={[styles.sbLeadBadge, { backgroundColor: accentColor }]}>
              <Text style={styles.sbLeadText}>{leadA ? '+' + (totalA - totalB) : '+' + (totalB - totalA)}</Text>
            </View>
          )}
        </View>
        <View style={[styles.sbTeamBlock, styles.sbTeamRight, leadB && { borderBottomWidth: 3, borderBottomColor: accentColor }]}>
          <Text style={styles.sbTeamName} numberOfLines={1}>{teamB}</Text>
          <Text style={[styles.sbBigScore, leadB && { color: accentColor }]}>{totalB}</Text>
        </View>
      </View>

      {/* Quarter grid */}
      <View style={styles.periodGrid}>
        {/* Header */}
        <View style={[styles.periodRow, styles.periodHeaderRow, { backgroundColor: accentColor }]}>
          <Text style={[styles.periodCell, styles.periodTeamCell, { color: '#fff', fontSize: 9, fontWeight: FONT_WEIGHT.bold }]}>TEAM</Text>
          {QTR_LABELS.map(q => (
            <Text key={q} style={[styles.periodCell, { color: '#fff', fontSize: 9, fontWeight: FONT_WEIGHT.bold }]}>{q}</Text>
          ))}
          <Text style={[styles.periodCell, styles.periodTotalCell, { color: '#fff', fontSize: 9, fontWeight: FONT_WEIGHT.bold }]}>TOT</Text>
        </View>
        {/* Team A row */}
        <View style={[styles.periodRow, { backgroundColor: '#fff5f5' }]}>
          <Text style={[styles.periodCell, styles.periodTeamCell, { color: accentColor, fontWeight: FONT_WEIGHT.bold, fontSize: 10 }]} numberOfLines={1}>{teamA.substring(0,10)}</Text>
          {QTR_LABELS.map((_, i) => (
            <TextInput
              key={i}
              style={[styles.periodInput, { borderColor: `${accentColor}40`, color: accentColor }]}
              value={scoresA[i]}
              onChangeText={v => setScore('A', i, v)}
              keyboardType="number-pad"
              maxLength={3}
              placeholder="—"
              placeholderTextColor={COLORS.textMuted}
            />
          ))}
          <Text style={[styles.periodCell, styles.periodTotalCell, { color: accentColor, fontWeight: FONT_WEIGHT.extrabold, fontSize: 14 }]}>{totalA}</Text>
        </View>
        {/* Team B row */}
        <View style={[styles.periodRow, { backgroundColor: COLORS.background }]}>
          <Text style={[styles.periodCell, styles.periodTeamCell, { color: COLORS.textPrimary, fontWeight: FONT_WEIGHT.bold, fontSize: 10 }]} numberOfLines={1}>{teamB.substring(0,10)}</Text>
          {QTR_LABELS.map((_, i) => (
            <TextInput
              key={i}
              style={[styles.periodInput, { borderColor: COLORS.border }]}
              value={scoresB[i]}
              onChangeText={v => setScore('B', i, v)}
              keyboardType="number-pad"
              maxLength={3}
              placeholder="—"
              placeholderTextColor={COLORS.textMuted}
            />
          ))}
          <Text style={[styles.periodCell, styles.periodTotalCell, { color: COLORS.textPrimary, fontWeight: FONT_WEIGHT.extrabold, fontSize: 14 }]}>{totalB}</Text>
        </View>
      </View>

      {/* Fouls */}
      <View style={styles.foulsRow}>
        <FoulCounter label={`${teamA} Fouls`} value={foulsA} onChange={setFoulsA} accentColor={accentColor} />
        <FoulCounter label={`${teamB} Fouls`} value={foulsB} onChange={setFoulsB} accentColor={'#1d4ed8'} />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Volleyball Tracker — Set-by-set scores + sets won
// ─────────────────────────────────────────────────────────────────────────────

const SET_LABELS = ['Set 1', 'Set 2', 'Set 3', 'Set 4', 'Set 5'];

function VolleyballTracker({ teamA, teamB, accentColor }: { teamA: string; teamB: string; accentColor: string }) {
  const [scoresA, setScoresA] = useState<string[]>(['', '', '', '', '']);
  const [scoresB, setScoresB] = useState<string[]>(['', '', '', '', '']);

  const setsWonA = scoresA.filter((a, i) => parseInt(a) > (parseInt(scoresB[i]) || 0) && a !== '').length;
  const setsWonB = scoresB.filter((b, i) => parseInt(b) > (parseInt(scoresA[i]) || 0) && b !== '').length;

  return (
    <View style={styles.trackerBody}>
      {/* Sets won display */}
      <View style={styles.scoreboardDisplay}>
        <View style={[styles.sbTeamBlock, setsWonA > setsWonB && { borderBottomWidth: 3, borderBottomColor: accentColor }]}>
          <Text style={styles.sbTeamName} numberOfLines={1}>{teamA}</Text>
          <Text style={[styles.sbBigScore, { color: accentColor }]}>{setsWonA}</Text>
          <Text style={styles.sbSubLabel}>sets</Text>
        </View>
        <View style={styles.sbVsBlock}><Text style={styles.sbVs}>VS</Text></View>
        <View style={[styles.sbTeamBlock, styles.sbTeamRight, setsWonB > setsWonA && { borderBottomWidth: 3, borderBottomColor: accentColor }]}>
          <Text style={styles.sbTeamName} numberOfLines={1}>{teamB}</Text>
          <Text style={[styles.sbBigScore, { color: accentColor }]}>{setsWonB}</Text>
          <Text style={styles.sbSubLabel}>sets</Text>
        </View>
      </View>

      {/* Per-set scores */}
      <View style={styles.periodGrid}>
        <View style={[styles.periodRow, styles.periodHeaderRow, { backgroundColor: accentColor }]}>
          <Text style={[styles.periodCell, styles.periodTeamCell, { color: '#fff', fontSize: 9, fontWeight: FONT_WEIGHT.bold }]}>TEAM</Text>
          {SET_LABELS.map(s => <Text key={s} style={[styles.periodCell, { color: '#fff', fontSize: 9, fontWeight: FONT_WEIGHT.bold }]}>{s}</Text>)}
          <Text style={[styles.periodCell, styles.periodTotalCell, { color: '#fff', fontSize: 9, fontWeight: FONT_WEIGHT.bold }]}>SETS</Text>
        </View>
        <View style={[styles.periodRow, { backgroundColor: '#eff6ff' }]}>
          <Text style={[styles.periodCell, styles.periodTeamCell, { color: accentColor, fontWeight: FONT_WEIGHT.bold, fontSize: 10 }]} numberOfLines={1}>{teamA.substring(0,10)}</Text>
          {SET_LABELS.map((_, i) => (
            <TextInput key={i} style={[styles.periodInput, { borderColor: `${accentColor}50`, color: accentColor }]}
              value={scoresA[i]} onChangeText={v => { const n=[...scoresA]; n[i]=v.replace(/\D/g,''); setScoresA(n); }}
              keyboardType="number-pad" maxLength={2} placeholder="—" placeholderTextColor={COLORS.textMuted} />
          ))}
          <Text style={[styles.periodCell, styles.periodTotalCell, { color: accentColor, fontWeight: FONT_WEIGHT.extrabold, fontSize: 16 }]}>{setsWonA}</Text>
        </View>
        <View style={[styles.periodRow, { backgroundColor: COLORS.background }]}>
          <Text style={[styles.periodCell, styles.periodTeamCell, { fontWeight: FONT_WEIGHT.bold, fontSize: 10 }]} numberOfLines={1}>{teamB.substring(0,10)}</Text>
          {SET_LABELS.map((_, i) => (
            <TextInput key={i} style={[styles.periodInput, { borderColor: COLORS.border }]}
              value={scoresB[i]} onChangeText={v => { const n=[...scoresB]; n[i]=v.replace(/\D/g,''); setScoresB(n); }}
              keyboardType="number-pad" maxLength={2} placeholder="—" placeholderTextColor={COLORS.textMuted} />
          ))}
          <Text style={[styles.periodCell, styles.periodTotalCell, { fontWeight: FONT_WEIGHT.extrabold, fontSize: 16 }]}>{setsWonB}</Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Badminton Tracker — Game scores + match result
// ─────────────────────────────────────────────────────────────────────────────

const GAME_LABELS_3 = ['Game 1', 'Game 2', 'Game 3'];

function BadmintonTracker({ teamA, teamB, accentColor }: { teamA: string; teamB: string; accentColor: string }) {
  const [scoresA, setScoresA] = useState<string[]>(['', '', '']);
  const [scoresB, setScoresB] = useState<string[]>(['', '', '']);

  const gamesWonA = scoresA.filter((a, i) => parseInt(a) > (parseInt(scoresB[i]) || 0) && a !== '').length;
  const gamesWonB = scoresB.filter((b, i) => parseInt(b) > (parseInt(scoresA[i]) || 0) && b !== '').length;

  return (
    <View style={styles.trackerBody}>
      <View style={styles.scoreboardDisplay}>
        <View style={[styles.sbTeamBlock, gamesWonA > gamesWonB && { borderBottomWidth: 3, borderBottomColor: accentColor }]}>
          <Text style={styles.sbTeamName} numberOfLines={1}>{teamA}</Text>
          <Text style={[styles.sbBigScore, { color: accentColor }]}>{gamesWonA}</Text>
          <Text style={styles.sbSubLabel}>games</Text>
        </View>
        <View style={styles.sbVsBlock}><Text style={styles.sbVs}>VS</Text></View>
        <View style={[styles.sbTeamBlock, styles.sbTeamRight, gamesWonB > gamesWonA && { borderBottomWidth: 3, borderBottomColor: accentColor }]}>
          <Text style={styles.sbTeamName} numberOfLines={1}>{teamB}</Text>
          <Text style={[styles.sbBigScore, { color: accentColor }]}>{gamesWonB}</Text>
          <Text style={styles.sbSubLabel}>games</Text>
        </View>
      </View>
      <View style={styles.periodGrid}>
        <View style={[styles.periodRow, styles.periodHeaderRow, { backgroundColor: accentColor }]}>
          <Text style={[styles.periodCell, styles.periodTeamCell, { color: '#fff', fontSize: 9, fontWeight: FONT_WEIGHT.bold }]}>PLAYER</Text>
          {GAME_LABELS_3.map(g => <Text key={g} style={[styles.periodCell, { color: '#fff', fontSize: 9, fontWeight: FONT_WEIGHT.bold }]}>{g}</Text>)}
          <Text style={[styles.periodCell, styles.periodTotalCell, { color: '#fff', fontSize: 9, fontWeight: FONT_WEIGHT.bold }]}>WON</Text>
        </View>
        <View style={[styles.periodRow, { backgroundColor: '#f0fdf4' }]}>
          <Text style={[styles.periodCell, styles.periodTeamCell, { color: accentColor, fontWeight: FONT_WEIGHT.bold, fontSize: 10 }]} numberOfLines={1}>{teamA.substring(0,10)}</Text>
          {GAME_LABELS_3.map((_, i) => (
            <TextInput key={i} style={[styles.periodInput, { borderColor: `${accentColor}50`, color: accentColor }]}
              value={scoresA[i]} onChangeText={v => { const n=[...scoresA]; n[i]=v.replace(/\D/g,''); setScoresA(n); }}
              keyboardType="number-pad" maxLength={2} placeholder="—" placeholderTextColor={COLORS.textMuted} />
          ))}
          <Text style={[styles.periodCell, styles.periodTotalCell, { color: accentColor, fontWeight: FONT_WEIGHT.extrabold, fontSize: 16 }]}>{gamesWonA}</Text>
        </View>
        <View style={[styles.periodRow, { backgroundColor: COLORS.background }]}>
          <Text style={[styles.periodCell, styles.periodTeamCell, { fontWeight: FONT_WEIGHT.bold, fontSize: 10 }]} numberOfLines={1}>{teamB.substring(0,10)}</Text>
          {GAME_LABELS_3.map((_, i) => (
            <TextInput key={i} style={[styles.periodInput, { borderColor: COLORS.border }]}
              value={scoresB[i]} onChangeText={v => { const n=[...scoresB]; n[i]=v.replace(/\D/g,''); setScoresB(n); }}
              keyboardType="number-pad" maxLength={2} placeholder="—" placeholderTextColor={COLORS.textMuted} />
          ))}
          <Text style={[styles.periodCell, styles.periodTotalCell, { fontWeight: FONT_WEIGHT.extrabold, fontSize: 16 }]}>{gamesWonB}</Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Football Tracker — Half/Period scores + goal log
// ─────────────────────────────────────────────────────────────────────────────

const HALF_LABELS = ['1st Half', '2nd Half', 'ET 1', 'ET 2'];

function FootballTracker({ teamA, teamB, accentColor }: { teamA: string; teamB: string; accentColor: string }) {
  const [scoresA, setScoresA] = useState<string[]>(['', '', '', '']);
  const [scoresB, setScoresB] = useState<string[]>(['', '', '', '']);

  const totalA = scoresA.reduce((s, v) => s + (parseInt(v) || 0), 0);
  const totalB = scoresB.reduce((s, v) => s + (parseInt(v) || 0), 0);

  return (
    <View style={styles.trackerBody}>
      <View style={styles.scoreboardDisplay}>
        <View style={[styles.sbTeamBlock, totalA > totalB && { borderBottomWidth: 3, borderBottomColor: accentColor }]}>
          <Text style={styles.sbTeamName} numberOfLines={1}>{teamA}</Text>
          <Text style={[styles.sbBigScore, totalA > totalB && { color: accentColor }]}>{totalA}</Text>
        </View>
        <View style={styles.sbVsBlock}><Text style={styles.sbVs}>VS</Text></View>
        <View style={[styles.sbTeamBlock, styles.sbTeamRight, totalB > totalA && { borderBottomWidth: 3, borderBottomColor: accentColor }]}>
          <Text style={styles.sbTeamName} numberOfLines={1}>{teamB}</Text>
          <Text style={[styles.sbBigScore, totalB > totalA && { color: accentColor }]}>{totalB}</Text>
        </View>
      </View>
      <View style={styles.periodGrid}>
        <View style={[styles.periodRow, styles.periodHeaderRow, { backgroundColor: accentColor }]}>
          <Text style={[styles.periodCell, styles.periodTeamCell, { color: '#fff', fontSize: 9, fontWeight: FONT_WEIGHT.bold }]}>TEAM</Text>
          {HALF_LABELS.map(h => <Text key={h} style={[styles.periodCell, { color: '#fff', fontSize: 8, fontWeight: FONT_WEIGHT.bold }]}>{h}</Text>)}
          <Text style={[styles.periodCell, styles.periodTotalCell, { color: '#fff', fontSize: 9, fontWeight: FONT_WEIGHT.bold }]}>TOT</Text>
        </View>
        <View style={[styles.periodRow, { backgroundColor: '#f0fdf4' }]}>
          <Text style={[styles.periodCell, styles.periodTeamCell, { color: accentColor, fontWeight: FONT_WEIGHT.bold, fontSize: 10 }]} numberOfLines={1}>{teamA.substring(0,10)}</Text>
          {HALF_LABELS.map((_, i) => (
            <TextInput key={i} style={[styles.periodInput, { borderColor: `${accentColor}50`, color: accentColor }]}
              value={scoresA[i]} onChangeText={v => { const n=[...scoresA]; n[i]=v.replace(/\D/g,''); setScoresA(n); }}
              keyboardType="number-pad" maxLength={2} placeholder="—" placeholderTextColor={COLORS.textMuted} />
          ))}
          <Text style={[styles.periodCell, styles.periodTotalCell, { color: accentColor, fontWeight: FONT_WEIGHT.extrabold, fontSize: 14 }]}>{totalA}</Text>
        </View>
        <View style={[styles.periodRow, { backgroundColor: COLORS.background }]}>
          <Text style={[styles.periodCell, styles.periodTeamCell, { fontWeight: FONT_WEIGHT.bold, fontSize: 10 }]} numberOfLines={1}>{teamB.substring(0,10)}</Text>
          {HALF_LABELS.map((_, i) => (
            <TextInput key={i} style={[styles.periodInput, { borderColor: COLORS.border }]}
              value={scoresB[i]} onChangeText={v => { const n=[...scoresB]; n[i]=v.replace(/\D/g,''); setScoresB(n); }}
              keyboardType="number-pad" maxLength={2} placeholder="—" placeholderTextColor={COLORS.textMuted} />
          ))}
          <Text style={[styles.periodCell, styles.periodTotalCell, { fontWeight: FONT_WEIGHT.extrabold, fontSize: 14 }]}>{totalB}</Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tennis Tracker — Set/game scores
// ─────────────────────────────────────────────────────────────────────────────

function TennisTracker({ teamA, teamB, accentColor }: { teamA: string; teamB: string; accentColor: string }) {
  const [scoresA, setScoresA] = useState<string[]>(['', '', '']);
  const [scoresB, setScoresB] = useState<string[]>(['', '', '']);

  const setsA = scoresA.filter((a, i) => parseInt(a) > (parseInt(scoresB[i]) || 0) && a !== '').length;
  const setsB = scoresB.filter((b, i) => parseInt(b) > (parseInt(scoresA[i]) || 0) && b !== '').length;

  return (
    <View style={styles.trackerBody}>
      <View style={styles.scoreboardDisplay}>
        <View style={[styles.sbTeamBlock, setsA > setsB && { borderBottomWidth: 3, borderBottomColor: accentColor }]}>
          <Text style={styles.sbTeamName} numberOfLines={1}>{teamA}</Text>
          <Text style={[styles.sbBigScore, { color: accentColor }]}>{setsA}</Text>
          <Text style={styles.sbSubLabel}>sets</Text>
        </View>
        <View style={styles.sbVsBlock}><Text style={styles.sbVs}>VS</Text></View>
        <View style={[styles.sbTeamBlock, styles.sbTeamRight, setsB > setsA && { borderBottomWidth: 3, borderBottomColor: accentColor }]}>
          <Text style={styles.sbTeamName} numberOfLines={1}>{teamB}</Text>
          <Text style={[styles.sbBigScore, { color: accentColor }]}>{setsB}</Text>
          <Text style={styles.sbSubLabel}>sets</Text>
        </View>
      </View>
      <View style={styles.periodGrid}>
        <View style={[styles.periodRow, styles.periodHeaderRow, { backgroundColor: accentColor }]}>
          <Text style={[styles.periodCell, styles.periodTeamCell, { color: '#fff', fontSize: 9, fontWeight: FONT_WEIGHT.bold }]}>PLAYER</Text>
          {['Set 1','Set 2','Set 3'].map(s => <Text key={s} style={[styles.periodCell, { color: '#fff', fontSize: 9, fontWeight: FONT_WEIGHT.bold }]}>{s}</Text>)}
          <Text style={[styles.periodCell, styles.periodTotalCell, { color: '#fff', fontSize: 9, fontWeight: FONT_WEIGHT.bold }]}>WON</Text>
        </View>
        <View style={[styles.periodRow, { backgroundColor: '#fefce8' }]}>
          <Text style={[styles.periodCell, styles.periodTeamCell, { color: accentColor, fontWeight: FONT_WEIGHT.bold, fontSize: 10 }]} numberOfLines={1}>{teamA.substring(0,10)}</Text>
          {[0,1,2].map(i => (
            <TextInput key={i} style={[styles.periodInput, { borderColor: `${accentColor}50`, color: accentColor }]}
              value={scoresA[i]} onChangeText={v => { const n=[...scoresA]; n[i]=v.replace(/\D/g,''); setScoresA(n); }}
              keyboardType="number-pad" maxLength={2} placeholder="—" placeholderTextColor={COLORS.textMuted} />
          ))}
          <Text style={[styles.periodCell, styles.periodTotalCell, { color: accentColor, fontWeight: FONT_WEIGHT.extrabold, fontSize: 16 }]}>{setsA}</Text>
        </View>
        <View style={[styles.periodRow, { backgroundColor: COLORS.background }]}>
          <Text style={[styles.periodCell, styles.periodTeamCell, { fontWeight: FONT_WEIGHT.bold, fontSize: 10 }]} numberOfLines={1}>{teamB.substring(0,10)}</Text>
          {[0,1,2].map(i => (
            <TextInput key={i} style={[styles.periodInput, { borderColor: COLORS.border }]}
              value={scoresB[i]} onChangeText={v => { const n=[...scoresB]; n[i]=v.replace(/\D/g,''); setScoresB(n); }}
              keyboardType="number-pad" maxLength={2} placeholder="—" placeholderTextColor={COLORS.textMuted} />
          ))}
          <Text style={[styles.periodCell, styles.periodTotalCell, { fontWeight: FONT_WEIGHT.extrabold, fontSize: 16 }]}>{setsB}</Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Table Tennis Tracker — Game scores (best of 5)
// ─────────────────────────────────────────────────────────────────────────────

function TableTennisTracker({ teamA, teamB, accentColor }: { teamA: string; teamB: string; accentColor: string }) {
  const [scoresA, setScoresA] = useState<string[]>(['', '', '', '', '']);
  const [scoresB, setScoresB] = useState<string[]>(['', '', '', '', '']);

  const gamesA = scoresA.filter((a, i) => parseInt(a) > (parseInt(scoresB[i]) || 0) && a !== '').length;
  const gamesB = scoresB.filter((b, i) => parseInt(b) > (parseInt(scoresA[i]) || 0) && b !== '').length;

  return (
    <View style={styles.trackerBody}>
      <View style={styles.scoreboardDisplay}>
        <View style={[styles.sbTeamBlock, gamesA > gamesB && { borderBottomWidth: 3, borderBottomColor: accentColor }]}>
          <Text style={styles.sbTeamName} numberOfLines={1}>{teamA}</Text>
          <Text style={[styles.sbBigScore, { color: accentColor }]}>{gamesA}</Text>
          <Text style={styles.sbSubLabel}>games</Text>
        </View>
        <View style={styles.sbVsBlock}><Text style={styles.sbVs}>VS</Text></View>
        <View style={[styles.sbTeamBlock, styles.sbTeamRight, gamesB > gamesA && { borderBottomWidth: 3, borderBottomColor: accentColor }]}>
          <Text style={styles.sbTeamName} numberOfLines={1}>{teamB}</Text>
          <Text style={[styles.sbBigScore, { color: accentColor }]}>{gamesB}</Text>
          <Text style={styles.sbSubLabel}>games</Text>
        </View>
      </View>
      <View style={styles.periodGrid}>
        <View style={[styles.periodRow, styles.periodHeaderRow, { backgroundColor: accentColor }]}>
          <Text style={[styles.periodCell, styles.periodTeamCell, { color: '#fff', fontSize: 9, fontWeight: FONT_WEIGHT.bold }]}>PLAYER</Text>
          {['G1','G2','G3','G4','G5'].map(g => <Text key={g} style={[styles.periodCell, { color: '#fff', fontSize: 9, fontWeight: FONT_WEIGHT.bold }]}>{g}</Text>)}
          <Text style={[styles.periodCell, styles.periodTotalCell, { color: '#fff', fontSize: 9, fontWeight: FONT_WEIGHT.bold }]}>WON</Text>
        </View>
        <View style={[styles.periodRow, { backgroundColor: '#f0fdfa' }]}>
          <Text style={[styles.periodCell, styles.periodTeamCell, { color: accentColor, fontWeight: FONT_WEIGHT.bold, fontSize: 10 }]} numberOfLines={1}>{teamA.substring(0,10)}</Text>
          {[0,1,2,3,4].map(i => (
            <TextInput key={i} style={[styles.periodInput, { borderColor: `${accentColor}50`, color: accentColor }]}
              value={scoresA[i]} onChangeText={v => { const n=[...scoresA]; n[i]=v.replace(/\D/g,''); setScoresA(n); }}
              keyboardType="number-pad" maxLength={2} placeholder="—" placeholderTextColor={COLORS.textMuted} />
          ))}
          <Text style={[styles.periodCell, styles.periodTotalCell, { color: accentColor, fontWeight: FONT_WEIGHT.extrabold, fontSize: 16 }]}>{gamesA}</Text>
        </View>
        <View style={[styles.periodRow, { backgroundColor: COLORS.background }]}>
          <Text style={[styles.periodCell, styles.periodTeamCell, { fontWeight: FONT_WEIGHT.bold, fontSize: 10 }]} numberOfLines={1}>{teamB.substring(0,10)}</Text>
          {[0,1,2,3,4].map(i => (
            <TextInput key={i} style={[styles.periodInput, { borderColor: COLORS.border }]}
              value={scoresB[i]} onChangeText={v => { const n=[...scoresB]; n[i]=v.replace(/\D/g,''); setScoresB(n); }}
              keyboardType="number-pad" maxLength={2} placeholder="—" placeholderTextColor={COLORS.textMuted} />
          ))}
          <Text style={[styles.periodCell, styles.periodTotalCell, { fontWeight: FONT_WEIGHT.extrabold, fontSize: 16 }]}>{gamesB}</Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Track & Field Tracker — Per-participant time/distance entry
// ─────────────────────────────────────────────────────────────────────────────

function TrackFieldTracker({ depts, accentColor }: { depts: string[]; accentColor: string }) {
  const [results, setResults] = useState<string[]>(depts.map(() => ''));
  const [ranks,   setRanks]   = useState<string[]>(depts.map(() => ''));

  const participants = depts.length > 0 ? depts : ['Participant 1', 'Participant 2', 'Participant 3'];

  return (
    <View style={styles.trackerBody}>
      <View style={[styles.trackHeader, { backgroundColor: accentColor }]}>
        <Text style={styles.trackHeaderTh}>ATHLETE / DEPT</Text>
        <Text style={styles.trackHeaderThSm}>RESULT (Time/Dist)</Text>
        <Text style={styles.trackHeaderThSm}>RANK</Text>
      </View>
      {participants.map((p, i) => (
        <View key={i} style={[styles.trackRow, i % 2 === 1 && { backgroundColor: COLORS.background }]}>
          <Text style={styles.trackLane}>{i + 1}</Text>
          <Text style={styles.trackDept} numberOfLines={2}>{p}</Text>
          <TextInput
            style={[styles.trackInput, { borderColor: `${accentColor}40`, color: accentColor }]}
            value={results[i]}
            onChangeText={v => { const n = [...results]; n[i] = v; setResults(n); }}
            placeholder="00:00.00 / 0.00m"
            placeholderTextColor={COLORS.textMuted}
          />
          <TextInput
            style={[styles.trackRankInput, { borderColor: COLORS.border }]}
            value={ranks[i]}
            onChangeText={v => { const n = [...ranks]; n[i] = v.replace(/\D/g, ''); setRanks(n); }}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="#"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Swimming Tracker — Lane + time entry
// ─────────────────────────────────────────────────────────────────────────────

function SwimmingTracker({ depts, accentColor }: { depts: string[]; accentColor: string }) {
  const [times,  setTimes]  = useState<string[]>(depts.map(() => ''));
  const [places, setPlaces] = useState<string[]>(depts.map(() => ''));

  const participants = depts.length > 0 ? depts : ['Lane 1', 'Lane 2', 'Lane 3', 'Lane 4'];

  return (
    <View style={styles.trackerBody}>
      <View style={[styles.trackHeader, { backgroundColor: accentColor }]}>
        <Text style={styles.trackHeaderTh}>SWIMMER / DEPT</Text>
        <Text style={styles.trackHeaderThSm}>FINISH TIME</Text>
        <Text style={styles.trackHeaderThSm}>PLACE</Text>
      </View>
      {participants.map((p, i) => (
        <View key={i} style={[styles.trackRow, i % 2 === 1 && { backgroundColor: COLORS.background }]}>
          <Text style={styles.trackLane}>{i + 1}</Text>
          <Text style={styles.trackDept} numberOfLines={2}>{p}</Text>
          <TextInput
            style={[styles.trackInput, { borderColor: `${accentColor}40`, color: accentColor }]}
            value={times[i]}
            onChangeText={v => { const n = [...times]; n[i] = v; setTimes(n); }}
            placeholder="MM:SS.ms"
            placeholderTextColor={COLORS.textMuted}
          />
          <TextInput
            style={[styles.trackRankInput, { borderColor: COLORS.border }]}
            value={places[i]}
            onChangeText={v => { const n = [...places]; n[i] = v.replace(/\D/g, ''); setPlaces(n); }}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="#"
            placeholderTextColor={COLORS.textMuted}
          />
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic Tracker — plain points sheet for sports without a bespoke scoreboard
// (cultural / arts, chess, arnis, sepak takraw, e-sports, …)
// ─────────────────────────────────────────────────────────────────────────────

function GenericTracker({ depts, accentColor }: { depts: string[]; accentColor: string }) {
  const teams = depts.length > 0 ? depts : ['Team A', 'Team B'];
  const [scores, setScores] = useState<string[]>(teams.map(() => ''));

  const nums     = scores.map(s => parseInt(s) || 0);
  const anyScore = nums.some(n => n > 0);
  const leaderIdx = anyScore ? nums.indexOf(Math.max(...nums)) : -1;
  const tie      = anyScore && nums.filter(n => n === Math.max(...nums)).length > 1;

  return (
    <View style={styles.trackerBody}>
      <View style={[styles.trackHeader, { backgroundColor: accentColor }]}>
        <Text style={styles.trackHeaderTh}>TEAM / DEPARTMENT</Text>
        <Text style={styles.trackHeaderThSm}>SCORE</Text>
      </View>
      {teams.map((t, i) => {
        const leads = !tie && i === leaderIdx;
        return (
          <View key={i} style={[styles.trackRow, i % 2 === 1 && { backgroundColor: COLORS.background }]}>
            <Text style={styles.trackLane}>{i + 1}</Text>
            <Text style={styles.trackDept} numberOfLines={2}>{t}</Text>
            {leads && (
              <View style={[styles.genLeadBadge, { backgroundColor: accentColor }]}>
                <Text style={styles.genLeadText}>LEADS</Text>
              </View>
            )}
            <TextInput
              style={[styles.genScoreInput, { borderColor: `${accentColor}40`, color: accentColor }]}
              value={scores[i]}
              onChangeText={v => { const n = [...scores]; n[i] = v.replace(/\D/g, ''); setScores(n); }}
              keyboardType="number-pad"
              maxLength={3}
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FoulCounter — Increment/decrement counter for fouls/cards
// ─────────────────────────────────────────────────────────────────────────────

function FoulCounter({ label, value, onChange, accentColor }: {
  label: string; value: number; onChange: (v: number) => void; accentColor: string;
}) {
  return (
    <View style={styles.foulCounter}>
      <Text style={styles.foulLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.foulControls}>
        <TouchableOpacity
          style={[styles.foulBtn, { borderColor: `${accentColor}50` }]}
          onPress={() => onChange(Math.max(0, value - 1))}
        >
          <Ionicons name="remove" size={18} color={accentColor} />
        </TouchableOpacity>
        <View style={[styles.foulDisplay, { borderColor: accentColor, backgroundColor: value >= 4 ? '#fff5f5' : COLORS.background }]}>
          <Text style={[styles.foulValue, { color: value >= 4 ? COLORS.destructive : accentColor }]}>{value}</Text>
        </View>
        <TouchableOpacity
          style={[styles.foulBtn, { borderColor: `${accentColor}50` }]}
          onPress={() => onChange(value + 1)}
        >
          <Ionicons name="add" size={18} color={accentColor} />
        </TouchableOpacity>
      </View>
      {/* Foul pips */}
      <View style={styles.foulPips}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={[styles.foulPip, { backgroundColor: i < value ? (value >= 4 ? COLORS.destructive : accentColor) : COLORS.border }]} />
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    gap: SPACING.xs,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.extrabold,
    color: COLORS.textPrimary,
    letterSpacing: 0.8,
  },
  sectionBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  sectionBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },

  // Tracker card
  trackerCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    ...SHADOWS.card,
  },
  trackerBanner: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  trackerBannerText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.extrabold,
    color: '#fff',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  trackerBannerSub: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.70)',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  trackerBody: {
    padding: SPACING.sm,
    gap: SPACING.sm,
  },

  // Scoreboard display
  scoreboardDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: SPACING.xs,
  },
  sbTeamBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  sbTeamRight: {
    alignItems: 'center',
  },
  sbTeamName: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  sbBigScore: {
    fontSize: 44,
    fontWeight: FONT_WEIGHT.extrabold,
    color: COLORS.textPrimary,
    lineHeight: 50,
  },
  sbSubLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    marginTop: -2,
  },
  sbVsBlock: {
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    gap: 4,
  },
  sbVs: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  sbLeadBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  sbLeadText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHT.bold,
    color: '#fff',
  },

  // Period grid
  periodGrid: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: 4,
    backgroundColor: COLORS.surface,
  },
  periodHeaderRow: {},
  periodCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
  },
  periodTeamCell: {
    flex: 2,
    textAlign: 'left',
    paddingLeft: 4,
  },
  periodTotalCell: {
    flex: 1.2,
    textAlign: 'center',
  },
  periodInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    marginHorizontal: 2,
    paddingVertical: 5,
    textAlign: 'center',
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
    minHeight: 34,
  },

  // Fouls
  foulsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.xs,
  },
  foulCounter: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  foulLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  foulControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  foulBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  foulDisplay: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foulValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.extrabold,
  },
  foulPips: {
    flexDirection: 'row',
    gap: 4,
  },
  foulPip: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.full,
  },

  // Track & Field / Swimming
  trackHeader: {
    flexDirection: 'row',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  trackHeaderTh: {
    flex: 3,
    fontSize: 9,
    fontWeight: FONT_WEIGHT.bold,
    color: '#fff',
    letterSpacing: 0.5,
    paddingLeft: 4,
  },
  trackHeaderThSm: {
    flex: 2,
    fontSize: 9,
    fontWeight: FONT_WEIGHT.bold,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: 4,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  trackLane: {
    width: 20,
    textAlign: 'center',
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textMuted,
  },
  trackDept: {
    flex: 3,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    paddingRight: 4,
  },
  trackInput: {
    flex: 2.5,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    backgroundColor: COLORS.background,
    minHeight: 36,
  },
  trackRankInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingVertical: 6,
    textAlign: 'center',
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    minHeight: 36,
  },

  // Generic tracker
  genLeadBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    marginRight: 4,
  },
  genLeadText: {
    fontSize: 9,
    fontWeight: FONT_WEIGHT.bold,
    color: '#fff',
    letterSpacing: 0.5,
  },
  genScoreInput: {
    flex: 1.4,
    borderWidth: 1.5,
    borderRadius: RADIUS.sm,
    paddingVertical: 6,
    textAlign: 'center',
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.extrabold,
    backgroundColor: COLORS.surface,
    minHeight: 38,
  },
});
