import React from 'react';
import {
  Activity, ArrowLeft, BadgeCheck, Calendar, Camera, CameraOff, ChartColumn, Check,
  CheckCheck, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleAlert, CircleCheck, CircleCheckBig,
  CircleDot, Clock, CloudOff, Dumbbell, Eye, EyeOff, Feather, FileText, Flag, Goal,
  Info, List, ListRestart, LoaderCircle, Lock, LogIn, LogOut, Mail, MapPin, Minus,
  Music, Pencil, Play, Plus, Printer, QrCode, RefreshCw, RotateCcw, ScanLine, Search,
  Settings, Share2, Table, Target, Timer, TriangleAlert, Trophy, Users, Volleyball,
  WavesLadder, Wifi, WifiOff, X, Zap,
  type LucideProps,
} from 'lucide-react-native';
import { COLORS } from '../../../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Icon — the ONE place lucide is imported. Screens use <Icon name="…"/> with a
// stable app vocabulary; swap the whole set here without touching call sites.
// ─────────────────────────────────────────────────────────────────────────────

const MAP = {
  // nav / chrome
  calendar: Calendar,
  scan: ScanLine,
  qr: QrCode,
  history: ListRestart,
  list: List,
  settings: Settings,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  'arrow-left': ArrowLeft,
  close: X,
  search: Search,
  refresh: RefreshCw,
  'rotate-ccw': RotateCcw,
  spinner: LoaderCircle,

  // meta
  clock: Clock,
  location: MapPin,
  users: Users,
  'file-text': FileText,
  info: Info,
  'bar-chart': ChartColumn,

  // status / feedback
  'alert-circle': CircleAlert,
  'alert-triangle': TriangleAlert,
  'check-circle': CircleCheckBig,
  check: Check,
  'check-all': CheckCheck,
  verified: BadgeCheck,
  'cloud-off': CloudOff,
  wifi: Wifi,
  'wifi-off': WifiOff,
  activity: Activity,

  // actions
  plus: Plus,
  minus: Minus,
  play: Play,
  pencil: Pencil,
  flag: Flag,
  print: Printer,
  share: Share2,
  camera: Camera,
  'camera-off': CameraOff,
  mail: Mail,
  lock: Lock,
  eye: Eye,
  'eye-off': EyeOff,
  login: LogIn,
  logout: LogOut,
  trophy: Trophy,
  target: Target,

  // sport glyphs (nearest lucide) — see sport-config.ts
  'circle-dot': CircleDot,
  volleyball: Volleyball,
  feather: Feather,
  goal: Goal,
  timer: Timer,
  waves: WavesLadder,
  table: Table,
  music: Music,
  zap: Zap,
  dumbbell: Dumbbell,
} as const;

export type IconName = keyof typeof MAP;

interface IconProps extends Omit<LucideProps, 'name'> {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, color = COLORS.textSecondary, strokeWidth = 2, ...rest }: IconProps) {
  const Cmp = MAP[name] ?? Trophy;
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} {...rest} />;
}
