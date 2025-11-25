import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Block, WorkoutStructureType } from '../types/workout';
import { getStructureDefaults, generateId } from '../lib/workout-utils';
import { Layers, Timer, Repeat, Zap, ChevronDown } from 'lucide-react';

interface CreateBlockDialogProps {
  block: Block | null; // If provided, we're editing; otherwise creating
  onSave: (block: Block) => void;
  onClose: () => void;
}

export function CreateBlockDialog({ block, onSave, onClose }: CreateBlockDialogProps) {
  const [label, setLabel] = useState(block?.label || '');
  const [structure, setStructure] = useState<WorkoutStructureType | null>(block?.structure || null);
  const [structureFields, setStructureFields] = useState<Partial<Block>>({});

  useEffect(() => {
    if (block) {
      setLabel(block.label);
      setStructure(block.structure);
      setStructureFields({
        rounds: block.rounds,
        sets: block.sets,
        time_cap_sec: block.time_cap_sec,
        time_work_sec: block.time_work_sec,
        time_rest_sec: block.time_rest_sec,
        rest_between_rounds_sec: block.rest_between_rounds_sec,
        rest_between_sets_sec: block.rest_between_sets_sec,
      });
    } else {
      // Set defaults when structure changes
      if (structure) {
        const defaults = getStructureDefaults(structure);
        setStructureFields(defaults);
      }
    }
  }, [structure, block]);

  const handleSave = () => {
    const newBlock: Block = {
      id: block?.id || generateId(),
      label: label || 'New Block',
      structure,
      exercises: block?.exercises || [],
      ...structureFields,
    };
    onSave(newBlock);
  };

  const getStructureDisplayName = (s: WorkoutStructureType | null) => {
    if (!s) return 'Single';
    return s.toUpperCase();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{block ? 'Edit Block' : 'Create New Block'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="block-label">Block Label</Label>
            <Input
              id="block-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Superset 1, Circuit, Tabata Finisher"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Workout Structure Type</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full mt-1 justify-between">
                  {getStructureDisplayName(structure)}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64">
                <DropdownMenuLabel>Structure Types</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setStructure(null)}>
                  Single
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStructure('superset')}>
                  <Layers className="w-4 h-4 mr-2" />
                  Superset
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStructure('circuit')}>
                  <Repeat className="w-4 h-4 mr-2" />
                  Circuit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStructure('tabata')}>
                  <Timer className="w-4 h-4 mr-2" />
                  Tabata
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStructure('emom')}>
                  <Repeat className="w-4 h-4 mr-2" />
                  EMOM
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStructure('amrap')}>
                  <Timer className="w-4 h-4 mr-2" />
                  AMRAP
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStructure('for-time')}>
                  <Zap className="w-4 h-4 mr-2" />
                  For Time
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStructure('rounds')}>
                  <Repeat className="w-4 h-4 mr-2" />
                  Rounds
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStructure('sets')}>
                  <Layers className="w-4 h-4 mr-2" />
                  Sets
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStructure('regular')}>
                  Regular
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Structure-specific fields */}
          {structure === 'tabata' && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Work (sec)</Label>
                <Input
                  type="number"
                  value={structureFields.time_work_sec || ''}
                  onChange={(e) => setStructureFields({ ...structureFields, time_work_sec: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
              <div>
                <Label>Rest (sec)</Label>
                <Input
                  type="number"
                  value={structureFields.time_rest_sec || ''}
                  onChange={(e) => setStructureFields({ ...structureFields, time_rest_sec: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
              <div>
                <Label>Rounds</Label>
                <Input
                  type="number"
                  value={structureFields.rounds || ''}
                  onChange={(e) => setStructureFields({ ...structureFields, rounds: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
            </div>
          )}

          {structure === 'emom' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Work (sec)</Label>
                <Input
                  type="number"
                  value={structureFields.time_work_sec || ''}
                  onChange={(e) => setStructureFields({ ...structureFields, time_work_sec: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
              <div>
                <Label>Minutes</Label>
                <Input
                  type="number"
                  value={structureFields.rounds || ''}
                  onChange={(e) => setStructureFields({ ...structureFields, rounds: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
            </div>
          )}

          {(structure === 'amrap' || structure === 'for-time') && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Time Cap (sec)</Label>
                <Input
                  type="number"
                  value={structureFields.time_cap_sec || ''}
                  onChange={(e) => setStructureFields({ ...structureFields, time_cap_sec: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
              {structure === 'for-time' && (
                <div>
                  <Label>Rounds</Label>
                  <Input
                    type="number"
                    value={structureFields.rounds || ''}
                    onChange={(e) => setStructureFields({ ...structureFields, rounds: e.target.value ? parseInt(e.target.value) : null })}
                  />
                </div>
              )}
            </div>
          )}

          {(structure === 'superset' || structure === 'circuit' || structure === 'rounds') && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Rounds</Label>
                <Input
                  type="number"
                  value={structureFields.rounds || ''}
                  onChange={(e) => setStructureFields({ ...structureFields, rounds: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
              <div>
                <Label>Rest Between (sec)</Label>
                <Input
                  type="number"
                  value={structureFields.rest_between_rounds_sec || ''}
                  onChange={(e) => setStructureFields({ ...structureFields, rest_between_rounds_sec: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
            </div>
          )}

          {structure === 'sets' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Sets</Label>
                <Input
                  type="number"
                  value={structureFields.sets || ''}
                  onChange={(e) => setStructureFields({ ...structureFields, sets: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
              <div>
                <Label>Rest Between (sec)</Label>
                <Input
                  type="number"
                  value={structureFields.rest_between_sets_sec || ''}
                  onChange={(e) => setStructureFields({ ...structureFields, rest_between_sets_sec: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {block ? 'Update' : 'Create'} Block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}





