/**
 * WorkoutTagsEditor - Add/remove tags from a workout
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Check, Loader2, Tag as TagIcon } from 'lucide-react';
import { Button } from './ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { Input } from './ui/input';
import { TagPill } from './TagPill';
import { getUserTags, updateWorkoutTags } from '../lib/workout-api';
import type { UserTag } from '../types/unified-workout';

interface WorkoutTagsEditorProps {
  workoutId: string;
  profileId: string;
  currentTags: string[];
  onTagsUpdate: (tags: string[]) => void;
}

export function WorkoutTagsEditor({
  workoutId,
  profileId,
  currentTags,
  onTagsUpdate,
}: WorkoutTagsEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [allTags, setAllTags] = useState<UserTag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load all user tags
  const loadTags = useCallback(async () => {
    if (!isOpen) return;

    setIsLoading(true);
    try {
      const tags = await getUserTags(profileId);
      setAllTags(tags);
    } catch (err) {
      console.error('[WorkoutTagsEditor] Error loading tags:', err);
    } finally {
      setIsLoading(false);
    }
  }, [profileId, isOpen]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // Toggle tag on workout
  const handleToggleTag = async (tagName: string) => {
    const isSelected = currentTags.includes(tagName);
    const newTags = isSelected
      ? currentTags.filter((t) => t !== tagName)
      : [...currentTags, tagName];

    setIsSaving(true);
    try {
      await updateWorkoutTags(workoutId, profileId, newTags);
      onTagsUpdate(newTags);
    } catch (err) {
      console.error('[WorkoutTagsEditor] Error updating tags:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter tags by search
  const filteredTags = allTags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          title="Add tags"
        >
          <TagIcon className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TagIcon className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">Tags</span>
          </div>

          <Input
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />

          <div className="max-h-48 overflow-y-auto space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-xs">
                {searchQuery ? 'No matching tags' : 'No tags available'}
              </div>
            ) : (
              filteredTags.map((tag) => {
                const isSelected = currentTags.includes(tag.name);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleToggleTag(tag.name)}
                    disabled={isSaving}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left hover:bg-muted transition-colors ${
                      isSelected ? 'bg-muted' : ''
                    }`}
                  >
                    <TagPill name={tag.name} color={tag.color} size="sm" />
                    {isSelected && (
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Current tags display */}
          {currentTags.length > 0 && (
            <div className="pt-2 border-t">
              <span className="text-xs text-muted-foreground">Current:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {currentTags.map((tagName) => {
                  const tag = allTags.find((t) => t.name === tagName);
                  return (
                    <TagPill
                      key={tagName}
                      name={tagName}
                      color={tag?.color}
                      size="sm"
                      onRemove={() => handleToggleTag(tagName)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default WorkoutTagsEditor;
