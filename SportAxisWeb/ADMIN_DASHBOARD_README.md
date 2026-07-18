# SportAxisWeb Admin Dashboard

A professional, modern admin dashboard for the SportAxisWeb sports event management system.

## Overview

The enhanced admin dashboard provides a comprehensive view of sports events, participants, judges, scoring, and OCR-assisted score submissions with real-time monitoring and analytics.

## Features

### 1. Summary Cards
- **Total Events**: Overview of all events in the system
- **Active Events**: Currently ongoing events
- **Total Judges**: Registered judges count
- **Total Participants**: Participant count across all events
- **Scores Submitted**: Total score submissions
- **Completed Events**: Events that have finished
- **Upcoming Events**: Scheduled events
- **Total Points**: Points awarded to participants

### 2. Event Monitoring Panel
- Real-time event status tracking
- Progress indicators for each event
- Judge assignment information
- Status badges (Upcoming / Ongoing / Completed)
- Event categorization

### 3. Scoring Insights (Charts)

#### Bar Chart - Scores by Participant
- Displays top 8 participants by score
- Visual comparison of participant performance

#### Donut Chart - Submission Status
- Shows distribution of submitted vs pending scores
- Quick overview of scoring completion

#### Line Chart - Score Submissions Over Time
- Tracks daily submission trends
- Identifies peak scoring periods

### 4. OCR Monitoring Panel
- **OCR Submissions**: Count of OCR-based score submissions
- **Manual Submissions**: Count of manually entered scores
- **Average Confidence**: Overall OCR accuracy percentage
- **Low Confidence Alerts**: Flags submissions requiring review
- Quick actions to review images and submissions

### 5. Recent Activity Log
- Real-time activity tracking
- Score submissions
- Judge assignments
- Event updates
- System notifications
- Timestamp formatting (e.g., "5m ago", "2h ago")

### 6. Quick Actions Panel
- Create Event
- Assign Judges
- Generate QR Code
- View Reports
- Manage Venues
- Generate Brackets
- System Settings
- View Leaderboard

## Component Structure

```
src/app/components/admin/
├── SummaryCard.tsx              # Reusable summary card component
├── EventTable.tsx              # Event monitoring table
├── OCRPanel.tsx                # OCR monitoring panel
├── ActivityLog.tsx             # Recent activity log
├── QuickActions.tsx            # Quick action buttons
└── charts/
    ├── BarChartComponent.tsx   # Reusable bar chart
    ├── DonutChartComponent.tsx # Reusable donut/pie chart
    └── LineChartComponent.tsx  # Reusable line chart
```

## Access

- **Standard Dashboard**: `/admin`
- **Enhanced Dashboard**: `/admin/dashboard-enhanced`

## Tech Stack

- **Frontend**: React with TypeScript
- **UI Framework**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **Components**: Radix UI (shadcn/ui)

## Design Principles

- Clean, minimal, and professional design
- Grid-based responsive layout
- Consistent color theme (blue, dark gray, white with red accents)
- Cards with soft shadows and rounded corners
- Desktop-first, tablet-friendly responsive design
- Proper spacing and typography

## Integration with Existing System

The enhanced dashboard integrates seamlessly with the existing SportAxisWeb system:

- Uses existing authentication (`AuthContext`)
- Follows existing routing structure
- Compatible with existing UI components
- Uses existing data services (can be connected to real API)

## Dummy Data

The enhanced dashboard currently uses dummy data for demonstration purposes. To connect to real data:

1. Replace dummy data arrays in `DashboardEnhanced.tsx` with API calls
2. Use existing services from `src/app/services/api.ts`
3. Connect to Supabase backend for real-time data

## Future Enhancements

- Real-time data integration with Supabase
- WebSocket support for live updates
- Export functionality for reports
- Advanced filtering and search
- Custom date range selection
- Drill-down capabilities for charts
- Mobile app optimization

## Usage

1. Navigate to `/admin/dashboard-enhanced` after logging in as admin
2. View real-time statistics and monitoring
3. Use quick actions for common tasks
4. Monitor OCR submissions and confidence levels
5. Track recent system activity

## Notes

- The dashboard is designed for academic capstone projects but production-ready
- All components are modular and reusable
- Follows React best practices with TypeScript
- Responsive design works on desktop and tablet devices
