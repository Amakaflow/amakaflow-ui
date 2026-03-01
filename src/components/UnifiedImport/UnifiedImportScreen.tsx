import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Link, FileSpreadsheet, Plug } from 'lucide-react';
import { ImportQueue } from './ImportQueue';
import type { ImportTab, QueueItem } from '../../types/unified-import';

interface UnifiedImportScreenProps {
  userId: string;
  onDone: () => void;
}

export function UnifiedImportScreen({ userId: _userId, onDone: _onDone }: UnifiedImportScreenProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>('urls-media');
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const handleImport = () => {
    // TODO: Task 6 — process queue
    console.log('TODO: process queue', queue);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Import Workouts</h1>
        <p className="text-muted-foreground mt-1">
          Add one or many sources — the rest is handled for you.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ImportTab)}>
        <TabsList className="mb-6">
          <TabsTrigger value="urls-media" className="gap-2">
            <Link className="w-4 h-4" />
            URLs &amp; Media
          </TabsTrigger>
          <TabsTrigger value="file" className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            File
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Plug className="w-4 h-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="urls-media">
          <ImportQueue queue={queue} onQueueChange={setQueue} />
          {queue.length > 0 && (
            <div className="mt-4">
              <Button className="w-full" onClick={handleImport}>
                Import {queue.length} item{queue.length !== 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="file">
          <p className="text-muted-foreground">File import — coming soon</p>
        </TabsContent>

        <TabsContent value="integrations">
          <p className="text-muted-foreground">Integrations — coming soon</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
