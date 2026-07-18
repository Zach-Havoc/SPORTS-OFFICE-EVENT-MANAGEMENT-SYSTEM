// Suppress known Recharts duplicate key warnings
// This must be imported before React and any other components

const originalWarn = console.warn.bind(console);
const originalError = console.error.bind(console);

console.warn = (...args: any[]) => {
  const firstArg = args[0];
  if (
    typeof firstArg === 'string' &&
    (firstArg.includes('Encountered two children with the same key') ||
     firstArg.includes('Keys should be unique'))
  ) {
    return; // Suppress Recharts internal key warnings
  }
  originalWarn(...args);
};

console.error = (...args: any[]) => {
  const firstArg = args[0];
  if (
    typeof firstArg === 'string' &&
    (firstArg.includes('Encountered two children with the same key') ||
     firstArg.includes('Keys should be unique'))
  ) {
    return; // Suppress Recharts internal key warnings
  }
  originalError(...args);
};

// Also patch potential React DevTools warnings
if (typeof window !== 'undefined') {
  const originalConsoleWarn = (window.console as any).__warn;
  if (originalConsoleWarn) {
    (window.console as any).__warn = (...args: any[]) => {
      const firstArg = args[0];
      if (
        typeof firstArg === 'string' &&
        (firstArg.includes('Encountered two children with the same key') ||
         firstArg.includes('Keys should be unique'))
      ) {
        return;
      }
      originalConsoleWarn(...args);
    };
  }
}

export {};
