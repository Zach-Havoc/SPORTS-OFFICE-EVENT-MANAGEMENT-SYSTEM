# Quick Start Guide

Get the BatStateU Competition Scoring System running locally in 5 minutes!

## 🚀 Quick Setup (5 minutes)

### Step 1: Install Dependencies
```bash
npm install
# or
yarn install
# or
pnpm install
```

### Step 2: Setup Environment Variables
```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```env
VITE_SUPABASE_PROJECT_ID=your_project_id
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**Don't have Supabase yet?**
1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Create a new project (takes ~2 minutes)
4. Go to Settings → API
5. Copy the values to your `.env` file

### Step 3: Run the App
```bash
npm run dev
```

Visit: `http://localhost:5173`

### Step 4: Login
The system auto-creates demo accounts on first load:

**Admin Account:**
- Email: `admin@batstateu.edu.ph`
- Password: `admin123`

**Judge Account:**
- Email: `judge1@batstateu.edu.ph`
- Password: `judge123`

## ✅ You're Done!

The system will automatically:
- ✓ Create the database schema
- ✓ Generate demo events
- ✓ Create sample departments
- ✓ Add test data

## 📱 What to Try First

### As Admin (after logging in with admin account):
1. Click on **"Events"** in the sidebar
2. View the demo events created
3. Click **"Dashboard"** to see analytics
4. Try creating a new event with the **"New Event"** button

### As Public Viewer (logout or use incognito):
1. Visit the homepage to see live events
2. Click **"Leaderboard"** to see department rankings
3. Watch the live score ticker at the top

### As Judge:
1. Login with judge credentials
2. View your assigned events
3. Click on an event to start scoring

## 🔧 Common Issues

### "Cannot connect to Supabase"
- Check your `.env` file exists and has valid credentials
- Verify your Supabase project is active

### Port 5173 already in use
```bash
npx kill-port 5173
# or
npm run dev -- --port 3000
```

### Module not found errors
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📚 Next Steps

- Read the full [README.md](./README.md) for detailed information
- Explore the admin panel features
- Customize the theme colors
- Add your own departments and events

## 🆘 Need Help?

- Check the [README.md](./README.md) for troubleshooting
- Review the code comments for implementation details
- Open an issue on GitHub

---

**Happy Coding! 🎉**
