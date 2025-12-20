/**
 * CreateProgramModal - Create or edit a workout program
 */

import React, { useState, useEffect } from 'react';
import { X, Palette, Smile } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import type { WorkoutProgram } from '../lib/workout-api';

// Preset colors for programs
const PROGRAM_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
];

// Preset icons (emoji style)
const PROGRAM_ICONS = [
  '💪', '🏃', '🚴', '🏋️', '🧘', '🎯', '⚡', '🔥', '💯', '🌟',
  '📅', '📈', '🏆', '💎', '🎪', '🌊', '⛰️', '🌅', '🎸', '🎨',
];

interface CreateProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (program: { name: string; description?: string; color?: string; icon?: string }) => Promise<void>;
  editingProgram?: WorkoutProgram | null;
}

export function CreateProgramModal({
  isOpen,
  onClose,
  onSave,
  editingProgram,
}: CreateProgramModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PROGRAM_COLORS[5]); // default blue
  const [icon, setIcon] = useState(PROGRAM_ICONS[0]); // default 💪
  const [isSaving, setIsSaving] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Reset form when modal opens/closes or editing program changes
  useEffect(() => {
    if (isOpen) {
      if (editingProgram) {
        setName(editingProgram.name);
        setDescription(editingProgram.description || '');
        setColor(editingProgram.color || PROGRAM_COLORS[5]);
        setIcon(editingProgram.icon || PROGRAM_ICONS[0]);
      } else {
        setName('');
        setDescription('');
        setColor(PROGRAM_COLORS[5]);
        setIcon(PROGRAM_ICONS[0]);
      }
    }
  }, [isOpen, editingProgram]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        icon,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save program:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-md mx-4 border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {editingProgram ? 'Edit Program' : 'Create Program'}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Icon and Color Preview */}
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl cursor-pointer hover:opacity-80 transition-opacity"
              style={{ backgroundColor: color + '20' }}
              onClick={() => setShowIconPicker(!showIconPicker)}
            >
              {icon}
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-2">Click icon to change</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="gap-2"
                >
                  <Palette className="w-4 h-4" />
                  Color
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="gap-2"
                >
                  <Smile className="w-4 h-4" />
                  Icon
                </Button>
              </div>
            </div>
          </div>

          {/* Color Picker */}
          {showColorPicker && (
            <div className="p-3 border rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-2">Choose a color</p>
              <div className="flex flex-wrap gap-2">
                {PROGRAM_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setColor(c);
                      setShowColorPicker(false);
                    }}
                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      color === c ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Icon Picker */}
          {showIconPicker && (
            <div className="p-3 border rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-2">Choose an icon</p>
              <div className="grid grid-cols-10 gap-1">
                {PROGRAM_ICONS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setIcon(i);
                      setShowIconPicker(false);
                    }}
                    className={`w-8 h-8 rounded flex items-center justify-center text-lg hover:bg-muted transition-colors ${
                      icon === i ? 'bg-muted ring-2 ring-primary' : ''
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="program-name">Program Name *</Label>
            <Input
              id="program-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., 12 Week Strength Program"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="program-description">Description</Label>
            <Textarea
              id="program-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this program..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSaving}>
              {isSaving ? 'Saving...' : editingProgram ? 'Save Changes' : 'Create Program'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateProgramModal;
