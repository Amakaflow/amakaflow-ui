/**
 * ProgramsAddMore - Empty state component encouraging users to add more programs
 * Displayed below program cards when there are existing programs but not filling the page
 */

import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';

interface ProgramsAddMoreProps {
  onCreateProgram: () => void;
}

export function ProgramsAddMore({ onCreateProgram }: ProgramsAddMoreProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 mt-8 border-2 border-dashed rounded-lg bg-muted/30">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Ready for another program?</h3>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Generate one with AI →
      </p>
      <Button onClick={onCreateProgram} className="gap-2">
        Generate Program
        <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default ProgramsAddMore;
