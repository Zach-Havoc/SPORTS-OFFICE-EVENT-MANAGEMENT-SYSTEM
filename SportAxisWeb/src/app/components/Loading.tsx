import spartansLogo from 'figma:asset/a78d515b3174b3e35a54bedf9be1f36c9fcde05c.png';
import bgImage from 'figma:asset/d00b81b29bccf92203e98ef7d2b2d2f18d87f4b1.png';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export default function Loading({ message = "Loading...", fullScreen = true }: LoadingProps) {
  if (fullScreen) {
    return (
      <div 
        className="min-h-screen w-full flex items-center justify-center fixed inset-0 z-50" 
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="absolute inset-0 bg-white/90 backdrop-blur-[2px]"></div>
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-4 py-12">
          {/* Logo */}
          <div className="relative w-32 h-32 flex items-center justify-center mb-6">
            <img 
              src={spartansLogo} 
              alt="BatStateU Red Spartans" 
              className="w-24 h-24 object-contain animate-pulse relative z-10"
            />
          </div>
          
          {/* Loading text and spinner */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="flex gap-2">
                <div className="w-3 h-3 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-3 h-3 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-3 h-3 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
            <p className="text-gray-700 font-semibold text-lg">{message}</p>
          </div>
        </div>
      </div>
    );
  }

  // Inline loading (for non-fullscreen contexts) - PERFECTLY CENTERED
  return (
    <div className="flex flex-col items-center justify-center py-12 w-full">
      <div className="relative w-24 h-24 flex items-center justify-center mb-6">
        {/* Smaller pulsing background - centered */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-24 h-24 bg-red-100 rounded-full animate-ping"></div>
        </div>
        
        {/* Logo - centered */}
        <img 
          src={spartansLogo} 
          alt="BatStateU Red Spartans" 
          className="w-16 h-16 object-contain animate-pulse relative z-10"
        />
      </div>
      
      {/* Loading text */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
        <p className="text-gray-700 font-semibold">{message}</p>
      </div>
    </div>
  );
}