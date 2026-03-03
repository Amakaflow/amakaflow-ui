'use client';

import { Building2, Home, Dumbbell, User } from 'lucide-react';
import { useProgramWizard } from '@/context/ProgramWizardContext';
import {
  EquipmentPreset,
  EQUIPMENT_LABELS,
  ALL_EQUIPMENT,
  EQUIPMENT_LABELS_MAP,
} from '@/types/program-wizard';
import { cn } from '@/components/ui/utils';

const equipmentIcons: Record<EquipmentPreset, React.ComponentType<{ className?: string }>> = {
  full_gym: Building2,
  home_advanced: Home,
  home_basic: Dumbbell,
  bodyweight: User,
};

const presets: EquipmentPreset[] = ['full_gym', 'home_advanced', 'home_basic', 'bodyweight'];

export function EquipmentStep() {
  const {
    state,
    setEquipmentPreset,
    setUseCustomEquipment,
    toggleEquipmentItem,
  } = useProgramWizard();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">
          What equipment do you have?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a preset or customize your equipment list
        </p>
      </div>

      {/* Preset Options */}
      <div className="grid gap-3 sm:grid-cols-2">
        {presets.map((preset) => {
          const Icon = equipmentIcons[preset];
          const { label, description } = EQUIPMENT_LABELS[preset];
          const isSelected = state.equipmentPreset === preset && !state.useCustomEquipment;

          return (
            <button
              key={preset}
              type="button"
              onClick={() => setEquipmentPreset(preset)}
              className={cn(
                'flex items-start gap-3 w-full p-4 rounded-lg border-2 text-left transition-colors',
                isSelected
                  ? 'border-primary bg-secondary'
                  : 'border-border hover:border-primary'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground">
                  {label}
                </div>
                <div className="text-sm text-muted-foreground">{description}</div>
              </div>
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                  isSelected
                    ? 'border-primary'
                    : 'border-gray-300'
                )}
              >
                {isSelected && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Validation hint when nothing selected */}
      {!state.equipmentPreset && !state.useCustomEquipment && (
        <p className="text-xs text-amber-600">
          Please choose an equipment option
        </p>
      )}

      {/* Custom Equipment Toggle */}
      <div className="border-t border-border pt-6">
        <button
          type="button"
          onClick={() => setUseCustomEquipment(!state.useCustomEquipment)}
          className={cn(
            'flex items-center gap-3 w-full p-4 rounded-lg border-2 text-left transition-colors',
            state.useCustomEquipment
              ? 'border-primary bg-secondary'
              : 'border-border hover:border-primary'
          )}
        >
          <div
            aria-hidden="true"
            className={cn(
              'w-4 h-4 rounded flex items-center justify-center border flex-shrink-0',
              state.useCustomEquipment
                ? 'border-primary bg-primary'
                : 'border-gray-300'
            )}
          >
            {state.useCustomEquipment && (
              <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <div className="font-medium text-foreground">
              Custom Equipment
            </div>
            <div className="text-sm text-muted-foreground">
              Select exactly what you have available
            </div>
          </div>
        </button>
      </div>

      {/* Custom Equipment Grid */}
      {state.useCustomEquipment && (
        <div className="space-y-3 p-4 bg-secondary rounded-lg">
          <div className="text-sm font-medium text-foreground">
            Select your equipment
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALL_EQUIPMENT.map((item) => {
              const isSelected = state.customEquipment.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleEquipmentItem(item)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary'
                  )}
                >
                  <div
                    aria-hidden="true"
                    className={cn(
                      'w-4 h-4 rounded flex items-center justify-center border flex-shrink-0',
                      isSelected
                        ? 'border-transparent bg-white'
                        : 'border-gray-300'
                    )}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-primary" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="truncate">{EQUIPMENT_LABELS_MAP[item] || item}</span>
                </button>
              );
            })}
          </div>
          {state.customEquipment.length === 0 && (
            <p className="text-xs text-amber-600">
              Please select at least one piece of equipment
            </p>
          )}
        </div>
      )}
    </div>
  );
}
