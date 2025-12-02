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
        /* Target the day button specifically */
        .mini-calendar-container .rdp-day.has-event {
          font-weight: 700 !important;
        }
        
        .mini-calendar-container .rdp-day.has-event button {
          position: relative;
          font-weight: 700 !important;
        }
        
        .mini-calendar-container .rdp-day.has-event button::after {
          content: '';
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          background-color: #3b82f6;
          border-radius: 50%;
        }
        
        /* Hide the default calendar header - use more specific selectors */
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
      `}</style>

      {/* Single Unified Header - ONLY header in component */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handlePreviousMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            className="h-8 px-3 font-medium hover:bg-accent min-w-[140px]"
            onClick={() => setShowYearMonthPicker(!showYearMonthPicker)}
          >
            {format(currentMonth, 'MMMM yyyy')}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleNextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Unified Grid Container - Same container for both variants */}
      <div className="min-h-[280px]">
        {showYearMonthPicker ? (
          /* Variant B: Year/Month Picker View */
          <div className="py-2">
            <div className="mb-6">
              <h4 className="text-xs font-medium mb-3 text-muted-foreground">Year</h4>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                  <Button
                    key={year}
                    variant={year === currentMonth.getFullYear() ? 'default' : 'outline'}
                    size="sm"
                    className="h-9 text-sm"
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
                    className="h-9 text-sm"
                    onClick={() => handleMonthSelect(month)}
                  >
                    {format(new Date(2024, month, 1), 'MMM')}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Variant A: Month View */
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && onSelectDate(date)}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            className="rounded-md"
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