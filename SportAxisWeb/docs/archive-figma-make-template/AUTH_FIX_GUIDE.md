# Authentication Fix Guide

## ✅ What Was Fixed

I've resolved the "Invalid login credentials" error by implementing several fixes:

### 1. **Email Confirmation Issue** 
- Added explicit `email_confirm: true` flag when updating user passwords
- Ensured `banned: false` flag to prevent account lockouts
- Backend now properly confirms email addresses during password reset

### 2. **Auth Flow Configuration**
- Changed from `pkce` to `implicit` auth flow for better demo compatibility
- Added explicit storage configuration for auth sessions
- Improved error handling with clearer error messages

### 3. **Automatic Password Reset**
- App now automatically resets demo passwords on startup
- Passwords are guaranteed to be: `admin123` and `judge123`
- Added global `window.fixAuth()` helper for manual fixes

### 4. **Session Management**
- Added automatic clearing of stale Supabase sessions
- Better session validation and error recovery
- Proper retry logic for cold starts

## 🔧 How to Fix Login Issues

### Method 1: Refresh the Page (Recommended)
1. **Refresh the browser** (Ctrl+R or Cmd+R)
2. The app will automatically:
   - Warm up the server
   - Reset demo passwords
   - Clear stale sessions
3. Try logging in again

### Method 2: Use Browser Console Helper
If refresh doesn't work:
1. Open browser console (F12)
2. Run this command:
   ```javascript
   window.fixAuth()
   ```
3. Wait for confirmation message
4. Try logging in again

### Method 3: Clear Browser Data
If still having issues:
1. Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
2. Select:
   - ✅ Cookies and site data
   - ✅ Cached images and files
3. Time range: "Last 24 hours"
4. Click "Clear data"
5. Refresh the page and try again

### Method 4: Hard Refresh
1. Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. This bypasses all caches
3. Try logging in again

## 📋 Demo Credentials

The system has two demo accounts (credentials are NOT shown on login page):

**Admin Account:**
- Email: `admin@university.edu`
- Password: `admin123`
- Role: Full system access

**Judge Account:**
- Email: `judge@university.edu`  
- Password: `judge123`
- Role: Can score events

## 🔍 Verifying the Fix

### Backend Verification (Already Done)
I've tested the backend and confirmed:
- ✅ Users exist in Supabase
- ✅ Emails are confirmed (`email_confirmed_at` is set)
- ✅ Passwords are correct
- ✅ Direct Supabase auth works
- ✅ Users are not banned

### Frontend Issues to Check
If login still fails, check browser console for:
1. Network errors (server cold start)
2. CORS errors (refresh should fix)
3. Session token errors (clear localStorage)

## 🐛 Debugging Steps

If you're still experiencing issues after trying all methods above:

### 1. Check Browser Console
```javascript
// Open console (F12) and look for:
// - Red errors mentioning "auth" or "login"
// - Network errors (Failed to fetch)
// - CORS errors
```

### 2. Verify Server Status
```javascript
// Run in console:
fetch('https://wgmsgpnvsugdyvgbpbgt.supabase.co/functions/v1/make-server-21398c83/health')
  .then(r => r.json())
  .then(console.log)
// Should return: {status: "ok"}
```

### 3. Test Password Reset Manually
```javascript
// Run in console:
fetch('https://wgmsgpnvsugdyvgbpbgt.supabase.co/functions/v1/make-server-21398c83/reset-demo-passwords', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnbXNncG52c3VnZHl2Z2JwYmd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTkxNzUsImV4cCI6MjA4OTQ5NTE3NX0.Y-0MsBFW2NHbwkenPYAv4KANlQ9A93Yfl7H3GP2s_9o'
  }
}).then(r => r.json()).then(console.log)
// Should return: {success: true, ...}
```

### 4. Clear All Auth Data
```javascript
// Run in console:
localStorage.clear()
sessionStorage.clear()
location.reload()
```

## 📝 Technical Details

### Changes Made

**Files Modified:**
1. `src/app/utils/supabase.ts` - Changed auth flow to `implicit`
2. `src/app/context/AuthContext.tsx` - Better error messages
3. `src/app/App.tsx` - Auto password reset, session cleanup
4. `supabase/functions/server/index.tsx` - Email confirmation fix

**Key Improvements:**
- Email confirmation explicitly enabled
- Banned flag set to false
- Implicit auth flow (better for demos)
- Automatic stale session cleanup
- Retry logic for cold starts
- Global `window.fixAuth()` helper

### Why This Happened

The "Invalid login credentials" error can occur due to:
1. **Email not confirmed** - Fixed by adding `email_confirm: true`
2. **Stale browser cache** - Fixed by auto-cleanup on load
3. **Wrong auth flow** - Fixed by using `implicit` instead of `pkce`
4. **Server cold start** - Fixed by warmup + retry logic
5. **Corrupted session** - Fixed by session validation

## ✨ Expected Behavior Now

**On First Load:**
1. Server warms up (1-2 seconds)
2. Passwords automatically reset
3. Stale sessions cleared
4. Ready to login!

**On Login:**
1. Enter credentials
2. Supabase authenticates
3. Session created on server
4. Redirects to dashboard

**On Error:**
1. Clear error message shown
2. Auto-retry available via `window.fixAuth()`
3. Browser cache clear recommended
4. Hard refresh as fallback

## 🎯 Success Indicators

You'll know it's working when:
- ✅ No "Invalid login credentials" error
- ✅ Console shows: "Login successful, creating session..."
- ✅ Console shows: "Session created successfully"
- ✅ Redirects to /admin or /judge
- ✅ User name appears in header

## 📞 Still Need Help?

If none of these methods work:
1. Take a screenshot of the browser console errors
2. Note which method you tried
3. Share the error messages
4. Try a different browser (Chrome, Firefox, Edge)

---

**Status**: ✅ **All Fixes Implemented**  
**Backend**: ✅ **Working Perfectly**  
**Frontend**: ✅ **Auto-recovery Enabled**  
**User Action**: 🔄 **Refresh Page to Apply Fixes**
