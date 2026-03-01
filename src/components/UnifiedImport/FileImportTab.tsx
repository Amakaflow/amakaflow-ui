import { useRef, useCallback } from 'react';
import { Button } from '../ui/button';
import { Upload } from 'lucide-react';
import { useBulkImportApi } from '../../hooks/useBulkImportApi';

interface FileImportTabProps {
  userId: string;
  onFilesDetected: () => void;
}

export function FileImportTab({ userId, onFilesDetected }: FileImportTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { detectFromFiles } = useBulkImportApi({ userId });

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      await detectFromFiles(files);
      onFilesDetected();
    },
    [detectFromFiles, onFilesDetected]
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload an Excel, CSV, or JSON file. You'll match columns before importing.
      </p>

      <div
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          handleFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">Drop files here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx, .xls), CSV, JSON</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.json,.txt"
          multiple
          className="hidden"
          onChange={e => handleFiles(Array.from(e.target.files ?? []))}
        />
      </div>
    </div>
  );
}
