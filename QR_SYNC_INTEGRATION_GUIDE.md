# SportAxis QR Sync Integration Guide

## Overview

The SportAxis system now features seamless QR code-based synchronization between the web admin dashboard and the mobile judge app. Here's what was implemented:

---

## How It Works

### 1. **Event Creation (Web Admin)**
- Admin creates an event with:
  - Event name, schedule, start/end times
  - Departments (which groups/teams will be judged)
  - Scoring criteria (what will be evaluated and their weights)
- System auto-generates a unique `qr_token` (32-char random string)
- Admin can download/display the QR code for judges

### 2. **QR Code Structure**
The QR code encodes this URL format:
```
https://sportaxis.example.com/judge-qr/{eventId}/{qrToken}
```

Mobile app can parse this to extract:
- `eventId` - the event identifier
- `qrToken` - the authentication token (no login needed)

### 3. **Mobile App Scanning**
- Judge opens the SportAxis Judge app
- Taps the camera/scanner button
- Points at the QR code
- App automatically:
  1. Parses the event ID and token
  2. Calls `/api/event/session/{qrToken}` to fetch:
     - Event name, schedule, venue
     - Departments list
     - Scoring criteria
  3. Loads the scoring form with all criteria
  4. Caches data locally for offline support

### 4. **Scoring & Submission**
- Judge selects a department
- Enters scores for each criterion
- Submits scores via `/api/scores` endpoint
- App works offline—scores queue and sync when connection returns
- Web dashboard updates in real-time

---

## Backend Endpoints (Clean API)

### Public Endpoints (No Authentication)

#### **GET** `/api/event/session/{qrToken}`
Resolves a QR token to full event data and criteria.

**Response:**
```json
{
  "event": {
    "id": "uuid-123",
    "name": "Basketball Competition",
    "category": "Sports",
    "schedule": "2026-07-25",
    "startTime": "09:00",
    "endTime": "17:00",
    "venueName": "Main Stadium",
    "departments": ["Team A", "Team B", "Team C"],
    "judges": ["Judge1", "Judge2"],
    "participants": ["Judge1", "Judge2"],
    "status": "upcoming",
    "qrToken": "abc123..."
  },
  "criteria": [
    {
      "criteria_id": "1",
      "name": "Technique",
      "max_score": 10,
      "weight": 40
    },
    {
      "criteria_id": "2",
      "name": "Performance",
      "max_score": 10,
      "weight": 60
    }
  ]
}
```

#### **GET** `/api/event/{eventId}/criteria`
Refreshes criteria for an already-loaded event.

### Authenticated Endpoints

#### **POST** `/api/scores`
Submit scores from judges (works with or without auth).

**Request:**
```json
{
  "eventId": "uuid-123",
  "department": "Team A",
  "judgeId": "judge-id",
  "judgeName": "Judge Name",
  "scores": [
    { "criteria_id": "1", "value": 8.5 },
    { "criteria_id": "2", "value": 9.0 }
  ],
  "totalScore": 8.8,
  "method": "manual",
  "submittedViaQr": true
}
```

---

## Mobile App Configuration

### API Config File
Location: `SportAxisApp/src/config/api.config.ts`

```typescript
export const API_CONFIG = {
  // Update to your backend IP/domain:
  // - Android emulator: 10.0.2.2:8000
  // - iOS simulator: localhost:8000  
  // - Physical device: your-computer-ip:8000
  BASE_URL: 'http://10.85.243.3:8000/api',
  TIMEOUT: 15000,
} as const;
```

### Key Services

- **eventService**: Handles QR token to event data fetching
- **scoreService**: Submits scores to backend
- **qr-parser**: Parses QR codes in multiple formats
- **event.store**: Zustand state management for event data

---

## Web App Configuration

### QR Code Generation
Location: `SportAxisWeb/src/app/components/QRCodeModal.tsx`

Features:
- Display QR code in modal
- Show scoring URL
- Download QR as PNG
- Mobile app setup instructions

### Event Management
Location: `SportAxisWeb/src/app/pages/admin/Events.tsx`

- Create/edit events
- View QR code for each event (click QR button)
- Download QR codes for printing

---

## Data Sync Flow

```
Admin Creates Event
    ↓
Web Dashboard generates qr_token
    ↓
QR Code displays eventId + token
    ↓
Judge scans QR with phone
    ↓
Mobile app extracts token
    ↓
App calls /api/event/session/{token}
    ↓
Backend returns event + criteria
    ↓
Judge enters scores locally
    ↓
Judge submits scores
    ↓
Web dashboard receives and ranks
    ↓
Real-time leaderboard updates
```

---

## Testing Checklist

- [ ] Create an event in web admin with departments and criteria
- [ ] Click QR code button to view QR modal
- [ ] Download or screenshot the QR code
- [ ] Open mobile app (judge app)
- [ ] Tap scanner button
- [ ] Scan the QR code
- [ ] Verify app loads event name, departments, and criteria
- [ ] Enter scores for a department
- [ ] Submit scores
- [ ] Check web dashboard for submitted scores
- [ ] Test offline mode (disable network, submit, re-enable)

---

## Troubleshooting

### "Invalid QR code" on mobile app
- Check that the event's `qr_token` was generated (should auto-generate on create)
- Verify the QR code URL format in browser: `judge-qr/{id}/{token}`
- Ensure mobile app API config points to correct backend

### Scores not appearing in dashboard
- Check backend logs for `/api/scores` POST requests
- Verify event hasn't been marked "completed"
- Test API directly: `curl http://your-ip:8000/api/event/session/{token}`

### Mobile app can't reach backend
- Check API config in `api.config.ts` 
- Verify backend is running: `php artisan serve`
- For physical device: use computer's IP, not localhost
- Check firewall/network connectivity

---

## Files Modified

### Backend
- `app/Http/Controllers/Api/EventSessionController.php` - Added participants field
- `app/Models/Event.php` - Already properly configured

### Mobile App
- `src/config/api.config.ts` - Clean configuration
- `src/services/event.service.ts` - Enhanced with error handling
- `src/store/event.store.ts` - Added data access methods
- `src/utils/qr-parser.ts` - Updated documentation
- `src/types/index.ts` - Added participants field to EventSession

### Web Dashboard
- `src/app/components/QRCodeModal.tsx` - Recreated cleanly, removed broken Supabase references
- `src/app/pages/admin/Events.tsx` - Already has QR code button

---

## Next Steps

1. **Test the complete flow** end-to-end with a real device
2. **Configure production URLs** when deploying
3. **Add error handling UI** for failed QR scans
4. **Monitor backend logs** during initial rollout
5. **Collect user feedback** for improvements

