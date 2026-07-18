# Batangas State University - Competition Scoring System

A comprehensive university event competition scoring and ranking system with multiple events, judge scoring, real-time rankings, departmental leaderboards, and different user roles.

## Features

### 🎯 Core Functionality
- **Multi-Event Management** - Create and manage multiple competition events
- **Judge Scoring Interface** - Weighted scoring across multiple criteria
- **Real-Time Rankings** - Live score updates and departmental leaderboards
- **Role-Based Access** - Admin, Judge, and Public Viewer interfaces
- **QR Code Access** - Quick judge access via QR codes

### 🎨 User Interfaces
1. **Public Viewer** - Real-time scores and departmental leaderboards
2. **Admin Panel** - Complete event management and analytics
3. **Judge Scoring** - Intuitive scoring interface with criteria weighting

### 🔧 Technical Features
- Modern sidebar navigation with role-based menus
- Comprehensive analytics with interactive charts
- Advanced search, filtering, and bulk operations
- Real-time updates using Supabase subscriptions
- BatStateU theme with campus background
- Responsive design for all devices

## Prerequisites

- Node.js 18+ (recommended: use [nvm](https://github.com/nvm-sh/nvm))
- npm, yarn, or pnpm package manager
- Supabase account (free tier works)

## Local Development Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd <project-directory>

# Install dependencies (choose one)
npm install
# or
yarn install
# or
pnpm install
```

### 2. Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your Supabase credentials
# Get these from: https://app.supabase.com/project/_/settings/api
```

Your `.env` file should look like:
```env
VITE_SUPABASE_PROJECT_ID=your_project_id
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. The system uses a key-value store table (`kv_store_21398c83`) which will be auto-created
3. Copy your project credentials to `.env`

### 4. Run Development Server

```bash
# Start the development server
npm run dev
# or
yarn dev
# or
pnpm dev
```

The app will be available at `http://localhost:5173`

### 5. Initialize Demo Data

On first load, the system will automatically:
- Create demo users (admin, judges)
- Create sample events
- Create departments and categories
- Generate sample scores

**Default Login Credentials:**
- Admin: `admin@batstateu.edu.ph` / `admin123`
- Judge 1: `judge1@batstateu.edu.ph` / `judge123`
- Judge 2: `judge2@batstateu.edu.ph` / `judge123`

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── layout/       # Layout components (MainLayout)
│   │   │   ├── ui/           # shadcn/ui components
│   │   │   └── ...           # Other components
│   │   ├── context/          # React contexts (AuthContext)
│   │   ├── pages/            # Route pages
│   │   │   ├── admin/        # Admin panel pages
│   │   │   ├── judge/        # Judge interface pages
│   │   │   └── public/       # Public viewer pages
│   │   ├── services/         # API services
│   │   └── utils/            # Utility functions
│   ├── config/               # Configuration files
│   ├── styles/               # Global styles
│   └── main.tsx              # Application entry point
├── supabase/
│   └── functions/            # Edge functions
│       └── server/           # Backend server code
├── utils/                    # Shared utilities
├── index.html                # HTML entry point
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript configuration
└── package.json              # Dependencies and scripts
```

## Available Scripts

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint

# Type Checking
tsc --noEmit         # Check TypeScript types
```

## Tech Stack

### Frontend
- **React 18.3** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router 7** - Routing
- **Tailwind CSS 4** - Styling
- **shadcn/ui** - UI components
- **Radix UI** - Headless components
- **Lucide React** - Icons
- **Recharts** - Charts and analytics
- **Motion** - Animations
- **Sonner** - Toast notifications

### Backend
- **Supabase** - Backend as a service
  - PostgreSQL database
  - Edge Functions (Hono server)
  - Real-time subscriptions
  - Authentication
  - Storage

### Key Libraries
- `@supabase/supabase-js` - Supabase client
- `qrcode.react` - QR code generation
- `date-fns` - Date utilities
- `clsx` + `tailwind-merge` - Class name utilities

## Architecture

### Three-Tier Architecture
```
Frontend (React) → Server (Edge Functions) → Database (PostgreSQL)
```

### Key Patterns
- **Context API** - State management (AuthContext)
- **Route-based code splitting** - Optimized loading
- **Real-time subscriptions** - Live updates
- **Role-based access control** - Security

## Features by Role

### 👨‍💼 Admin
- Dashboard with analytics
- Create/edit/delete events
- Assign judges to events
- View comprehensive reports
- Export data
- Manage system settings

### 👨‍⚖️ Judge
- View assigned events
- Score participants with criteria
- QR code quick access
- Real-time submission

### 👀 Public Viewer
- View live events
- Department leaderboards
- Historical results
- Real-time score updates

## Troubleshooting

### Port Already in Use
```bash
# Kill the process using port 5173
npx kill-port 5173

# Or specify a different port
npm run dev -- --port 3000
```

### Module Not Found
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Supabase Connection Issues
- Verify your `.env` file has correct credentials
- Check Supabase project is active
- Ensure API keys are not expired

### Build Errors
```bash
# Clear Vite cache
rm -rf .vite node_modules/.vite

# Rebuild
npm run build
```

## Deployment

### Build for Production
```bash
npm run build
```

The `dist/` folder will contain optimized production files.

### Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Deploy to Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod
```

### Environment Variables
Don't forget to add environment variables in your deployment platform:
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_ANON_KEY`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Open an issue on GitHub
- Contact: support@batstateu.edu.ph

## Acknowledgments

- Batangas State University
- All contributors and maintainers
- Open source community

---

**Built with ❤️ for Batangas State University**
