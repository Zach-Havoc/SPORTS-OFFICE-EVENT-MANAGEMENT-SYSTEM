<!-- ====================================================== -->
<!-- SportAxisWeb Admin Dashboard Documentation             -->
<!-- Main README file for the Admin Dashboard module        -->
<!-- This file documents features, architecture, and usage  -->
<!-- ====================================================== -->

# SportAxisWeb Admin Dashboard

<!-- Project description -->
A professional, modern admin dashboard for the SportAxisWeb sports event management system.

---

<!-- ====================================================== -->
<!-- Overview Section                                       -->
<!-- ====================================================== -->

## Overview

The enhanced admin dashboard provides a comprehensive view of sports events, participants, judges, scoring, and OCR-assisted score submissions with real-time monitoring and analytics.

The dashboard is designed with usability, scalability, and maintainability in mind. It allows administrators to efficiently manage sports competitions while providing real-time insights into system activity.

---

<!-- ====================================================== -->
<!-- Main Features                                          -->
<!-- ====================================================== -->

## Features

<!-- Dashboard summary statistics -->

### 1. Summary Cards

The summary cards provide administrators with an instant overview of the entire system.

- **Total Events**: Overview of all events in the system
- **Active Events**: Currently ongoing events
- **Total Judges**: Registered judges count
- **Total Participants**: Participant count across all events
- **Scores Submitted**: Total score submissions
- **Completed Events**: Events that have finished
- **Upcoming Events**: Scheduled events
- **Total Points**: Points awarded to participants

---

<!-- Event management section -->

### 2. Event Monitoring Panel

Monitor all sports events from one centralized dashboard.

Features include:

- Real-time event status tracking
- Progress indicators for each event
- Judge assignment information
- Status badges (Upcoming / Ongoing / Completed)
- Event categorization
- Participant monitoring
- Competition progress visualization
- Easy event management

---

<!-- Charts section -->

### 3. Scoring Insights (Charts)

Charts provide graphical representations of scoring performance and statistics.

#### Bar Chart – Scores by Participant

- Displays top 8 participants by score
- Visual comparison of participant performance
- Easy ranking visualization

#### Donut Chart – Submission Status

- Shows distribution of submitted vs pending scores
- Quick overview of scoring completion
- Easy monitoring of judging progress

#### Line Chart – Score Submissions Over Time

- Tracks daily submission trends
- Identifies peak scoring periods
- Helps analyze judging efficiency

---

<!-- OCR monitoring -->

### 4. OCR Monitoring Panel

OCR (Optical Character Recognition) monitoring allows administrators to verify automated score extraction.

Features include:

- **OCR Submissions**: Count of OCR-based score submissions
- **Manual Submissions**: Count of manually entered scores
- **Average Confidence**: Overall OCR accuracy percentage
- **Low Confidence Alerts**: Flags submissions requiring review
- Image preview support
- Quick actions to review images and submissions

---

<!-- Activity tracking -->

### 5. Recent Activity Log

The activity log provides transparency by displaying all recent actions performed in the system.

Includes:

- Real-time activity tracking
- Score submissions
- Judge assignments
- Event updates
- System notifications
- User actions
- Timestamp formatting (e.g., "5m ago", "2h ago")

---

<!-- Quick actions -->

### 6. Quick Actions Panel

The quick action panel improves administrator productivity by providing shortcuts to commonly used features.

Available actions:

- Create Event
- Assign Judges
- Generate QR Code
- View Reports
- Manage Venues
- Generate Brackets
- System Settings
- View Leaderboard

---

<!-- ====================================================== -->
<!-- Project Structure                                      -->
<!-- ====================================================== -->

## Component Structure

```text
src/app/components/admin/
├── SummaryCard.tsx              # Reusable summary card component
├── EventTable.tsx               # Event monitoring table
├── OCRPanel.tsx                 # OCR monitoring panel
├── ActivityLog.tsx              # Recent activity log
├── QuickActions.tsx             # Quick action buttons
└── charts/
    ├── BarChartComponent.tsx    # Reusable bar chart
    ├── DonutChartComponent.tsx  # Reusable donut chart
    └── LineChartComponent.tsx   # Reusable line chart
```

Each component follows a modular architecture, making maintenance and future feature development significantly easier.

---

<!-- Dashboard routes -->

## Access

The project currently provides two administrator interfaces.

- **Standard Dashboard**: `/admin`
- **Enhanced Dashboard**: `/admin/dashboard-enhanced`

---

<!-- ====================================================== -->
<!-- Technologies Used                                      -->
<!-- ====================================================== -->

## Tech Stack

The dashboard is built using modern web technologies.

- **Frontend:** React with TypeScript
- **UI Framework:** Tailwind CSS
- **Charts:** Recharts
- **Icons:** Lucide React
- **Components:** Radix UI (shadcn/ui)

These technologies were selected for performance, maintainability, and developer productivity.

---

<!-- ====================================================== -->
<!-- Design Guidelines                                      -->
<!-- ====================================================== -->

## Design Principles

The interface follows modern dashboard design standards.

- Clean, minimal, and professional design
- Responsive grid layout
- Consistent color palette
- Soft shadows
- Rounded corners
- Modern typography
- Proper spacing
- Desktop-first approach
- Tablet-friendly interface
- Accessible component structure

---

<!-- ====================================================== -->
<!-- Integration                                             -->
<!-- ====================================================== -->

## Integration with Existing System

The enhanced dashboard integrates seamlessly with the existing SportAxisWeb platform.

Integration includes:

- Existing authentication (`AuthContext`)
- Existing routing structure
- Existing UI components
- Existing API services
- Existing database architecture
- Future Supabase compatibility

---

<!-- ====================================================== -->
<!-- Sample Data                                             -->
<!-- ====================================================== -->

## Dummy Data

Currently the dashboard uses demonstration data.

To connect real data:

1. Replace dummy arrays inside `DashboardEnhanced.tsx`
2. Connect to existing API services
3. Retrieve data from Supabase
4. Enable real-time synchronization
5. Test API responses
6. Remove mock objects

---

<!-- ====================================================== -->
<!-- Future Improvements                                     -->
<!-- ====================================================== -->

## Future Enhancements

Planned improvements include:

- Real-time Supabase integration
- WebSocket support
- Export reports (PDF & Excel)
- Advanced search
- Event filtering
- Date range selection
- Analytics dashboard
- Performance reports
- OCR improvements
- AI-assisted score validation
- Mobile optimization
- Dark mode support
- Push notifications
- Audit logs
- Multi-language support

---

<!-- ====================================================== -->
<!-- User Guide                                              -->
<!-- ====================================================== -->

## Usage

1. Login as an administrator.
2. Open `/admin/dashboard-enhanced`.
3. View dashboard statistics.
4. Monitor event progress.
5. Review OCR submissions.
6. Assign judges.
7. Track activities.
8. Generate reports.
9. View participant rankings.
10. Manage competitions.

---

<!-- ====================================================== -->
<!-- Developer Notes                                         -->
<!-- ====================================================== -->

## Notes

- Designed for academic capstone projects.
- Production-ready architecture.
- Modular React components.
- TypeScript best practices.
- Responsive layouts.
- Easy API integration.
- Maintainable project structure.
- Reusable UI components.
- Optimized for future scalability.
- Clean code organization.
- Easy onboarding for future developers.

---

<!-- ====================================================== -->
<!-- End of README                                           -->
<!-- Thank you for reading the project documentation.        -->
<!-- Future updates should be documented in this file.       -->
<!-- ====================================================== -->