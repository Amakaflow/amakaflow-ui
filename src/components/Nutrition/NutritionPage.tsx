import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Droplets, Flame, ImagePlus, Plus, Utensils, Zap } from 'lucide-react';

interface MacroEntry {
  label: string;
  value: number;
  goal: number;
  unit: string;
  color: string;
}

interface FoodEntry {
  id: string;
  name: string;
  calories: number;
  time: string;
}

const MOCK_MACROS: MacroEntry[] = [
  { label: 'Calories', value: 1840, goal: 2400, unit: 'kcal', color: 'bg-orange-500' },
  { label: 'Protein',  value: 112,  goal: 160,  unit: 'g',    color: 'bg-blue-500' },
  { label: 'Carbs',    value: 220,  goal: 280,  unit: 'g',    color: 'bg-yellow-500' },
  { label: 'Fat',      value: 58,   goal: 80,   unit: 'g',    color: 'bg-purple-500' },
];

const MOCK_LOG: FoodEntry[] = [
  { id: '1', name: 'Oatmeal with berries',        calories: 320, time: '7:30 AM' },
  { id: '2', name: 'Grilled chicken + rice',       calories: 580, time: '12:15 PM' },
  { id: '3', name: 'Protein shake',                calories: 210, time: '3:00 PM' },
  { id: '4', name: 'Salmon with sweet potato',     calories: 490, time: '6:45 PM' },
  { id: '5', name: 'Greek yogurt',                 calories: 150, time: '9:00 PM' },
];

function fuelingStatus(calories: number, goal: number): 'green' | 'yellow' | 'red' | 'orange' {
  const pct = calories / goal;
  if (pct > 1.1)                  return 'orange';
  if (pct >= 0.75 && pct <= 1.1)  return 'green';
  if (pct >= 0.5)                 return 'yellow';
  return 'red';
}

const STATUS_CONFIG = {
  green:  { label: 'Well Fueled',      bg: 'bg-green-500/10',  text: 'text-green-600',  border: 'border-green-200 dark:border-green-800' },
  yellow: { label: 'Getting There',    bg: 'bg-yellow-500/10', text: 'text-yellow-600', border: 'border-yellow-200 dark:border-yellow-800' },
  orange: { label: 'Over Target',      bg: 'bg-orange-500/10', text: 'text-orange-600', border: 'border-orange-200 dark:border-orange-800' },
  red:    { label: 'Under-Fueled',     bg: 'bg-red-500/10',    text: 'text-red-600',    border: 'border-red-200 dark:border-red-800' },
};

export function NutritionPage() {
  const [logText, setLogText]       = useState('');
  const [foodLog, setFoodLog]       = useState<FoodEntry[]>(MOCK_LOG);
  const [waterGlasses, setWater]    = useState(5);
  const WATER_GOAL = 8;

  const totalCalories = foodLog.reduce((s, e) => s + e.calories, 0);
  const status = fuelingStatus(totalCalories, MOCK_MACROS[0].goal);
  const statusCfg = STATUS_CONFIG[status];

  function handleLogFood() {
    if (!logText.trim()) return;
    const newEntry: FoodEntry = {
      id:       Date.now().toString(),
      name:     logText.trim(),
      calories: Math.floor(Math.random() * 400) + 100,
      time:     new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setFoodLog(prev => [newEntry, ...prev]);
    setLogText('');
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Nutrition</h1>
          <p className="text-muted-foreground text-sm">Today's fuel overview</p>
        </div>
        <Badge
          variant="outline"
          className={`${statusCfg.bg} ${statusCfg.text} ${statusCfg.border} font-semibold px-3 py-1`}
        >
          <Zap className="w-3 h-3 mr-1 inline" />
          {statusCfg.label}
        </Badge>
      </div>

      {/* Macro summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {MOCK_MACROS.map((m) => {
          const pct = Math.min(100, Math.round((m.value / m.goal) * 100));
          return (
            <Card key={m.label}>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                <p className="text-xl font-bold">
                  {m.value}
                  <span className="text-xs font-normal text-muted-foreground ml-1">{m.unit}</span>
                </p>
                <p className="text-xs text-muted-foreground mb-2">of {m.goal}{m.unit}</p>
                <Progress value={pct} className="h-1.5" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Water tracker */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Droplets className="w-4 h-4 text-blue-500" />
            Water
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground">
              {waterGlasses}/{WATER_GOAL} glasses
            </span>
            <div className="flex gap-1">
              {Array.from({ length: WATER_GOAL }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setWater(waterGlasses === i + 1 ? i : i + 1)}
                  aria-label={`Set water to ${i + 1} glasses`}
                  className={`w-7 h-7 rounded-full border-2 transition-colors ${
                    i < waterGlasses
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'border-muted-foreground/30 text-muted-foreground/30'
                  }`}
                >
                  <Droplets className="w-3 h-3 mx-auto" />
                </button>
              ))}
            </div>
            {waterGlasses >= WATER_GOAL && (
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800">
                Goal reached!
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Log food */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Utensils className="w-4 h-4 text-orange-500" />
            Log Food
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={logText}
              onChange={e => setLogText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogFood()}
              placeholder="What did you eat? (e.g. chicken wrap)"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button onClick={handleLogFood} size="sm" className="gap-1">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
          <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto" disabled>
            <ImagePlus className="w-4 h-4" />
            Photo log (coming soon)
          </Button>
        </CardContent>
      </Card>

      {/* Today's log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="w-4 h-4 text-red-500" />
            Today's Log
            <Badge variant="secondary" className="ml-auto font-normal text-xs">
              {totalCalories} kcal total
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {foodLog.map(entry => (
            <div key={entry.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium">{entry.name}</p>
                <p className="text-xs text-muted-foreground">{entry.time}</p>
              </div>
              <span className="text-sm font-semibold text-orange-600">
                {entry.calories} kcal
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
