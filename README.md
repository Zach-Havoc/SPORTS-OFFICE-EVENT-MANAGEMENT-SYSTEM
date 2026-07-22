# Sports-Office-Management
SportAxis: A Web-Based Sports office Management Platform

## Group Members

| Name | Role |
|---|---|
| Saipoden Banto | Software Developer |
| Jhayvic Bugtong | Quality Specialist |
| Kier Andrei Catibog | Librarian |

---

## 1. Introduction / Summary

**Purpose:** SportAxis replaces the manual, paper-based processes of the BatStateU ARASOF Sports Office with a centralized web platform for student-athlete profiling, transaction/CMO tracking, attendance monitoring, tryout and intramural scheduling, QR/OCR-assisted scoring, automated ranking, notifications, and reporting.

**Scope:** A responsive web app (desktop/tablet/mobile) with five role-based interfaces — Administrator/Secretary, Coach/Trainer, Scoring Facilitator/Judge, Student-Athlete, and Public Viewer (read-only). Out of scope: financial accounting, medical diagnosis, scholarship computation, HR management, and document-authenticity verification.

**Definitions/Acronyms:**

| Term | Meaning |
|---|---|
| Athlete Ledger | Consolidated athlete record: attendance, scores, remarks, progress |
| CMO | Commission on Higher Education Memorandum Order |
| DFD / ERD | Data Flow Diagram / Entity-Relationship Diagram |
| OCR | Optical Character Recognition (score sheet extraction) |
| QR Code | Used for quick, secure access to scoring forms/events |
| Scrum | Agile framework used for iterative development |
| TAM | Technology Acceptance Model (theoretical basis) |

---

## 2. Overall Description

### System Architecture
Client-server, 3-layer design: **Presentation** (React.js, role-based UIs) → **Application** (Laravel/PHP on Apache; modules for auth, profiling, transactions, scheduling, OCR, scoring/ranking, notifications, reports) → **Data** (MySQL).

### Software Perspective & Functions
Core functions: user management, athlete/transaction management, training & event scheduling, QR/OCR-based scoring & reporting, and public viewing. Built iteratively via **Scrum** sprints.

### Use Case & Diagrams

| Actor | Key Use Cases |
|---|---|
| Administrator/Secretary | Login, manage schedules/athletes/scoring/rankings, generate QR, send notifications |
| Coach/Trainer | View athletes, record attendance, monitor progress |
| Scoring Facilitator/Judge | Scan QR, validate OCR data, submit scores |
| Student-Athlete | View schedules, attendance, performance; receive notifications |
| Public Viewer | View schedules, live scores, results, rankings (read-only) |

### Constraints, Limitations, Dependencies
- Limited to BatStateU ARASOF Sports Office; requires internet access.
- OCR-extracted scores always require manual review/confirmation before finalization.
- Depends on: React.js, Laravel, MySQL, Apache, Composer/npm, QR/OCR libraries.
- Pilot testing scope may limit generalizability of results.

---

## 3. Specific Requirements

### 3.1 System Features
- **User Management** – authentication, role-based access
- **Athlete & Transaction Management** – profiling, requirements, CMO/transaction tracking
- **Training & Event Management** – attendance, tryouts, automated scheduling w/ conflict handling
- **Scoring & Reporting** – QR/OCR score capture, validation, auto-computation, real-time ranking, reports
- **Public Viewing** – read-only schedules, scores, results, rankings, history

### 3.2 Interface Requirements
- **User Interfaces:** 5 role-based portals (see table above), responsive across devices
- **Hardware:** standard I/O devices; smartphone (≥12MP) for OCR & QR
- **Software:** React.js/JS/HTML/CSS (front-end); Laravel/PHP + Apache (back-end); MySQL (DB); Tesseract OCR; Laravel QR package
- **Communication:** HTTPS/SSL; REST API (Postman-tested); optional email/SMS notifications

### 3.3 Non-Functional Requirements
| Category | Requirement |
|---|---|
| Security | Role-based access, encrypted sessions, SSL/HTTPS |
| Usability | Responsive, accessible across devices |
| Performance | Fast, accurate processing under load |
| Reliability | Stable under concurrent multi-user access |
| Scalability | Shared hosting (pilot) → cloud/VPS (scale) |
| Maintainability | Modular Laravel structure (MVC) |
| Data Integrity | Relational schema, consistent linkages |

### 3.4 Other Requirements

**Dev Environment:** Windows 11, Chrome/Edge, XAMPP/Apache, Laravel, React.js, MySQL, Composer/npm, VS Code, Git, Postman, Lucidchart/Draw.io

**Deployment Environment:** Ubuntu Server 22.04, Apache, PHP 8.2+, MySQL 8.0, Supervisor, Let's Encrypt SSL, Git

**Hardware:** Dev — ≥2.0GHz/8GB RAM/256GB SSD + mobile device + scanner. Deployment — ≥2.5GHz/8GB RAM/100GB SSD server, backup storage, ≥50Mbps network, firewall.

**Maintenance:** Weekly DB/file backups, active-use monitoring, semestral account review, monthly security checks, updates as needed.

**Evaluation:** Functional/integration/system/performance testing, OCR validation checklist, response-time benchmarking (login, scoring, ranking, reports).

---

**Tech Stack:** React.js · Laravel (PHP) · MySQL · Apache
