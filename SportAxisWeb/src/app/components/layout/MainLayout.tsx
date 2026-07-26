import { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import {
  Trophy,
  LogOut,
  LayoutDashboard,
  Menu,
  X,
  Calendar,
  Settings,
  Users,
  FileText,
  BarChart3,
  History,
  Gavel,
  Eye,
  Medal,
  Home,
  Shield,
  User,
  ChevronRight,
  Megaphone,
  ClipboardList,
  TrendingUp,
  UserPlus,
  MapPin,
} from 'lucide-react';
import { cn } from '../ui/utils';
import bgImage from 'figma:asset/d00b81b29bccf92203e98ef7d2b2d2f18d87f4b1.png';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import Loading from '../Loading';

export default function MainLayout() {
  const { user, logout, loading } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Successfully logged out. See you next time!');
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout. Please try again.');
    }
  };

  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  // Define navigation items based on user role
  const getNavigationItems = () => {
    if (!user) {
      return {
        main: [
          { name: 'Live Events', path: '/', icon: Home },
          { name: 'Leaderboard', path: '/leaderboard', icon: Medal },
          { name: 'History', path: '/history', icon: History },
          { name: 'Announcements', path: '/announcements', icon: Megaphone },
        ],
        bottom: []
      };
    }

    if (user.role === 'admin') {
      return {
        main: [
          { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
          { name: 'Events', path: '/admin/events', icon: Calendar },
          { name: 'Venues', path: '/admin/venues', icon: MapPin },
          { name: 'Bracketing', path: '/admin/bracketing', icon: Trophy },
          { name: 'Coaches', path: '/admin/coaches', icon: Users },
          { name: 'Reports', path: '/admin/reports', icon: BarChart3 },
          { name: 'History', path: '/admin/history', icon: History },
        ],
        bottom: [
          { name: 'Registration Codes', path: '/admin/registration-codes', icon: Shield },
          { name: 'Settings', path: '/admin/settings', icon: Settings },
        ]
      };
    }

    if (user.role === 'coach') {
      return {
        main: [
          { name: 'Dashboard', path: '/coach', icon: LayoutDashboard },
          { name: 'My Athletes', path: '/coach/athletes', icon: Users },
          { name: 'Attendance', path: '/coach/attendance', icon: ClipboardList },
          { name: 'Performance', path: '/coach/performance', icon: TrendingUp },
          { name: 'Requirements', path: '/coach/requirements', icon: FileText },
          { name: 'Announcements', path: '/coach/announcements', icon: Megaphone },
        ],
        bottom: [
          { name: 'Settings', path: '/settings/account', icon: Settings },
        ]
      };
    }

    if (user.role === 'athlete') {
      return {
        main: [
          { name: 'Dashboard', path: '/athlete', icon: LayoutDashboard },
          { name: 'My Schedule', path: '/athlete/schedule', icon: Calendar },
          { name: 'Performance', path: '/athlete/performance', icon: TrendingUp },
          { name: 'Requirements', path: '/athlete/requirements', icon: FileText },
        ],
        bottom: [
          { name: 'Settings', path: '/settings/account', icon: Settings },
        ]
      };
    }

    if (user.role === 'judge') {
      return {
        main: [
          { name: 'My Events', path: '/judge', icon: Gavel },
        ],
        bottom: [
          { name: 'Settings', path: '/settings/account', icon: Settings },
        ]
      };
    }

    return { main: [], bottom: [] };
  };

  const navigation = getNavigationItems();
  const isActive = (path: string) => {
    // Public root — exact match only
    if (path === '/') return location.pathname === '/';

    // Role dashboard roots: exact match so /coach never highlights when on /coach/athletes
    const dashboardRoots = ['/admin', '/coach', '/athlete', '/judge'];
    if (dashboardRoots.includes(path)) return location.pathname === path;

    // All other nav items: current path must start with this path followed by
    // '/' or end exactly here — prevents /admin/events matching /admin/events-foo
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Show loading screen
  if (loading) {
    return <Loading message="Loading application..." />;
  }

  return (
    <div className="min-h-screen relative">
      {/* Background Image with Gradient Overlay */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/10 via-white/5 to-gray-900/10 backdrop-blur-[2px]"></div>
      </div>

      {/* Main Container */}
      <div className="relative z-10 flex h-screen overflow-hidden">
        {/* Mobile Menu Overlay for public users */}
        {!user && mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 sm:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Menu Panel for public users */}
        {!user && (
          <aside className={cn(
            "fixed sm:hidden inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl transition-transform duration-300",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}>
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center space-x-3">
                  <Trophy className="h-6 w-6 text-red-600" />
                  <div>
                    <h2 className="font-bold text-lg text-gray-900">BatStateU</h2>
                    <p className="text-xs text-gray-600">Competition System</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-700" />
                </button>
              </div>

              {/* Navigation */}
              <nav className="flex-1 overflow-y-auto py-6 px-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="space-y-1">
                  {navigation.main.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200",
                          active 
                            ? "bg-red-50 text-red-700" 
                            : "text-gray-700 hover:bg-gray-50"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </nav>

              {/* Login Button */}
              <div className="p-4 border-t">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-red-600 hover:bg-red-700">
                    Login
                  </Button>
                </Link>
              </div>
            </div>
          </aside>
        )}

        {/* Sidebar - Only show for logged-in users */}
        {user && (
          <>
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
              <div 
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Sidebar */}
            <aside className={cn(
              "fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-gradient-to-b from-red-700 to-red-800 text-white shadow-2xl transition-all duration-300",
              sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
              sidebarCollapsed ? "w-20" : "w-72"
            )}>
              {/* Sidebar Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                {!sidebarCollapsed && (
                  <div className="flex items-center space-x-3">
                    <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                      <Trophy className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg">BatStateU</h2>
                      <p className="text-xs text-red-100">Competition System</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => sidebarCollapsed ? setSidebarCollapsed(false) : setSidebarOpen(false)}
                  className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* User Info */}
              <div className={cn(
                "p-6 border-b border-white/10",
                sidebarCollapsed && "p-4"
              )}>
                <div className={cn(
                  "flex items-center space-x-3",
                  sidebarCollapsed && "justify-center"
                )}>
                  <div className="bg-white/20 backdrop-blur-sm p-2 rounded-full">
                    <User className="h-5 w-5" />
                  </div>
                  {!sidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{user.name}</p>
                      <p className="text-xs text-red-100 capitalize">
                        {user.role === 'coach' 
                          ? [
                              user.department?.split(' ').filter(w => !['of', 'and', 'the', 'for', 'in', 'at'].includes(w.toLowerCase())).map(w => w[0]).join('').toUpperCase(),
                              user.genderCategory ? `${user.genderCategory}'s` : null,
                              user.sport,
                              'Coach'
                            ].filter(Boolean).join(' ')
                          : user.role}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 overflow-y-auto py-6 px-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="space-y-1">
                  {navigation.main.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group",
                          active 
                            ? "bg-white text-red-700 shadow-lg" 
                            : "text-red-50 hover:bg-white/10 hover:text-white",
                          sidebarCollapsed && "justify-center px-2"
                        )}
                      >
                        <Icon className={cn(
                          "h-5 w-5",
                          active ? "text-red-700" : "text-red-100 group-hover:text-white"
                        )} />
                        {!sidebarCollapsed && (
                          <span className="font-medium">{item.name}</span>
                        )}
                        {!sidebarCollapsed && active && (
                          <ChevronRight className="h-4 w-4 ml-auto" />
                        )}
                      </Link>
                    );
                  })}
                </div>

                {/* Bottom Navigation */}
                {navigation.bottom.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-white/10 space-y-1">
                    {navigation.bottom.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.path);
                      
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            "flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group",
                            active 
                              ? "bg-white text-red-700 shadow-lg" 
                              : "text-red-50 hover:bg-white/10 hover:text-white",
                            sidebarCollapsed && "justify-center px-2"
                          )}
                        >
                          <Icon className={cn(
                            "h-5 w-5",
                            active ? "text-red-700" : "text-red-100 group-hover:text-white"
                          )} />
                          {!sidebarCollapsed && (
                            <span className="font-medium">{item.name}</span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </nav>

              {/* Logout Button */}
              <div className={cn(
                "p-4 border-t border-white/10",
                sidebarCollapsed && "p-2"
              )}>
                <Button
                  onClick={handleLogoutClick}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-white hover:bg-white/10 hover:text-white",
                    sidebarCollapsed && "justify-center px-2"
                  )}
                >
                  <LogOut className="h-5 w-5" />
                  {!sidebarCollapsed && <span className="ml-3">Logout</span>}
                </Button>
              </div>

              {/* Collapse Toggle (Desktop Only) */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden lg:flex absolute -right-3 top-20 bg-red-700 hover:bg-red-600 text-white p-1.5 rounded-full shadow-lg transition-colors"
              >
                <ChevronRight className={cn(
                  "h-4 w-4 transition-transform",
                  sidebarCollapsed ? "rotate-0" : "rotate-180"
                )} />
              </button>
            </aside>
          </>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Navigation Bar */}
          <header className="bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200/50 z-30">
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                {/* Left Side */}
                <div className="flex items-center space-x-4">
                  {/* Mobile Menu Button for logged-in users */}
                  {user && (
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Menu className="h-6 w-6 text-gray-700" />
                    </button>
                  )}

                  {/* Mobile Menu Button for public users */}
                  {!user && (
                    <button
                      onClick={() => setMobileMenuOpen(true)}
                      className="sm:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Menu className="h-6 w-6 text-gray-700" />
                    </button>
                  )}

                  {/* Logo for non-logged-in users */}
                  {!user && (
                    <Link to="/" className="flex items-center space-x-2">
                      <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-red-600" />
                      <div>
                        <h1 className="text-base sm:text-xl font-bold text-gray-900">Batangas State University</h1>
                        <p className="text-xs text-gray-600 hidden sm:block">Competition Scoring System</p>
                      </div>
                    </Link>
                  )}

                  {/* Breadcrumb for logged-in users */}
                  {user && (
                    <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600">
                      <Home className="h-4 w-4" />
                      <ChevronRight className="h-4 w-4" />
                      <span className="font-medium text-gray-900 capitalize">
                        {location.pathname.split('/')[1] || 'Home'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right Side */}
                <div className="flex items-center space-x-3">
                  {!user && (
                    <>
                      {/* Public Navigation for non-logged-in users */}
                      <nav className="hidden sm:flex items-center space-x-2">
                        <Link to="/">
                          <Button variant="ghost" size="sm">Live Events</Button>
                        </Link>
                        <Link to="/leaderboard">
                          <Button variant="ghost" size="sm">Leaderboard</Button>
                        </Link>
                        <Link to="/history">
                          <Button variant="ghost" size="sm">History</Button>
                        </Link>
                        <Link to="/announcements">
                          <Button variant="ghost" size="sm">Announcements</Button>
                        </Link>
                      </nav>
                      <Link to="/login">
                        <Button size="sm" className="bg-red-600 hover:bg-red-700">
                          Login
                        </Button>
                      </Link>
                    </>
                  )}

                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="h-full">
              <Outlet />
            </div>
          </main>

          {/* Footer */}
          <footer className="bg-white/95 backdrop-blur-md border-t border-gray-200/50 py-4">
            <div className="px-4 sm:px-6 lg:px-8">
              <p className="text-center text-sm text-gray-600">
                © 2026 Batangas State University. All rights reserved.
              </p>
            </div>
          </footer>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to logout? This will end your session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Logout</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}