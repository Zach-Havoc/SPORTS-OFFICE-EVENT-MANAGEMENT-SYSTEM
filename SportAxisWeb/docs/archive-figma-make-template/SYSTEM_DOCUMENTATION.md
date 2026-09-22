# University Event Competition Scoring System

## System Overview

A full-stack web application for managing university competitions with real-time scoring, rankings, and departmental performance tracking.

## Key Features

### 1. **Three Main Interfaces**

#### Public/Student Interface (No Login Required)
- **Live Events** - View ongoing competitions with real-time rankings
- **Departmental Leaderboard** - Overall rankings across all events with medals
- **Event History** - Browse past events with search and filter capabilities
- Auto-refreshing data (10-15 seconds)

#### Admin Panel (admin@university.edu / admin123)
- **Dashboard** - Overview of system statistics
- **Event Management** - Create/edit/delete events with:
  - Event name, category, schedule
  - Department assignments
  - Scoring criteria with custom weights
  - Status tracking (Upcoming/Ongoing/Completed)
- **Department Management** - Add/edit university departments
- **Category Management** - Manage event categories
- **Reports** - Generate and export event reports (PDF/CSV)
- **Event History** - View all past events

#### Judge Panel (judge@university.edu / judge123)
- **Event Selection** - View assigned ongoing events
- **Scoring Interface** - Mobile-responsive scoring form:
  - Select department
  - Enter scores for each criterion
  - Automatic weighted score calculation
  - Submit scores

### 2. **Real-Time Features**
- Automatic ranking calculations
- Live score updates
- Overall leaderboard with medal counts (Gold/Silver/Bronze)
- Polling-based auto-refresh (10-15 second intervals)

### 3. **Data Management**
- Role-based authentication (Admin/Judge)
- Supabase backend with KV store
- Persistent data storage
- Secure API endpoints

## Tech Stack

- **Frontend**: React + TypeScript, Tailwind CSS
- **Routing**: React Router (Data Mode)
- **UI Components**: Radix UI + shadcn/ui
- **Backend**: Supabase + Hono Web Server
- **Database**: Supabase KV Store
- **Authentication**: Supabase Auth

## Demo Accounts

The system auto-initializes with demo data on first load:

- **Admin**: admin@university.edu / admin123
- **Judge**: judge@university.edu / judge123

Demo departments and categories are also pre-loaded.

## How to Use

1. **As Public Viewer**: Open the app to see live events and leaderboard
2. **As Admin**: 
   - Login with admin credentials
   - Create departments and categories
   - Create events with participating departments
   - Set event status to "Ongoing" to enable scoring
   - View reports after event completion
3. **As Judge**:
   - Login with judge credentials
   - Select an ongoing event
   - Score each department based on criteria
   - Submit scores (automatically updates rankings)

## Key Pages

- `/` - Public live events viewer
- `/leaderboard` - Departmental leaderboard
- `/history` - Event history
- `/login` - Authentication
- `/admin` - Admin dashboard
- `/admin/events` - Event management
- `/admin/departments` - Department management
- `/admin/categories` - Category management
- `/admin/reports` - Reports and exports
- `/judge` - Judge dashboard
- `/judge/event/:id` - Scoring interface

## Data Structure

- **Events**: Name, category, schedule, status, departments, scoring criteria
- **Departments**: Name, abbreviation
- **Categories**: Name, description
- **Scores**: Per judge per department with weighted calculations
- **Rankings**: Auto-calculated from scores
- **Leaderboard**: Aggregated across all completed events

## Features Highlights

✅ Mobile-responsive design
✅ Real-time score updates
✅ Weighted scoring criteria
✅ Automatic ranking calculations
✅ Role-based access control
✅ Event status management
✅ Search and filter capabilities
✅ Export functionality (PDF/CSV)
✅ Medal tracking (Gold/Silver/Bronze)
✅ Event history and archival

## Future Enhancements (Not Implemented)

- QR code access for judges
- WebSocket for true real-time updates
- Email notifications
- Advanced analytics and charts
- Judge assignment system
- Multi-judge consensus scoring
- File attachments for events
- Print-friendly reports
