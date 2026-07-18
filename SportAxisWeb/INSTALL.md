# Installation Guide

Complete installation instructions for running BatStateU Competition Scoring System in your local IDE.

## Table of Contents
1. [Quick Install](#quick-install)
2. [Detailed Setup](#detailed-setup)
3. [Verification](#verification)
4. [First Run](#first-run)
5. [Troubleshooting](#troubleshooting)

---

## Quick Install

For experienced developers who want to get started immediately:

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your Supabase credentials

# 3. Verify setup (optional)
npm run verify

# 4. Start development
npm run dev
```

Open `http://localhost:5173` and login with:
- Admin: `admin@batstateu.edu.ph` / `admin123`
- Judge: `judge1@batstateu.edu.ph` / `judge123`

---

## Detailed Setup

### Prerequisites

Ensure you have these installed:

| Software | Minimum Version | Download |
|----------|----------------|----------|
| Node.js | 18.0.0 | [nodejs.org](https://nodejs.org) |
| npm | 8.0.0 | Comes with Node.js |
| Git | Any recent | [git-scm.com](https://git-scm.com) |

**Verify installation:**
```bash
node --version   # v18.0.0 or higher
npm --version    # v8.0.0 or higher
```

### Step 1: Get the Code

**Option A: Clone from Git**
```bash
git clone <repository-url>
cd <project-directory>
```

**Option B: Download ZIP**
1. Download ZIP from repository
2. Extract to your projects folder
3. Open terminal in extracted folder

### Step 2: Install Dependencies

```bash
npm install
```

This installs ~70 packages including:
- React & React Router
- TypeScript & Vite
- Tailwind CSS
- Supabase client
- UI components (Radix UI)
- And more...

**Expected output:**
```
added 823 packages in 45s
```

**Alternative package managers:**
```bash
# Using Yarn
yarn install

# Using pnpm (faster)
pnpm install
```

### Step 3: Configure Environment

**Create .env file:**
```bash
cp .env.example .env
```

**Edit .env** with your text editor:
```env
VITE_SUPABASE_PROJECT_ID=your_project_id_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

**Get Supabase Credentials:**

1. **Create Supabase Account**
   - Visit [supabase.com](https://supabase.com)
   - Click "Start your project"
   - Sign up (GitHub recommended)

2. **Create New Project**
   - Click "New Project"
   - Fill in:
     - **Name**: BatStateU Scoring
     - **Database Password**: (save this!)
     - **Region**: Select closest to you
   - Wait ~2 minutes for creation

3. **Get API Keys**
   - Go to **Settings** → **API**
   - Copy:
     - **Project URL**: `https://xxxxx.supabase.co`
     - **Project ID**: `xxxxx` (from URL)
     - **anon public key**: Long string starting with `eyJ...`

4. **Update .env**
   ```env
   VITE_SUPABASE_PROJECT_ID=xxxxx
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

### Step 4: Verify Setup

Run the verification script:
```bash
npm run verify
```

**Expected output:**
```
🔍 Verifying BatStateU Scoring System Setup...

✓ Checking Node.js version...
  ✓ Node.js v18.17.0 (OK)
✓ Checking dependencies...
  ✓ node_modules exists
✓ Checking environment variables...
  ✓ .env file exists
  ✓ Environment variables configured
...
✅ All checks passed! Your setup is ready.
```

If you see errors, refer to [Troubleshooting](#troubleshooting).

---

## First Run

### Start Development Server

```bash
npm run dev
```

**You should see:**
```
  VITE v6.3.5  ready in 1234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### Open in Browser

Visit: **http://localhost:5173**

**First load (~10-15 seconds):**
- System initializes database
- Creates demo users
- Generates sample events
- Sets up departments
- Creates test scores

You'll see a loading screen, then the public viewer homepage.

### Login

Click **"Login"** button and use:

**Admin Panel:**
```
Email: admin@batstateu.edu.ph
Password: admin123
```

**Judge Interface:**
```
Email: judge1@batstateu.edu.ph  
Password: judge123
```

**Public Viewer:** No login needed

### Explore the System

**As Admin:**
- View dashboard with analytics
- Manage events in "Events" page
- Access settings and reports
- Create new events

**As Judge:**
- View assigned events
- Score participants
- Submit scores in real-time

**As Public:**
- View live events
- See department leaderboards
- Check historical results

---

## Verification

### Check if Everything Works

1. **Homepage loads** ✓
2. **Can login as admin** ✓
3. **Can view dashboard** ✓
4. **Events page shows data** ✓
5. **Leaderboard displays** ✓

### Run Tests

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format

# Build for production (test)
npm run build
```

All commands should complete without errors.

---

## Troubleshooting

### Issue: Port 5173 Already in Use

**Error:**
```
Port 5173 is in use, trying another one...
```

**Solutions:**

**Option 1:** Kill the process
```bash
# Windows
netstat -ano | findstr :5173
taskkill /PID <process_id> /F

# Mac/Linux
lsof -ti:5173 | xargs kill -9

# Using npx (all platforms)
npx kill-port 5173
```

**Option 2:** Use different port
```bash
npm run dev -- --port 3000
```

### Issue: Cannot Connect to Supabase

**Error in browser console:**
```
Failed to fetch from Supabase
```

**Check:**
1. `.env` file exists in root directory
2. Values in `.env` are correct (no quotes needed)
3. Supabase project is active at [app.supabase.com](https://app.supabase.com)
4. No typos in project ID or API key

**Verify connection:**
```bash
# Check .env file
cat .env

# Should show:
VITE_SUPABASE_PROJECT_ID=xxxxx
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Issue: Module Not Found

**Error:**
```
Error: Cannot find module 'react'
```

**Solution:**
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: TypeScript Errors

**Error:**
```
TS2307: Cannot find module...
```

**Solutions:**

**Restart TypeScript server (VS Code):**
1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows)
2. Type: "TypeScript: Restart TS Server"
3. Press Enter

**Rebuild:**
```bash
# Clear TypeScript cache
rm -rf node_modules/.vite
npm run type-check
```

### Issue: Build Fails

**Error during build:**
```
Build failed in 1234ms
```

**Solution:**
```bash
# Clear all caches
rm -rf node_modules/.vite dist .vite

# Reinstall and rebuild
npm install
npm run build
```

### Issue: Blank Page

**Browser shows white screen**

**Check:**
1. Open browser console (F12)
2. Look for errors
3. Check Network tab for failed requests

**Common causes:**
- Missing `.env` file
- Invalid Supabase credentials
- JavaScript errors in console

**Solution:**
```bash
# Restart dev server
npm run dev
```

### Issue: Hot Reload Not Working

**Changes not reflecting in browser**

**Solutions:**
1. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Restart dev server: Stop with `Ctrl+C`, then `npm run dev`
3. Clear browser cache

### Need More Help?

If issues persist:

1. **Check logs:**
   - Browser console (F12)
   - Terminal where dev server runs
   
2. **Read documentation:**
   - [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Detailed setup
   - [README.md](./README.md) - Project overview
   - [QUICKSTART.md](./QUICKSTART.md) - Quick guide

3. **Search issues:**
   - Check GitHub issues
   - Search error messages

4. **Get support:**
   - Create GitHub issue with:
     - Error message
     - Steps to reproduce
     - System info (OS, Node version)
     - Screenshots if applicable

---

## Next Steps

✅ Installation complete! Here's what to do next:

### Immediate
1. Explore the admin dashboard
2. Try creating an event
3. Test judge scoring interface
4. View public leaderboard

### Learning
1. Read the code in `src/app/`
2. Understand the architecture
3. Review component structure
4. Study the API layer

### Customization
1. Change theme colors in `src/styles/theme.css`
2. Add your university logo
3. Customize department names
4. Modify event categories

### Development
1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit pull request

---

## Quick Reference

### Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview prod build

# Code Quality  
npm run lint             # Check code
npm run format           # Format code
npm run type-check       # Check types
npm run verify           # Verify setup

# Cleanup
rm -rf node_modules      # Remove deps
rm -rf dist              # Remove build
npm install              # Reinstall
```

### Default Ports

| Service | Port | URL |
|---------|------|-----|
| Dev Server | 5173 | http://localhost:5173 |
| Preview | 4173 | http://localhost:4173 |

### Important Files

| File | Purpose |
|------|---------|
| `.env` | Environment variables |
| `package.json` | Dependencies & scripts |
| `vite.config.ts` | Build configuration |
| `tsconfig.json` | TypeScript settings |
| `src/main.tsx` | Application entry |

---

## Success Checklist

- [ ] Node.js 18+ installed
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file configured
- [ ] Verification passed (`npm run verify`)
- [ ] Dev server running (`npm run dev`)
- [ ] Homepage loads at localhost:5173
- [ ] Can login as admin
- [ ] Dashboard displays correctly
- [ ] No console errors

**All checked?** Congratulations! 🎉 You're ready to develop!

---

**Questions?** Check [SETUP_GUIDE.md](./SETUP_GUIDE.md) or create an issue.

**Last Updated:** January 2026
