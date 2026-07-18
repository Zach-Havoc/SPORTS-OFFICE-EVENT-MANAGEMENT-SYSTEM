Create a full-stack web-based system titled:

"A Web-Based System for University Event Competition Scoring and Departmental Performance Ranking"

### Tech Stack:

* Backend: Laravel (RESTful API)
* Frontend: React.js (with Vite or Create React App)
* Database: MySQL
* Use modern best practices (MVC for Laravel, component-based architecture for React)

---

### General System Description:

The system manages university competitions, allowing administrators to create events, judges to submit scores, and students to view real-time results and rankings.

The system must have **three main interfaces**:

1. Admin Panel
2. Judge Scoring Interface (WITHOUT QR code access for now)
3. Student/Public Viewer Interface

---

### Core Features to Implement:

#### 1. Event Management (Admin)

* Create, update, delete events
* Assign:

  * Event name
  * Category
  * Schedule
  * Participating departments
  * Scoring criteria (with weights if applicable)
* Event status (Upcoming, Ongoing, Completed)

---

#### 2. Judge Scoring Interface (NO QR CODE YET)

* Judges access scoring page via:

  * Login OR unique event link (no QR integration yet)
* Features:

  * View assigned event
  * View participants/departments
  * Input scores based on criteria
  * Submit scores
* UI must be:

  * Mobile-responsive
  * Simple and user-friendly

---

#### 3. Real-Time Score Processing

* Automatically compute:

  * Total scores per participant/department
  * Rankings per event
* Ensure:

  * Backend handles calculations
  * Results update instantly (use WebSockets, Laravel Echo, or polling)

---

#### 4. Student/Public Interface

* Public page (no login required)
* Features:

  * View ongoing events
  * See real-time scores and rankings
  * Auto-refresh or live updates (no manual refresh)
* Focus on:

  * Transparency
  * Clean UI dashboard

---

#### 5. Departmental Leaderboard

* Aggregate scores across all events
* Display:

  * Department rankings
  * Total accumulated points
* Must update in real-time

---

#### 6. Reports and Results

* Generate:

  * Event results summary
  * Individual scores
  * Department performance
* Export options:

  * PDF or CSV
* Admin-only access

---

#### 7. Event History and Monitoring

* Store all past events
* Features:

  * View previous results
  * Filter/search events
  * Review scores
* Accessible to:

  * Admin (full access)
  * Students (view-only)

---

### System Architecture Requirements:

* Laravel API handles:

  * Authentication (JWT or Sanctum)
  * Business logic
  * Database operations
* React handles:

  * UI/UX
  * API consumption (Axios/Fetch)
* Use:

  * RESTful API structure
  * Proper folder structure
  * Reusable components

---

### Database Design (include tables):

* users (admin, judge roles)
* departments
* events
* event_categories
* participants (or department_event mapping)
* criteria
* scores
* rankings

---

### Additional Requirements:

* Use role-based authentication
* Ensure validation on all inputs
* Use clean and modern UI (Tailwind CSS or Material UI)
* Make the system scalable and modular

---

### IMPORTANT NOTE:

DO NOT include or implement any QR Code functionality yet. The judge interface should only be accessible via login or direct link.
