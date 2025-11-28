"use client";

import * as React from "react";
import { Youtube, Image as ImageIcon, Sparkles } from "lucide-react";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import type { IngestResponse } from "../lib/api/ingest";
import { ingestWorkout } from "../lib/api/ingest";

type AddSourcesProps = {
  // Existing props
  sources: any[];
  onSourcesChange: (sources: any[]) => void;
  /**
   * Kept backwards compatible: callers that ignore the argument still work.
   * When using real ingest, we pass { blocks, ingestMeta } so the parent
   * can wire into mapping / exports.
   */
  onGenerateStructure: (result?: { blocks?: any[]; ingestMeta?: IngestResponse }) => void;
};

function AddSources(props: AddSourcesProps) {
  const { sources, onSourcesChange, onGenerateStructure } = props;

  const [activeTab, setActiveTab] = React.useState<"youtube" | "image" | "ai">(
    "youtube"
  );
  const [youtubeUrl, setYoutubeUrl] = React.useState("");
  const [imageUrlsText, setImageUrlsText] = React.useState("");
  const [aiText, setAiText] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const env = (import.meta as any).env || {};
  const nodeEnv = (globalThis as any).process?.env || {};

  // If either Vite or Node env provides this URL, we treat ingest as "live"
  const hasRealIngest =
    Boolean(env.VITE_WORKOUT_INGESTOR_API_URL) ||
    Boolean(nodeEnv.VITE_WORKOUT_INGESTOR_API_URL);

  async function handleGenerateStructure() {
    setIsSubmitting(true);
    setError(null);

    try {
      // 1) Build up canonical "sources" list so the rest of the app
      //    still sees everything it needs.
      const updatedSources = [...sources];

      if (youtubeUrl.trim()) {
        updatedSources.push({
          type: "youtube",
          url: youtubeUrl.trim(),
        });
      }

      const imageLines = imageUrlsText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (imageLines.length > 0) {
        for (const url of imageLines) {
          updatedSources.push({
            type: "image",
            url,
          });
        }
      }

      if (aiText.trim()) {
        updatedSources.push({
          type: "ai_text",
          text: aiText.trim(),
        });
      }

      onSourcesChange(updatedSources);

      // 2) If we have a real ingest service configured AND a YouTube URL,
      //    hit the real ingest pipeline and pass blocks to the parent.
      if (hasRealIngest && youtubeUrl.trim()) {
        const started = Date.now();

        const ingestResult = await ingestWorkout({
          sourceType: "youtube",
          url: youtubeUrl.trim(),
        });

        const duration = Date.now() - started;
        // Helpful when running in dev / tests
        // eslint-disable-next-line no-console
        console.log(
          `[AddSources] Ingest completed in ${duration}ms, title="${
            ingestResult.title
          }", blocks=${Array.isArray(ingestResult.blocks)
            ? ingestResult.blocks.length
            : 0
          }`
        );

        // Even if blocks is empty, we pass the result up so the parent
        // can decide how to handle "no structure found yet".
        onGenerateStructure({
          blocks: ingestResult.blocks ?? [],
          ingestMeta: ingestResult,
        });
      } else {
        // 3) Fallback: no real ingest configured – keep old behavior
        //    and let the mock pipeline or other layers handle it.
        onGenerateStructure();
      }
    } catch (err: any) {
      console.error("[AddSources] Failed to ingest workout:", err);
      setError(err?.message || "Failed to ingest workout. Please try again.");
      // Still notify parent that generation was attempted; they may
      // show their own error UI or stay in the same step.
      onGenerateStructure();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Main input card */}
      <div className="space-y-6 lg:col-span-2">
        <div>
          <h2 className="mb-2">Add Workout Sources</h2>
          <p className="text-muted-foreground">
            Transform workout content from YouTube videos, images, or AI text into
            structured blocks that sync with your watches.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Input Sources</CardTitle>
            <CardDescription>
              Add links or content from various platforms to build your workout.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as typeof activeTab)}
            >
              <TabsList className="grid h-10 w-full grid-cols-3">
                <TabsTrigger value="youtube">
                  <Youtube className="mr-2 h-4 w-4" />
                  YouTube
                </TabsTrigger>
                <TabsTrigger value="image">
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Images
                </TabsTrigger>
                <TabsTrigger value="ai">
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI Text
                </TabsTrigger>
              </TabsList>

              <TabsContent value="youtube" className="space-y-2 pt-4">
                <Label htmlFor="youtube-url">YouTube / Shorts URL</Label>
                <Input
                  id="youtube-url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Paste a workout video URL. We&apos;ll fetch the transcript and
                  try to infer sets, reps, and structure.
                </p>
              </TabsContent>

              <TabsContent value="image" className="space-y-2 pt-4">
                <Label htmlFor="image-urls">Images / Screenshots (one per line)</Label>
                <Textarea
                  id="image-urls"
                  placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                  rows={4}
                  value={imageUrlsText}
                  onChange={(e) => setImageUrlsText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Links to screenshots of workouts (e.g. Instagram posts, whiteboard photos).
                </p>
              </TabsContent>

              <TabsContent value="ai" className="space-y-2 pt-4">
                <Label htmlFor="ai-text">AI / Hand-Typed Description</Label>
                <Textarea
                  id="ai-text"
                  placeholder="E.g. 4 rounds: 400m run + 20 wall balls..."
                  rows={5}
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Paste a written description of the workout (from ChatGPT, notes, etc.).
                </p>
              </TabsContent>
            </Tabs>

            {error && (
              <Alert variant="destructive" className="mt-2">
                <AlertTitle>Ingest error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between pt-4">
              <div className="text-xs text-muted-foreground">
                {hasRealIngest ? (
                  <span>
                    Using <span className="font-medium">live ingest API</span> for
                    YouTube sources.
                  </span>
                ) : (
                  <span>
                    Live ingest API not configured – using mock pipeline only.
                  </span>
                )}
              </div>

              <Button
                type="button"
                onClick={handleGenerateStructure}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Generating..." : "Generate Structure"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right side helper card (simple, non-essential) */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Tips</CardTitle>
            <CardDescription>
              For the best results from YouTube ingestion:
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-muted-foreground">
            <ul className="list-disc pl-4 space-y-1">
              <li>Use videos with clear exercise callouts and timestamps.</li>
              <li>Avoid &quot;vlog style&quot; content with minimal workout detail.</li>
              <li>
                If blocks come back empty, try a different video or paste AI text.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AddSources;
