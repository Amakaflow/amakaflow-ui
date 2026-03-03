import { X, Upload, Shuffle } from 'lucide-react';
import { Button } from '../ui/button';

interface SelectActionBarProps {
  selectedCount: number;
  onCancel: () => void;
  onExport: () => void;
  onMerge: () => void;
}

export function SelectActionBar({ selectedCount, onCancel, onExport, onMerge }: SelectActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border px-4 py-3 flex items-center gap-3 shadow-lg animate-in slide-in-from-bottom-2 duration-200">
      <span className="text-sm font-medium flex-1">
        {selectedCount} selected
      </span>
      {selectedCount >= 2 && (
        <Button variant="outline" size="sm" onClick={onMerge} className="gap-2">
          <Shuffle className="w-4 h-4" />
          Merge
        </Button>
      )}
      <Button size="sm" onClick={onExport} className="gap-2">
        <Upload className="w-4 h-4" />
        Export to device
      </Button>
      <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel selection">
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
