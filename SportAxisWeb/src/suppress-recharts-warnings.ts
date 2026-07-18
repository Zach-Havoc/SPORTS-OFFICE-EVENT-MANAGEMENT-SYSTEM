// This file must be loaded as the VERY FIRST import in the application
// It patches console methods to suppress known Recharts internal warnings

(function() {
  const originalWarn = console.warn;
  const originalError = console.error;
  
  console.warn = function(...args: any[]) {
    const message = args[0];
    // Suppress Recharts duplicate key warnings
    if (typeof message === 'string') {
      if (message.includes('Encountered two children with the same key') ||
          message.includes('Keys should be unique so that components maintain their identity')) {
        return;
      }
    }
    originalWarn.apply(console, args);
  };
  
  console.error = function(...args: any[]) {
    const message = args[0];
    // Suppress Recharts duplicate key warnings
    if (typeof message === 'string') {
      if (message.includes('Encountered two children with the same key') ||
          message.includes('Keys should be unique so that components maintain their identity')) {
        return;
      }
    }
    originalError.apply(console, args);
  };
})();

export {};
