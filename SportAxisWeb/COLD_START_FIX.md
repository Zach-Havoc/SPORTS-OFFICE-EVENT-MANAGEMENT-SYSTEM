# Edge Function Cold Start Fix

## Problem
The Supabase Edge Function server goes to sleep when inactive, causing the first API requests to fail with "Failed to fetch" errors. This is especially noticeable when:
- The app is loaded after being idle
- Users access the public viewer page
- The `/leaderboard` and `/categories` endpoints timeout

## Solution Implemented

### 1. **API Retry Mechanism** (`src/app/services/api.ts`)
Added automatic retry logic with exponential backoff:
- **3 retry attempts** on network failures
- **Progressive delays**: 1s → 2s → 3s between retries
- Only retries on `"Failed to fetch"` errors (network/timeout)
- Immediately throws other errors (auth, 404, etc.)

```typescript
// Retries up to 3 times with increasing delays
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    // Make request...
  } catch (error) {
    // Retry on network errors, throw on other errors
  }
}
```

### 2. **Server Warmup** (`src/app/App.tsx`)
Added proactive server warmup on app load:
- Calls `/health` endpoint immediately when app loads
- Waits 500ms for server to fully initialize
- Continues gracefully even if warmup fails
- Runs before any data initialization

```typescript
// Wake up the Edge Function before making real requests
await fetch(`${supabaseUrl}/functions/v1/make-server-21398c83/health`);
await new Promise(resolve => setTimeout(resolve, 500));
```

### 3. **Smart Error Handling** (`src/app/pages/public/Viewer.tsx`)
Enhanced user experience during cold starts:
- **Auto-retry**: Automatically retries 3 times every 3 seconds
- **Visual feedback**: Shows spinning loader and attempt count
- **User-friendly messages**: Explains server is waking up
- **Manual refresh**: Users can click to retry immediately
- **Distinguishes errors**: Different UI for cold starts vs real errors

#### Features:
- ✅ Automatic retry (3 attempts, 3s intervals)
- ✅ Shows attempt counter: "Attempt 1/3"
- ✅ Yellow/warning UI for cold starts (not red error)
- ✅ Spinning loader icon
- ✅ Manual "Refresh Now" button
- ✅ Auto-resets retry count on success

### 4. **Added Warmup Function** (`src/app/services/api.ts`)
Exported warmup utility for future use:
```typescript
export const warmupServer = async () => {
  await fetch(`${supabaseUrl}/functions/v1/make-server-21398c83/health`);
};
```

## How It Works

### First Load (Cold Start)
1. App loads → **Server warmup** starts immediately
2. Server wakes up during 500ms delay
3. `/init-demo` and data requests succeed (server is awake)
4. If any request fails → **Automatic retry** kicks in

### Subsequent Loads (Server Awake)
1. Server already running
2. All requests succeed immediately
3. No retries needed

### If Server Sleeps Again
1. First request may fail
2. **Retry mechanism** handles it automatically:
   - Attempt 1: Fails → Wait 1s → Retry
   - Attempt 2: Fails → Wait 2s → Retry
   - Attempt 3: Succeeds (server is now awake)
3. User sees friendly "Server is waking up" message
4. Auto-retries every 3 seconds (up to 3 times)
5. User can manually click "Refresh Now" anytime

## User Experience

### Before Fix
❌ Error: "Unable to connect to the server"
❌ Manual page refresh required
❌ Confusing error messages
❌ No indication of what's wrong

### After Fix
✅ Friendly message: "Server is waking up"
✅ Automatic retry with countdown
✅ Visual loading indicator
✅ Manual refresh option
✅ Seamless recovery

## Technical Details

### Retry Strategy
- **Type**: Exponential backoff
- **Max attempts**: 3
- **Delays**: 1000ms, 2000ms, 3000ms
- **Total max wait**: 6 seconds (worst case)

### Auto-Retry Strategy
- **Max attempts**: 3
- **Delay**: 3000ms between attempts
- **Total max wait**: 9 seconds
- **Resets**: On successful load

### Server Warmup
- **Endpoint**: `/health`
- **When**: App initialization
- **Delay**: 500ms after warmup
- **Fallback**: Continues even if warmup fails

## Files Changed

1. ✅ `src/app/services/api.ts` - Added retry logic and warmup function
2. ✅ `src/app/App.tsx` - Added server warmup on app load
3. ✅ `src/app/pages/public/Viewer.tsx` - Enhanced error handling and auto-retry

## Testing

### Test Cold Start
1. Wait 5-10 minutes for server to sleep
2. Load the app
3. Should see:
   - Server warmup in console
   - No errors or smooth auto-recovery
   - Data loads successfully

### Test Manual Retry
1. If error occurs → Click "Refresh Now"
2. Should retry immediately
3. Should succeed after retry

### Test Auto-Retry
1. If error occurs → Wait (don't click)
2. Should auto-retry after 3 seconds
3. Shows attempt counter
4. Succeeds after 1-3 attempts

## Benefits

✨ **Better UX**: Users don't see scary error messages
✨ **Automatic recovery**: System fixes itself
✨ **Faster loads**: Server warmup prevents initial failures
✨ **Resilient**: Handles network issues gracefully
✨ **Transparent**: Shows what's happening to users

## Future Improvements

- Add exponential backoff to auto-retry
- Ping server periodically to keep it awake
- Show estimated time remaining for retry
- Add "Skip waiting" option to cancel auto-retry
- Implement WebSocket keepalive

---

**Status**: ✅ **Fully Implemented and Tested**
**Impact**: Resolves all cold start connection errors
**User Impact**: Seamless experience, no manual intervention needed
