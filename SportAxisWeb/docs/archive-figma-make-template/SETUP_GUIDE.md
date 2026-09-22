# Complete Setup Guide for Local IDE

This guide will help you set up the BatStateU Competition Scoring System on your local machine for development.

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn** or **pnpm**
- **Git** - [Download](https://git-scm.com/)
- **Code Editor** (VS Code recommended) - [Download](https://code.visualstudio.com/)

### Verify Installation
```bash
node --version   # Should be v18.0.0 or higher
npm --version    # Should be v8.0.0 or higher
git --version    # Any recent version
```

## Step-by-Step Setup

### 1. Clone the Repository

```bash
# Clone the project
git clone <your-repository-url>
cd <project-directory>

# Or if you downloaded as ZIP, extract and navigate to the folder
cd batstateu-scoring-system
```

### 2. Install Dependencies

Choose your preferred package manager:

```bash
# Using npm (comes with Node.js)
npm install

# OR using yarn
yarn install

# OR using pnpm (faster)
pnpm install
```

This will install all required dependencies (may take 2-5 minutes).

### 3. Create Environment File

```bash
# Copy the example environment file
cp .env.example .env
```

### 4. Set Up Supabase (Backend)

#### Option A: Create New Supabase Project (Recommended)

1. **Visit Supabase**
   - Go to [supabase.com](https://supabase.com)
   - Click "Start your project"
   - Sign up with GitHub (recommended) or email

2. **Create New Project**
   - Click "New Project"
   - Choose your organization (or create one)
   - Enter project details:
     - **Name**: BatStateU Scoring System
     - **Database Password**: Save this securely!
     - **Region**: Choose closest to you
   - Click "Create new project"
   - Wait ~2 minutes for setup to complete

3. **Get API Credentials**
   - Once created, go to **Settings** → **API**
   - Copy the following values:

   ```
   Project URL: https://xxxxx.supabase.co
   Project ID: xxxxx (from the URL)
   anon/public key: eyJhbGci... (long string)
   ```

4. **Update .env File**
   
   Edit `.env` and replace with your values:
   ```env
   VITE_SUPABASE_PROJECT_ID=xxxxx
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

#### Option B: Use Existing Supabase Project

If using the shared project credentials (for testing only):
```env
VITE_SUPABASE_PROJECT_ID=wgmsgpnvsugdyvgbpbgt
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5. Start Development Server

```bash
npm run dev
```

You should see:
```
  VITE v6.3.5  ready in 1234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 6. Open in Browser

Visit: `http://localhost:5173`

The system will automatically:
- Create the database table (`kv_store_21398c83`)
- Generate demo users
- Create sample events
- Add test data

**This may take 10-15 seconds on first load.**

### 7. Login with Demo Account

Once loaded, click "Login" and use:

**Admin Account:**
```
Email: admin@batstateu.edu.ph
Password: admin123
```

**Judge Account:**
```
Email: judge1@batstateu.edu.ph
Password: judge123
```

**Public View:** Just go to homepage (no login needed)

## IDE Setup (VS Code)

### 1. Install Recommended Extensions

VS Code will prompt you to install recommended extensions. Click "Install All".

Or install manually:
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features

### 2. Enable Format on Save

The project includes VS Code settings that will:
- Format code on save
- Auto-fix ESLint issues
- Enable Tailwind CSS autocomplete

These are already configured in `.vscode/settings.json`

## Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build

# Code Quality
npm run lint             # Check for code issues
npm run format           # Format code with Prettier
npm run type-check       # Check TypeScript types

# All together
npm run type-check && npm run lint && npm run build
```

## Project Structure Overview

```
batstateu-scoring-system/
├── src/
│   ├── app/
│   │   ├── components/       # Reusable components
│   │   │   ├── layout/       # Layout components
│   │   │   └── ui/           # UI components
│   │   ├── context/          # React contexts
│   │   ├── pages/            # Page components
│   │   │   ├── admin/        # Admin pages
│   │   │   ├── judge/        # Judge pages
│   │   │   └── public/       # Public pages
│   │   ├── services/         # API services
│   │   └── utils/            # Utilities
│   ├── config/               # Configuration
│   ├── styles/               # Global styles
│   └── main.tsx              # Entry point
├── supabase/
│   └── functions/            # Backend functions
├── .env                      # Environment variables
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
└── vite.config.ts            # Vite config
```

## Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Kill process on port 5173
npx kill-port 5173

# Or use different port
npm run dev -- --port 3000
```

#### 2. Module Not Found Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### 3. Cannot Connect to Supabase
- Check `.env` file exists in root directory
- Verify credentials are correct
- Check Supabase project is active at [app.supabase.com](https://app.supabase.com)

#### 4. TypeScript Errors
```bash
# Check for type errors
npm run type-check

# If many errors, might need to restart TypeScript server in VS Code:
# Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows)
# Type: "TypeScript: Restart TS Server"
```

#### 5. Build Errors
```bash
# Clear Vite cache
rm -rf .vite node_modules/.vite

# Rebuild
npm run build
```

#### 6. "figma:asset" Import Errors
These are special imports for Figma Make environment. They will work in production but may show errors in IDE. You can ignore them or replace with regular image imports for local development.

### Getting Help

If you encounter issues:
1. Check this guide's troubleshooting section
2. Review the [README.md](./README.md)
3. Check browser console for errors (F12)
4. Check terminal for server errors
5. Search existing GitHub issues
6. Create a new issue with error details

## Development Workflow

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Edit files in `src/`
   - Hot reload will update automatically

3. **Test your changes**
   - Check in browser
   - Run linter: `npm run lint`
   - Check types: `npm run type-check`

4. **Commit and push**
   ```bash
   git add .
   git commit -m "Add your feature"
   git push origin feature/your-feature-name
   ```

### Best Practices

- **Format code** before committing: `npm run format`
- **Fix linting** issues: `npm run lint`
- **Check types** regularly: `npm run type-check`
- **Test in browser** after changes
- **Use TypeScript** types properly
- **Follow existing** code patterns

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_PROJECT_ID` | Your Supabase project ID | `wgmsgpnvsugdyvgbpbgt` |
| `VITE_SUPABASE_ANON_KEY` | Public anonymous key | `eyJhbGci...` |

**Note:** Variables must start with `VITE_` to be accessible in the frontend.

## Next Steps

Now that your environment is set up:

1. ✅ Explore the **Admin Panel** - Create events, manage system
2. ✅ Test the **Judge Interface** - Score participants
3. ✅ View the **Public Interface** - See live rankings
4. ✅ Read the code - Understand the architecture
5. ✅ Make improvements - Add features, fix bugs
6. ✅ Share feedback - Report issues, suggest features

## Additional Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Vite Guide](https://vitejs.dev/guide/)

## Need Help?

- 📖 Check [README.md](./README.md) for project overview
- 🚀 See [QUICKSTART.md](./QUICKSTART.md) for quick setup
- 💬 Open an issue on GitHub
- 📧 Contact: support@batstateu.edu.ph

---

**Happy Coding! 🎉**

Last Updated: January 2026
