import { ImageOff } from "lucide-react";

interface ScreenshotPlaceholderProps {
  filename: string;
}

export function ScreenshotPlaceholder({ filename }: ScreenshotPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 p-8 text-center">
      <ImageOff className="h-10 w-10 text-zinc-600 mb-3" />
      <p className="text-sm font-medium text-zinc-400">Screenshot coming soon</p>
      <p className="text-xs text-zinc-600 mt-1 font-mono">{filename}</p>
    </div>
  );
}
