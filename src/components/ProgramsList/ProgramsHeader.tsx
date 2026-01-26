/**
 * ProgramsHeader - Header with title and create button
 */

import { Plus, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';

interface ProgramsHeaderProps {
  totalCount: number;
  onCreateProgram: () => void;
}

export function ProgramsHeader({
  totalCount,
  onCreateProgram,
}: ProgramsHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold">My Programs</h1>
        <p className="text-muted-foreground">
          {totalCount} program{totalCount !== 1 ? 's' : ''} total
        </p>
      </div>
      <Button onClick={onCreateProgram} className="gap-2">
        <Sparkles className="w-4 h-4" />
        Generate Program
      </Button>
    </div>
  );
}

export default ProgramsHeader;
