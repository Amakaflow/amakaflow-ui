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
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          What equipment do you have?
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
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
                  ? 'border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800'
                  : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0',
                  isSelected
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'font-medium',
                    isSelected
                      ? 'text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-700 dark:text-zinc-300'
                  )}
                >
                  {label}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">{description}</div>
              </div>
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                  isSelected
                    ? 'border-zinc-900 dark:border-zinc-100'
                    : 'border-zinc-300 dark:border-zinc-600'
                )}
              >
                {isSelected && (
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Equipment Toggle */}
      <div className="border-t border-zinc-200 dark:border-zinc-700 pt-6">
        <button
          type="button"
          onClick={() => setUseCustomEquipment(!state.useCustomEquipment)}
          className={cn(
            'flex items-center gap-3 w-full p-4 rounded-lg border-2 text-left transition-colors',
            state.useCustomEquipment
              ? 'border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800'
              : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
          )}
        >
          <div
            aria-hidden="true"
            className={cn(
              'w-4 h-4 rounded flex items-center justify-center border flex-shrink-0',
              state.useCustomEquipment
                ? 'border-zinc-900 bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100'
                : 'border-zinc-300 dark:border-zinc-600'
            )}
          >
            {state.useCustomEquipment && (
              <svg className="w-3 h-3 text-white dark:text-zinc-900" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <div
              className={cn(
                'font-medium',
                state.useCustomEquipment
                  ? 'text-zinc-900 dark:text-zinc-100'
                  : 'text-zinc-700 dark:text-zinc-300'
              )}
            >
              Custom Equipment
            </div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              Select exactly what you have available
            </div>
          </div>
        </button>
      </div>

      {/* Custom Equipment Grid */}
      {state.useCustomEquipment && (
        <div className="space-y-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600'
                  )}
                >
                  <div
                    aria-hidden="true"
                    className={cn(
                      'w-4 h-4 rounded flex items-center justify-center border flex-shrink-0',
                      isSelected
                        ? 'border-white bg-white dark:border-zinc-900 dark:bg-zinc-900'
                        : 'border-zinc-400 dark:border-zinc-500'
                    )}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-zinc-900 dark:text-white" viewBox="0 0 12 12" fill="none">
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
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Please select at least one piece of equipment
            </p>
          )}
        </div>
      )}
    </div>
  );
}
