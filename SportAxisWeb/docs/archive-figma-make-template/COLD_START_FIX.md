<!-- ====================================================== -->
<!-- Edge Function Cold Start Fix Documentation             -->
<!-- Documents the cold start mitigation implementation     -->
<!-- Covers retry logic, warmup, and user experience        -->
<!-- ====================================================== -->

# Edge Function Cold Start Fix

## Problem

<!-- Background information about the issue -->

Supabase Edge Functions automatically scale to zero after a period of inactivity. When the server is inactive, the first incoming request may experience a delay while the function starts.

This behavior resulted in occasional **"Failed to fetch"** errors during the application's initial requests.

The issue was especially noticeable when:

- The application was opened after being idle.
- Users visited the public viewer page.
- Requests to `/leaderboard` timed out.
- Requests to `/categories` timed out.
- The Edge Function required several seconds to initialize.

Although this behavior is expected in serverless environments, it negatively affected the user experience.

---

<!-- ====================================================== -->
<!-- Solution Overview                                      -->
<!-- ====================================================== -->

## Solution Implemented

The application now includes several improvements that work together to minimize cold start delays and provide a smoother experience.

The implementation consists of:

- Automatic API retries
- Server warmup during application startup
- Improved error handling
- Automatic recovery
- User-friendly status messages

---

<!-- ====================================================== -->
<!-- Retry Mechanism                                        -->
<!-- ====================================================== -->

### 1. API Retry Mechanism (`src/app/services/api.ts`)

<!-- Automatically retries failed requests -->

The API service now retries network requests whenever a temporary connection failure occurs.

Features include:

- Automatic retry support
- Three retry attempts
- Progressive delay between retries
- Exponential backoff strategy
- Retry only for network-related failures
- Immediate failure for authentication or application errors

Retry sequence:

- Attempt 1
- Wait 1 second
- Attempt 2
- Wait 2 seconds
- Attempt 3
- Wait 3 seconds
- Final result returned

Only **"Failed to fetch"** errors trigger retries.

Errors such as:

- Authentication failures
- Permission denied
- Invalid requests
- HTTP 404
- HTTP 500

are returned immediately without retrying.

Example:

```typescript
// Retries network requests automatically
for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
        // Request execution
    } catch (error) {
        // Retry only when appropriate
    }
}
```

---

<!-- ====================================================== -->
<!-- Server Warmup                                          -->
<!-- ====================================================== -->

### 2. Server Warmup (`src/app/App.tsx`)

<!-- Wakes the Edge Function before real requests -->

To reduce the likelihood of cold start failures, the application performs a warmup request immediately after loading.

Warmup behavior:

- Executes during application startup
- Sends a request to the health endpoint
- Waits briefly before continuing
- Allows the Edge Function to finish initializing
- Does not interrupt the application if warmup fails

Example:

```typescript
await fetch(`${supabaseUrl}/functions/v1/make-server-21398c83/health`);
await new Promise(resolve => setTimeout(resolve, 500));
```

Benefits include:

- Faster first requests
- Reduced timeout errors
- Improved startup reliability
- Better user experience

---

<!-- ====================================================== -->
<!-- Error Handling                                         -->
<!-- ====================================================== -->

### 3. Smart Error Handling (`src/app/pages/public/Viewer.tsx`)

<!-- Displays helpful messages instead of technical errors -->

Instead of immediately displaying a connection error, the application detects when the server is likely waking up.

Features include:

- Automatic retry
- Retry counter
- Animated loading spinner
- Friendly status message
- Manual refresh button
- Automatic recovery

The interface clearly informs users that the server is starting rather than displaying confusing technical messages.

Example messages include:

- Server is waking up...
- Attempt 1 of 3
- Retrying automatically...

---

<!-- Viewer enhancements -->

#### Viewer Improvements

Implemented functionality:

- Automatic retry every three seconds
- Maximum of three retry attempts
- Retry counter
- Loading animation
- Manual refresh
- Success resets retry counter
- Different interface for temporary vs permanent errors

---

<!-- ====================================================== -->
<!-- Warmup Utility                                         -->
<!-- ====================================================== -->

### 4. Warmup Utility (`src/app/services/api.ts`)

A reusable warmup function has also been exported.

This utility can be called anywhere in the application before executing important API requests.

Example:

```typescript
export const warmupServer = async () => {
    await fetch(`${supabaseUrl}/functions/v1/make-server-21398c83/health`);
};
```

Advantages:

- Reusable
- Lightweight
- Easy to integrate
- Consistent behavior

---

<!-- ====================================================== -->
<!-- Application Flow                                       -->
<!-- ====================================================== -->

## How It Works

### Initial Application Load

Application startup sequence:

1. User opens the application.
2. Warmup request is sent.
3. Edge Function begins starting.
4. Application waits briefly.
5. Normal API requests begin.
6. Retry mechanism handles temporary failures.
7. Data loads successfully.

---

### Server Already Running

When the Edge Function is already active:

- Warmup completes instantly.
- API requests execute normally.
- No retries are necessary.
- Users experience immediate loading.

---

### Server Returns to Sleep

If the server becomes inactive again:

1. First request may fail.
2. Retry logic detects failure.
3. Wait 1 second.
4. Retry.
5. Wait 2 seconds.
6. Retry again.
7. Server becomes available.
8. Request succeeds.

Meanwhile, users see:

- Loading animation
- Retry counter
- Friendly explanation
- Manual refresh option

---

<!-- ====================================================== -->
<!-- User Experience                                        -->
<!-- ====================================================== -->

## User Experience

### Before the Fix

Problems included:

❌ Failed to fetch errors

❌ Manual browser refresh required

❌ Confusing technical messages

❌ Poor first impression

❌ No indication that the server was simply starting

---

### After the Fix

Improvements include:

✅ Friendly loading messages

✅ Automatic retries

✅ Animated loading indicator

✅ Manual refresh button

✅ Smooth recovery

✅ Less frustration for users

---

<!-- ====================================================== -->
<!-- Technical Details                                      -->
<!-- ====================================================== -->

## Technical Details

### Retry Strategy

Implementation details:

- Retry type: Exponential backoff
- Maximum attempts: 3
- Delay sequence:
  - 1000 ms
  - 2000 ms
  - 3000 ms
- Maximum wait time: 6 seconds

---

### Automatic Retry

Configuration:

- Three attempts
- Three-second interval
- Nine-second maximum duration
- Automatically resets after success

---

### Server Warmup

Configuration:

- Endpoint: `/health`
- Trigger: Application startup
- Warmup delay: 500 ms
- Safe fallback if unavailable

---

<!-- ====================================================== -->
<!-- Files Modified                                         -->
<!-- ====================================================== -->

## Files Changed

The following files were updated during this implementation.

### `src/app/services/api.ts`

Responsibilities:

- Retry mechanism
- Warmup utility
- Network handling improvements

---

### `src/app/App.tsx`

Responsibilities:

- Server warmup
- Startup initialization
- Application boot sequence

---

### `src/app/pages/public/Viewer.tsx`

Responsibilities:

- Retry interface
- Loading indicators
- Friendly error messages
- Manual refresh
- Retry counter

---

<!-- ====================================================== -->
<!-- Testing Procedures                                     -->
<!-- ====================================================== -->

## Testing

### Cold Start Testing

Recommended steps:

1. Leave the application idle.
2. Wait approximately 5–10 minutes.
3. Open the application.
4. Observe console output.
5. Verify successful data loading.
6. Confirm no permanent errors appear.

---

### Manual Retry Testing

Steps:

1. Disconnect temporarily.
2. Trigger an API request.
3. Press **Refresh Now**.
4. Confirm immediate retry.
5. Verify successful recovery.

---

### Automatic Retry Testing

Steps:

1. Simulate a cold start.
2. Wait without clicking.
3. Observe automatic retry.
4. Verify retry counter updates.
5. Confirm successful recovery.

---

<!-- ====================================================== -->
<!-- Benefits                                               -->
<!-- ====================================================== -->

## Benefits

The implementation provides several improvements.

### Reliability

- Reduced connection failures
- Better network resilience
- Automatic recovery

### Performance

- Faster startup
- Lower perceived latency
- Improved responsiveness

### User Experience

- Clear feedback
- Less confusion
- No unnecessary refreshes

### Maintainability

- Modular retry logic
- Reusable warmup utility
- Cleaner error handling
- Easier debugging

---

<!-- ====================================================== -->
<!-- Future Improvements                                    -->
<!-- ====================================================== -->

## Future Improvements

Potential enhancements include:

- Smarter exponential retry
- Background keep-alive pings
- Retry countdown timer
- Retry cancellation
- WebSocket keepalive
- Health monitoring dashboard
- Request queueing
- Analytics for cold starts
- Retry metrics logging
- Automatic performance monitoring

---

<!-- ====================================================== -->
<!-- Project Status                                         -->
<!-- ====================================================== -->

## Status

**Implementation Status**

✅ Fully implemented

✅ Successfully tested

✅ Integrated into application startup

✅ Ready for production deployment

---

## Impact

The implementation significantly improves application reliability by minimizing Edge Function cold start failures and automatically recovering from temporary connection issues without requiring user intervention.

---

<!-- ====================================================== -->
<!-- End of Cold Start Documentation                        -->
<!-- This document should be updated whenever retry or      -->
<!-- warmup logic changes in future releases.               -->
<!-- ====================================================== -->