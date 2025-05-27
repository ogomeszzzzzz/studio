import { Box } from 'lucide-react';

export function AppHeader() {
  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-4 flex items-center">
        <Box className="h-8 w-8 text-primary mr-3" />
        <h1 className="text-2xl font-semibold text-foreground">
          Collection Gap Analyzer
        </h1>
      </div>
    </header>
  );
}
