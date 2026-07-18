Enhance the existing system:

"A Web-Based System for University Event Competition Scoring and Departmental Performance Ranking"

### Tech Stack:

* Backend: Laravel
* Frontend: React.js
* Database: MySQL

---

### Feature to Implement:

Add **QR Code-based access for judges** after an event is created.

---

### Core Behavior:

#### 1. QR Code Generation (Admin Side)

* When an admin creates a new event:

  * Automatically generate a **unique QR code** for that event

* The QR code should encode:

  * A secure URL (e.g., /judge/event/{event_id}/{secure_token})

* Store:

  * event_id
  * unique access token
  * QR code image path (optional)

* Display the QR code in:

  * Admin dashboard (event details page)

* Allow:

  * Download QR code as image (PNG/SVG)

---

#### 2. Secure Judge Access via QR Code

* When the QR code is scanned:

  * Redirect to a **judge scoring page**
* The URL must:

  * Automatically identify the event
  * Validate the secure token
* No login required for judges when using QR

---

#### 3. Judge Scoring Interface (QR-based)

* After scanning:

  * Show event details:

    * Event name
    * Category
    * Participants/departments
    * Criteria

* Allow judges to:

  * Input scores per participant
  * Submit scores

* UI Requirements:

  * Mobile-first design
  * Simple and fast interaction
  * Prevent duplicate submissions (optional: limit per device/session)

---

#### 4. Security Measures

* Use a **unique, hard-to-guess token** per event (UUID or hashed string)
* Validate:

  * Token must match event
  * Token must be active (event not closed)
* Optional:

  * Expire QR access after event ends
  * Limit number of submissions per judge/device

---

#### 5. Backend Implementation (Laravel)

* Create:

  * QR generation service (use libraries like Simple QrCode)
* Routes:

  * /api/events → create event + generate token
  * /judge/event/{event_id}/{token} → validate access
* Controllers:

  * EventController (generate QR + token)
  * JudgeController (handle scoring)

---

#### 6. Frontend Implementation (React)

* Admin Panel:

  * Display QR code after event creation
* Judge Interface:

  * Public route for scanned URL
  * Fetch event data using token
  * Submit scores via API

---

### Database Updates:

Add fields to events table:

* qr_token (string, unique)
* qr_code_path (optional)

---

### Additional Requirements:

* Ensure real-time score updates still work
* Keep system modular and scalable
* Maintain clean API structure

---

### IMPORTANT CONDITION:

This feature replaces the previous restriction. Judges must now access the scoring interface primarily through QR code scanning instead of login or manual links.
