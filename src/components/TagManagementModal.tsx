/**
 * TagManagementModal - Create, edit, and manage workout tags
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Loader2, Tag as TagIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { TagPill } from './TagPill';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { getUserTags, createUserTag, deleteUserTag } from '../lib/workout-api';
import type { UserTag } from '../types/unified-workout';

interface TagManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  onTagsChange?: () => void;
}

// Preset colors for tag creation
const PRESET_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#0ea5e9', // sky
  '#64748b', // slate
];

export function TagManagementModal({
  isOpen,
  onClose,
  profileId,
  onTagsChange,
}: TagManagementModalProps) {
  const [tags, setTags] = useState<UserTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingTag, setDeletingTag] = useState<UserTag | null>(null);

  // New tag form state
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);

  // Load tags
  const loadTags = useCallback(async () => {
    try {
      const result = await getUserTags(profileId);
      setTags(result);
    } catch (err) {
      console.error('[TagManagementModal] Error loading tags:', err);
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    if (isOpen) {
      loadTags();
    }
  }, [isOpen, loadTags]);

  // Create tag
  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setIsCreating(true);
    try {
      const created = await createUserTag(profileId, newTagName.trim(), newTagColor);
      if (created) {
        setTags((prev) => [...prev, created]);
        setNewTagName('');
        setNewTagColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
        onTagsChange?.();
      }
    } catch (err) {
      console.error('[TagManagementModal] Error creating tag:', err);
    } finally {
      setIsCreating(false);
    }
  };

  // Delete tag
  const handleDeleteTag = async () => {
    if (!deletingTag) return;

    try {
      const success = await deleteUserTag(deletingTag.id, profileId);
      if (success) {
        setTags((prev) => prev.filter((t) => t.id !== deletingTag.id));
        onTagsChange?.();
      }
    } catch (err) {
      console.error('[TagManagementModal] Error deleting tag:', err);
    } finally {
      setDeletingTag(null);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TagIcon className="w-5 h-5" />
              Manage Tags
            </DialogTitle>
            <DialogDescription>
              Create and organize tags for your workouts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Create new tag */}
            <div className="space-y-3">
              <Label>Create New Tag</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Tag name..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateTag();
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || isCreating}
                  className="gap-1"
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Add
                </Button>
              </div>

              {/* Color picker */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Color:</span>
                <div className="flex gap-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewTagColor(color)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        newTagColor === color
                          ? 'border-foreground scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              {newTagName.trim() && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Preview:</span>
                  <TagPill name={newTagName} color={newTagColor} />
                </div>
              )}
            </div>

            {/* Existing tags */}
            <div className="space-y-2">
              <Label>Your Tags ({tags.length})</Label>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : tags.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No tags yet. Create one above!
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg bg-muted/20">
                  {tags.map((tag) => (
                    <TagPill
                      key={tag.id}
                      name={tag.name}
                      color={tag.color}
                      size="md"
                      onRemove={() => setDeletingTag(tag)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingTag} onOpenChange={() => setDeletingTag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the tag "{deletingTag?.name}" from all workouts.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTag}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default TagManagementModal;
