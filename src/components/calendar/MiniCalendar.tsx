import { Calendar } from '../ui/calendar';
import { Button } from '../ui/button';
import { CalendarEvent } from '../../types/calendar';
import { format, addMonths, subMonths, setYear, setMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface MiniCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  events: CalendarEvent[];
}

export function MiniCalendar({ selectedDate, onSelectDate, events }: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);
  const [showYearMonthPicker, setShowYearMonthPicker] = useState(false);

  // Create set of dates that have events (use YYYY-MM-DD format for comparison)
  const eventDateStrings = new Set(
    events.map(event => event.date)
  );

  // Create modifiers for dates with events
  const modifiers = {
    hasEvent: (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return eventDateStrings.has(dateStr);
    }
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    onSelectDate(today);
  };

  const handleYearSelect = (year: number) => {
    setCurrentMonth(setYear(currentMonth, year));
  };

  const handleMonthSelect = (month: number) => {
    setCurrentMonth(setMonth(currentMonth, month));
    setShowYearMonthPicker(false);
  };

  return (
    <div className="mini-calendar-container relative">
      <style>{`
        /* Make day cells larger for touch targets on iPad */
        .mini-calendar-container .rdp-cell,
        .mini-calendar-container .rdp-head_cell {
          width: 36px !important;
          height: 36px !important;
        }

        .mini-calendar-container .rdp-day {
          width: 36px !important;
          height: 36px !important;
          font-size: 14px !important;
          color: hsl(var(--foreground)) !important;
        }

        .mini-calendar-container .rdp-head_cell {
          color: hsl(var(--muted-foreground)) !important;
          font-size: 12px !important;
        }

        /* Selected date styling */
        .mini-calendar-container .rdp-day_selected {
          background-color: hsl(var(--primary)) !important;
          color: hsl(var(--primary-foreground)) !important;
          font-weight: 600 !important;
        }

        /* Today styling */
        .mini-calendar-container .rdp-day_today:not(.rdp-day_selected) {
          background-color: hsl(var(--accent)) !important;
          color: hsl(var(--accent-foreground)) !important;
          font-weight: 600 !important;
        }

        /* Outside days (other month) */
        .mini-calendar-container .rdp-day_outside {
          color: hsl(var(--muted-foreground)) !important;
          opacity: 0.4 !important;
        }

        /* Event indicator dot */
        .mini-calendar-container .rdp-day.has-event {
          font-weight: 700 !important;
        }

        .mini-calendar-container .rdp-day.has-event:not(.rdp-day_selected)::after {
          content: '';
          position: absolute;
          bottom: 3px;
          left: 50%;
          transform: translateX(-50%);
          width: 5px;
          height: 5px;
          background-color: hsl(var(--primary));
          border-radius: 50%;
        }

        .mini-calendar-container .rdp-day.has-event {
          position: relative;
        }

        /* Hover state for interactive feedback */
        .mini-calendar-container .rdp-day:not(.rdp-day_selected):not(.rdp-day_outside):hover {
          background-color: hsl(var(--accent)) !important;
          cursor: pointer;
        }

        /* Hide the default calendar header - use our custom one */
        .mini-calendar-container .rdp-caption {
          display: none !important;
        }

        .mini-calendar-container .rdp-nav {
          display: none !important;
        }

        /* Ensure calendar has consistent min-height */
        .mini-calendar-container .rdp {
          min-height: 280px;
        }

        /* Remove top padding since we removed the caption */
        .mini-calendar-container .rdp-month {
          gap: 0 !important;
        }

        /* Make the table fill the width */
        .mini-calendar-container .rdp-table {
          width: 100% !important;
        }

        .mini-calendar-container .rdp-head_row,
        .mini-calendar-container .rdp-row {
          display: flex !important;
          justify-content: space-around !important;
          width: 100% !important;
        }
      `}</style>

      {/* Header with month navigation */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 min-h-[44px] min-w-[44px]"
            onClick={handlePreviousMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            className="h-10 px-3 font-medium hover:bg-accent min-w-[120px]"
            onClick={() => setShowYearMonthPicker(!showYearMonthPicker)}
          >
            {format(currentMonth, 'MMMM yyyy')}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 min-h-[44px] min-w-[44px]"
            onClick={handleNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar or Year/Month Picker */}
      <div className="min-h-[280px]">
        {showYearMonthPicker ? (
          <div className="py-2">
            <div className="mb-6">
              <h4 className="text-xs font-medium mb-3 text-muted-foreground">Year</h4>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                  <Button
                    key={year}
                    variant={year === currentMonth.getFullYear() ? 'default' : 'outline'}
                    size="sm"
                    className="h-11 text-sm min-h-[44px]"
                    onClick={() => handleYearSelect(year)}
                  >
                    {year}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-medium mb-3 text-muted-foreground">Month</h4>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }, (_, i) => i).map((month) => (
                  <Button
                    key={month}
                    variant={month === currentMonth.getMonth() ? 'default' : 'outline'}
                    size="sm"
                    className="h-11 text-sm min-h-[44px]"
                    onClick={() => handleMonthSelect(month)}
                  >
                    {format(new Date(2024, month, 1), 'MMM')}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && onSelectDate(date)}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            className="rounded-md w-full"
            modifiers={modifiers}
            modifiersClassNames={{
              hasEvent: 'has-event'
            }}
          />
        )}
      </div>
    </div>
  );
}
