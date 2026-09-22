# Sports Office Management System - Transformation Plan

## 🎯 System Overview

**Previous System:** University Event Competition Scoring System  
**New System:** Sports Office Management System for Intramurals  
**Focus:** Comprehensive sports event management with athlete tracking, coach management, and performance analytics

---

## 📋 User Roles & Responsibilities

### 1. **Admin**
**Purpose:** Overall system management and oversight

**Responsibilities:**
- Manage sports events and schedules
- Oversee coaches and athletes
- Generate reports and analytics
- Manage departments/teams
- Handle system settings
- Monitor attendance and performance across all teams
- Approve/verify athlete requirements
- Manage venues and facilities

**Dashboard Features:**
- System-wide statistics
- Event calendar
- Team performance overview
- Recent activities
- Quick actions (create event, add coach, add athlete)

---

### 2. **Coach** (NEW)
**Purpose:** Team management and athlete development

**Responsibilities:**
- Manage assigned athletes
- Track attendance
- Monitor athlete performance
- Verify athlete requirements (waivers, certificates)
- Submit team rosters for events
- View game schedules
- Record training sessions
- Communicate with athletes

**Dashboard Features:**
- My Athletes list
- Attendance tracker
- Performance metrics
- Upcoming games
- Requirements status
- Team roster management

---

### 3. **Athlete** (NEW)
**Purpose:** Self-service portal for athletes

**Responsibilities:**
- View personal performance
- Check game schedules (date, time, venue)
- Submit required documents
- View attendance record
- View team information
- Update personal information

**Dashboard Features:**
- My Schedule (upcoming games)
- My Performance stats
- Requirements checklist
- Attendance history
- Team roster
- Personal profile

---

### 4. **Judge**
**Purpose:** Score athletic competitions

**Responsibilities:**
- Score events based on criteria
- Access events via QR code or login
- Submit scores for departments/teams
- View scoring history

**Dashboard Features:**
- Assigned events
- Scoring interface
- Score history

---

### 5. **Public Viewer**
**Purpose:** View live results and standings

**Responsibilities:**
- View ongoing events
- See live rankings
- Check leaderboard
- Browse event history

**Features:**
- Live event viewer
- Leaderboard (overall & by sport)
- Event history
- Department standings

---

## 🗃️ Database Schema

### New Tables/Collections

#### **Athletes**
```javascript
{
  id: string,
  studentId: string,
  firstName: string,
  lastName: string,
  email: string,
  department: string,
  yearLevel: string, // 1st, 2nd, 3rd, 4th
  course: string,
  coachId: string,
  teamIds: string[],
  status: 'active' | 'inactive' | 'injured',
  emergencyContact: {
    name: string,
    relationship: string,
    phone: string
  },
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### **Coaches**
```javascript
{
  id: string,
  userId: string, // Link to auth user
  firstName: string,
  lastName: string,
  email: string,
  department: string,
  sports: string[], // Sports they coach
  athleteIds: string[],
  teamIds: string[],
  status: 'active' | 'inactive',
  createdAt: timestamp
}
```

#### **Teams**
```javascript
{
  id: string,
  name: string,
  sport: string,
  department: string,
  coachId: string,
  athleteIds: string[],
  captainId: string, // Athlete ID
  status: 'active' | 'inactive',
  createdAt: timestamp
}
```

#### **Attendance**
```javascript
{
  id: string,
  athleteId: string,
  eventId: string, // Can be training or game
  date: date,
  status: 'present' | 'absent' | 'late' | 'excused',
  notes: string,
  recordedBy: string, // Coach ID
  createdAt: timestamp
}
```

#### **Performance**
```javascript
{
  id: string,
  athleteId: string,
  eventId: string,
  sport: string,
  metrics: {
    // Sport-specific metrics
    points?: number,
    assists?: number,
    rebounds?: number,
    time?: string, // For track/swimming
    // etc.
  },
  overallRating: number, // 1-10
  coachNotes: string,
  recordedBy: string, // Coach ID
  recordedAt: timestamp
}
```

#### **Requirements**
```javascript
{
  id: string,
  athleteId: string,
  type: 'waiver' | 'certificate' | 'medical' | 'parental_consent' | 'other',
  name: string,
  description: string,
  fileUrl: string, // Supabase storage URL
  status: 'pending' | 'approved' | 'rejected',
  submittedAt: timestamp,
  reviewedBy: string, // Admin/Coach ID
  reviewedAt: timestamp,
  notes: string
}
```

#### **Events** (Updated)
```javascript
{
  id: string,
  name: string,
  category: 'Sports', // Always Sports now
  sport: string, // Basketball, Volleyball, etc.
  schedule: date,
  startTime: time,
  endTime: time,
  venue: string, // NEW
  status: 'upcoming' | 'ongoing' | 'completed',
  departments: string[],
  teams: string[], // NEW - Team IDs
  criteria: Array<{ name: string; weight: number }>,
  qrToken: string,
  createdAt: timestamp
}
```

---

## 🎨 UI Components

### Coach Interface

#### **Pages:**
1. **Dashboard** (`/coach/dashboard`)
   - Overview statistics
   - Quick actions
   - Recent activities

2. **My Athletes** (`/coach/athletes`)
   - List of assigned athletes
   - Add/edit athlete
   - View athlete details
   - Filter by team/sport

3. **Attendance** (`/coach/attendance`)
   - Mark attendance
   - View attendance history
   - Generate attendance reports
   - Filter by date/athlete/event

4. **Performance** (`/coach/performance`)
   - Record athlete performance
   - View performance trends
   - Compare athletes
   - Export performance data

5. **Requirements** (`/coach/requirements`)
   - View athlete requirements
   - Approve/reject documents
   - Track compliance
   - Send reminders

6. **Teams** (`/coach/teams`)
   - Manage team rosters
   - Assign captains
   - View team statistics

7. **Schedule** (`/coach/schedule`)
   - View game schedule
   - View training schedule
   - Create training sessions

---

### Athlete Interface

#### **Pages:**
1. **Dashboard** (`/athlete/dashboard`)
   - Personal statistics
   - Upcoming games
   - Recent performance
   - Notifications

2. **My Schedule** (`/athlete/schedule`)
   - Game schedule (date, time, venue)
   - Training schedule
   - Calendar view

3. **My Performance** (`/athlete/performance`)
   - Performance metrics
   - Progress charts
   - Comparison with team average
   - Achievement badges

4. **Requirements** (`/athlete/requirements`)
   - Upload documents
   - Track submission status
   - Download forms
   - View feedback

5. **My Team** (`/athlete/team`)
   - Team roster
   - Team statistics
   - Coach information
   - Team schedule

6. **Profile** (`/athlete/profile`)
   - Personal information
   - Emergency contact
   - Update details

---

## 🔐 Authentication Updates

### Registration Codes
- `ADMIN2025` - Admin registration
- `COACH2025` - Coach registration (NEW)
- `ATHLETE2025` - Athlete registration (NEW)
- `JUDGE2025` - Judge registration

### User Metadata
```javascript
{
  role: 'admin' | 'coach' | 'athlete' | 'judge',
  name: string,
  department: string,
  // Role-specific fields
  coachId?: string, // For athletes
  athleteId?: string, // For athlete users
  sports?: string[], // For coaches
}
```

---

## 📊 New Features

### 1. **Athlete Management**
- CRUD operations for athletes
- Bulk import (CSV)
- Profile management
- Status tracking (active/inactive/injured)
- Medical clearance tracking

### 2. **Attendance Tracking**
- Daily attendance marking
- QR code check-in (future)
- Attendance reports
- Excuse management
- Notifications for absences

### 3. **Performance Analytics**
- Sport-specific metrics
- Performance trends
- Comparative analytics
- Achievement tracking
- Progress reports

### 4. **Requirements Management**
- Document upload (Supabase Storage)
- Approval workflow
- Expiration tracking
- Automated reminders
- Compliance reports

### 5. **Team Management**
- Create/edit teams
- Roster management
- Captain assignment
- Team statistics
- Inter-team comparisons

### 6. **Enhanced Scheduling**
- Game scheduling
- Training sessions
- Venue management
- Conflict detection
- Calendar integration

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Current)
- ✅ Remove non-sports categories
- ✅ Update demo data with sports events
- 🔄 Create database schema
- 🔄 Update authentication for new roles

### Phase 2: Coach Interface
- Create coach dashboard
- Implement athlete management
- Add attendance tracking
- Build performance recording
- Implement requirements management

### Phase 3: Athlete Interface
- Create athlete dashboard
- Build schedule viewer
- Implement document upload
- Create performance viewer
- Add profile management

### Phase 4: Admin Updates
- Update admin dashboard for sports focus
- Add coach management
- Add athlete overview
- Enhance reporting

### Phase 5: Enhanced Features
- Team management
- Advanced analytics
- Messaging system
- Photo gallery
- Mobile app (future)

---

## 💡 Suggested Enhancements

### Priority 1 (Essential)
1. **Team Management** - Group athletes into teams
2. **Document Upload** - Supabase Storage for requirements
3. **Attendance System** - Track athlete presence
4. **Performance Metrics** - Record and analyze performance

### Priority 2 (Important)
5. **Notifications** - Email/SMS for schedules and updates
6. **Messaging** - Coach-athlete communication
7. **Reports** - Comprehensive reporting system
8. **Mobile Responsive** - Optimize for mobile use

### Priority 3 (Nice to Have)
9. **QR Check-in** - Automated attendance via QR
10. **Injury Tracking** - Medical records and clearance
11. **Equipment Management** - Track equipment loans
12. **Statistics Dashboard** - Advanced analytics
13. **Photo Gallery** - Event photos and media
14. **Parent Portal** - Guardian access for minors
15. **Training Logs** - Track training sessions
16. **Nutrition Plans** - Diet and nutrition tracking

---

## 🔧 Technical Stack

**Frontend:**
- React + TypeScript
- TailwindCSS
- Recharts (analytics)
- React Router (navigation)
- Radix UI (components)

**Backend:**
- Supabase (database, auth, storage)
- Hono (Edge Functions)
- KV Store (data persistence)

**Additional Services:**
- Supabase Storage (document uploads)
- Supabase Realtime (live updates)
- Supabase Edge Functions (API)

---

## 📝 Next Steps

1. ✅ Update categories to Sports-only
2. ⏭️ Create Coach pages and components
3. ⏭️ Create Athlete pages and components
4. ⏭️ Update authentication for Coach/Athlete roles
5. ⏭️ Implement athlete management system
6. ⏭️ Add attendance tracking
7. ⏭️ Add performance tracking
8. ⏭️ Implement requirements/documents upload
9. ⏭️ Update admin interface
10. ⏭️ Add team management

---

**Status:** 🟢 In Progress  
**Last Updated:** May 2026  
**Version:** 2.0.0 (Sports Management System)
