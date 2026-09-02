import { Outlet, useLocation, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Trophy, LogOut, LayoutDashboard, Menu } from 'lucide-react';
import { useState } from 'react';
import bgImage from 'figma:asset/d00b81b29bccf92203e98ef7d2b2d2f18d87f4b1.png';
import Loading from '../components/Loading';

export default function Root() {
  const { user, logout, loading } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  const isPublicRoute = !location.pathname.startsWith('/admin') && !location.pathname.startsWith('/judge');

  // Show nothing while auth is loading to prevent flash
  if (loading) {
    return <Loading message="Loading application..." />;
  }

  return (
    <div className="min-h-screen relative">
      {/* Background Image with Overlay */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="absolute inset-0 bg-white/5 backdrop-blur-sm"></div>
      </div>

      {/* Content Container */}
      <div className="relative z-10">
        {/* Header */}
        <header className="bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <Link to="/" className="flex items-center space-x-2">
                <Trophy className="h-8 w-8 text-red-600" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Batangas State University</h1>
                  <p className="text-xs text-gray-600">Competition Scoring and Event Management System</p>
                </div>
              </Link>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center space-x-4">
                {isPublicRoute && (
                  <>
                    <Link to="/">
                      <Button variant="ghost">Live Events</Button>
                    </Link>
                    <Link to="/leaderboard">
                      <Button variant="ghost">Leaderboard</Button>
                    </Link>
                    <Link to="/history">
                      <Button variant="ghost">History</Button>
                    </Link>
                  </>
                )}

                {user && (
                  <>
                    {user.role === 'admin' && (
                      <Link to="/admin">
                        <Button variant="ghost">
                          <LayoutDashboard className="h-4 w-4 mr-2" />
                          Admin Panel
                        </Button>
                      </Link>
                    )}
                    {user.role === 'judge' && (
                      <Link to="/judge">
                        <Button variant="ghost">
                          <LayoutDashboard className="h-4 w-4 mr-2" />
                          Committee Panel
                        </Button>
                      </Link>
                    )}
                    <Button variant="outline" onClick={handleLogout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  </>
                )}

                {!user && (
                  <Link to="/login">
                    <Button>Login</Button>
                  </Link>
                )}
              </nav>

              {/* Mobile Menu Button */}
              <button
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>

            {/* Mobile Navigation */}
            {mobileMenuOpen && (
              <nav className="md:hidden pb-4 space-y-2">
                {isPublicRoute && (
                  <>
                    <Link to="/" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start">Live Events</Button>
                    </Link>
                    <Link to="/leaderboard" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start">Leaderboard</Button>
                    </Link>
                    <Link to="/history" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start">History</Button>
                    </Link>
                  </>
                )}

                {user && (
                  <>
                    {user.role === 'admin' && (
                      <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start">Admin Panel</Button>
                      </Link>
                    )}
                    {user.role === 'judge' && (
                      <Link to="/judge" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start">Committee Panel</Button>
                      </Link>
                    )}
                    <Button variant="outline" onClick={handleLogout} className="w-full justify-start">
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  </>
                )}

                {!user && (
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full">Login</Button>
                  </Link>
                )}
              </nav>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main>
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="bg-white/95 backdrop-blur-md border-t border-gray-200/50 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <p className="text-center text-sm text-gray-600">
              © 2026 Batangas State University Event Competition Scoring System. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}