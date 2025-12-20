/**
 * DetectStep Component
 *
 * Step 1 of bulk import: Input selection and detection.
 * Supports three input types:
 * - File (Excel, CSV, JSON, Text)
 * - URLs (YouTube, Instagram, TikTok, Pinterest)
 * - Images (workout screenshots)
 */

import { useRef, useState, useCallback } from 'react';
import { useBulkImport } from '../../context/BulkImportContext';
import { useBulkImportApi } from '../../hooks/useBulkImportApi';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import {
  FileSpreadsheet,
  Link,
  Image,
  Upload,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  Film,
} from 'lucide-react';
import { cn } from '../ui/utils';
import { DetectedItem } from '../../types/bulk-import';

interface DetectStepProps {
  userId: string;
}

// File type configurations
const fileTypeConfig = {
  excel: { icon: FileSpreadsheet, label: 'Excel', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  csv: { icon: FileText, label: 'CSV', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  json: { icon: FileText, label: 'JSON', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  text: { icon: FileText, label: 'Text', color: 'text-purple-400', bg: 'bg-purple-500/10' },
};

// Platform configurations for URLs
const platformConfig = {
  youtube: { icon: Film, label: 'YouTube', color: 'text-red-400', bg: 'bg-red-500/10' },
  instagram: { icon: Image, label: 'Instagram', color: 'text-pink-400', bg: 'bg-pink-500/10' },
  tiktok: { icon: Film, label: 'TikTok', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  pinterest: { icon: Image, label: 'Pinterest', color: 'text-red-500', bg: 'bg-red-500/10' },
  pinterest_board: { icon: Image, label: 'Pinterest Board', color: 'text-red-500', bg: 'bg-red-500/10' },
};

export function DetectStep({ userId }: DetectStepProps) {
  const { state, setInputType, dispatch } = useBulkImport();
  const { detectFromFiles, detectFromUrls, detectFromImages } = useBulkImportApi({ userId });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Get file type from extension
  const getFileType = (filename: string): keyof typeof fileTypeConfig => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') return 'excel';
    if (ext === 'csv') return 'csv';
    if (ext === 'json') return 'json';
    return 'text';
  };

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
  }, []);

  // Handle image selection
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedImages(prev => [...prev, ...files]);
    }
  }, []);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (state.inputType === 'file') {
      setSelectedFiles(prev => [...prev, ...files]);
    } else if (state.inputType === 'images') {
      setSelectedImages(prev => [...prev, ...files]);
    }
  }, [state.inputType]);

  // Remove file
  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Remove image
  const removeImage = useCallback((index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Parse URLs from input
  const parseUrls = useCallback((input: string): string[] => {
    return input
      .split(/[\n,]+/)
      .map(url => url.trim())
      .filter(url => url.length > 0 && (url.startsWith('http://') || url.startsWith('https://')));
  }, []);

  // Detect platform from URL
  const detectPlatform = (url: string): keyof typeof platformConfig | null => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('pinterest.com') || url.includes('pin.it')) return 'pinterest';
    return null;
  };

  // Handle upload/detect
  const handleDetect = useCallback(async () => {
    if (state.inputType === 'file' && selectedFiles.length > 0) {
      await detectFromFiles(selectedFiles);
    } else if (state.inputType === 'urls') {
      const urls = parseUrls(urlInput);
      if (urls.length > 0) {
        await detectFromUrls(urls);
      }
    } else if (state.inputType === 'images' && selectedImages.length > 0) {
      await detectFromImages(selectedImages);
    }
  }, [state.inputType, selectedFiles, urlInput, selectedImages, detectFromFiles, detectFromUrls, detectFromImages, parseUrls]);

  // Check if can proceed
  const canProceed = useCallback(() => {
    if (state.inputType === 'file') return selectedFiles.length > 0;
    if (state.inputType === 'urls') return parseUrls(urlInput).length > 0;
    if (state.inputType === 'images') return selectedImages.length > 0;
    return false;
  }, [state.inputType, selectedFiles, urlInput, selectedImages, parseUrls]);

  // Get button label
  const getButtonLabel = () => {
    if (state.loading) return 'Processing...';
    if (state.inputType === 'file') return `Upload & Detect (${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''})`;
    if (state.inputType === 'urls') return `Detect (${parseUrls(urlInput).length} URL${parseUrls(urlInput).length !== 1 ? 's' : ''})`;
    if (state.inputType === 'images') return `Scan Images (${selectedImages.length})`;
    return 'Detect';
  };

  const parsedUrls = parseUrls(urlInput);

  return (
    <div className="space-y-6">
      {/* Input Type Selection */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setInputType('file')}
          className={cn(
            'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
            state.inputType === 'file'
              ? 'border-primary bg-primary/5'
              : 'border-white/10 hover:border-white/20 hover:bg-white/5'
          )}
        >
          <FileSpreadsheet className={cn('w-8 h-8', state.inputType === 'file' ? 'text-primary' : 'text-muted-foreground')} />
          <span className={cn('font-medium', state.inputType === 'file' ? 'text-primary' : 'text-foreground')}>Files</span>
          <span className="text-xs text-muted-foreground text-center">Excel, CSV, JSON</span>
        </button>

        <button
          onClick={() => setInputType('urls')}
          className={cn(
            'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
            state.inputType === 'urls'
              ? 'border-primary bg-primary/5'
              : 'border-white/10 hover:border-white/20 hover:bg-white/5'
          )}
        >
          <Link className={cn('w-8 h-8', state.inputType === 'urls' ? 'text-primary' : 'text-muted-foreground')} />
          <span className={cn('font-medium', state.inputType === 'urls' ? 'text-primary' : 'text-foreground')}>URLs</span>
          <span className="text-xs text-muted-foreground text-center">YouTube, TikTok, Pinterest</span>
        </button>

        <button
          onClick={() => setInputType('images')}
          className={cn(
            'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
            state.inputType === 'images'
              ? 'border-primary bg-primary/5'
              : 'border-white/10 hover:border-white/20 hover:bg-white/5'
          )}
        >
          <Image className={cn('w-8 h-8', state.inputType === 'images' ? 'text-primary' : 'text-muted-foreground')} />
          <span className={cn('font-medium', state.inputType === 'images' ? 'text-primary' : 'text-foreground')}>Images</span>
          <span className="text-xs text-muted-foreground text-center">OCR Scan</span>
        </button>
      </div>

      {/* File Upload Area */}
      {state.inputType === 'file' && (
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.json,.txt"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all',
              dragOver ? 'border-primary bg-primary/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'
            )}
          >
            <Upload className={cn('w-12 h-12', dragOver ? 'text-primary' : 'text-muted-foreground')} />
            <div className="text-center">
              <p className="font-medium">Drop files here or click to browse</p>
              <p className="text-sm text-muted-foreground mt-1">
                Supports Excel (.xlsx, .xls), CSV, JSON, and Text files
              </p>
            </div>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Selected Files</p>
              <div className="space-y-2">
                {selectedFiles.map((file, index) => {
                  const fileType = getFileType(file.name);
                  const config = fileTypeConfig[fileType];
                  const IconComponent = config.icon;

                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-lg', config.bg)}>
                          <IconComponent className={cn('w-4 h-4', config.color)} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* URL Input Area */}
      {state.inputType === 'urls' && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Paste workout video URLs (one per line or comma-separated)
            </label>
            <Textarea
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={`https://youtube.com/watch?v=abc123\nhttps://instagram.com/reel/xyz789\nhttps://tiktok.com/@user/video/123\nhttps://pinterest.com/pin/123456789`}
              rows={6}
              className="font-mono text-sm"
            />
          </div>

          {/* Parsed URLs Preview */}
          {parsedUrls.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {parsedUrls.length} URL{parsedUrls.length !== 1 ? 's' : ''} detected
              </p>
              <div className="flex flex-wrap gap-2">
                {parsedUrls.slice(0, 10).map((url, index) => {
                  const platform = detectPlatform(url);
                  const config = platform ? platformConfig[platform] : null;

                  return (
                    <Badge
                      key={index}
                      variant="secondary"
                      className={cn('gap-1', config?.bg)}
                    >
                      {config && <config.icon className={cn('w-3 h-3', config.color)} />}
                      <span className="truncate max-w-[150px]">
                        {url.replace(/https?:\/\/(www\.)?/, '').split('/')[0]}
                      </span>
                    </Badge>
                  );
                })}
                {parsedUrls.length > 10 && (
                  <Badge variant="secondary">+{parsedUrls.length - 10} more</Badge>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Image Upload Area */}
      {state.inputType === 'images' && (
        <div className="space-y-4">
          <input
            ref={imageInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.heic,.gif"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />

          <div
            onClick={() => imageInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all',
              dragOver ? 'border-primary bg-primary/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'
            )}
          >
            <Image className={cn('w-12 h-12', dragOver ? 'text-primary' : 'text-muted-foreground')} />
            <div className="text-center">
              <p className="font-medium">Drop images here or click to browse</p>
              <p className="text-sm text-muted-foreground mt-1">
                Workout screenshots, infographics, or program photos
              </p>
            </div>
          </div>

          {/* Selected Images Grid */}
          {selectedImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Selected Images ({selectedImages.length})
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {selectedImages.map((image, index) => (
                  <div key={index} className="relative group aspect-square rounded-lg overflow-hidden bg-white/5">
                    <img
                      src={URL.createObjectURL(image)}
                      alt={image.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detection Results (if already detected) */}
      {state.detected.items.length > 0 && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="font-medium text-emerald-400">
              {state.detected.items.length} workout{state.detected.items.length !== 1 ? 's' : ''} detected
            </span>
          </div>
          <div className="space-y-2">
            {state.detected.items.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{item.parsedTitle || item.sourceRef}</span>
                <Badge variant="secondary" className="ml-2">
                  {item.parsedExerciseCount || 0} exercises
                </Badge>
              </div>
            ))}
            {state.detected.items.length > 5 && (
              <p className="text-sm text-muted-foreground">
                +{state.detected.items.length - 5} more workouts
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {state.error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">Detection Failed</p>
            <p className="text-sm text-destructive/80 mt-1">{state.error}</p>
          </div>
        </div>
      )}

      {/* Action Button */}
      <Button
        onClick={handleDetect}
        disabled={!canProceed() || state.loading}
        className="w-full h-12 text-base"
        size="lg"
      >
        {state.loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            {state.inputType === 'urls'
              ? 'Extracting workouts (may take a minute)...'
              : state.inputType === 'images'
              ? 'Analyzing with AI vision...'
              : 'Processing...'}
          </>
        ) : (
          <>
            <Upload className="w-5 h-5 mr-2" />
            {getButtonLabel()}
          </>
        )}
      </Button>
    </div>
  );
}

export default DetectStep;
