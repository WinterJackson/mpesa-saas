'use client';

import { useMemo } from 'react';
import { useChartTheme } from '@/lib/charts/palette';
import type { HeatmapPoint } from '@/lib/repositories/analytics';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function PeakTimeHeatmap({ data }: { data: HeatmapPoint[] }) {
  const { colors, isDark } = useChartTheme();

  // Find max count to scale colors
  const maxCount = useMemo(() => {
    return Math.max(...data.map(d => d.count), 0);
  }, [data]);

  // Use the primary theme color from useChartTheme as the base
  // We'll adjust opacity based on intensity
  const baseColor = colors.success || '#0ca30c'; // default to success green if needed
  
  const getColor = (count: number) => {
    if (count === 0) return isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)';
    
    // Scale opacity from 0.2 to 1.0 based on intensity
    const intensity = maxCount > 0 ? Math.max(0.2, count / maxCount) : 0;
    
    // Convert hex to rgb for opacity (assuming standard hex format)
    let r = 12, g = 163, b = 12; // fallback to #0ca30c
    if (baseColor.startsWith('#') && baseColor.length === 7) {
      r = parseInt(baseColor.slice(1, 3), 16);
      g = parseInt(baseColor.slice(3, 5), 16);
      b = parseInt(baseColor.slice(5, 7), 16);
    }
    
    return `rgba(${r}, ${g}, ${b}, ${intensity})`;
  };

  // Format hour label (e.g., "12 PM", "4 AM")
  const formatHour = (hour: number) => {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    return hour > 12 ? `${hour - 12}pm` : `${hour}am`;
  };

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="min-w-[600px]">
        <div className="flex mb-1">
          <div className="w-12 shrink-0"></div>
          <div className="flex-1 flex justify-between px-1 text-xs text-muted-foreground">
            {/* Show fewer hour labels to avoid crowding */}
            <span>12am</span>
            <span>6am</span>
            <span>12pm</span>
            <span>6pm</span>
            <span>11pm</span>
          </div>
        </div>
        
        <div className="flex flex-col gap-1">
          {DAYS.map((dayLabel, dayIndex) => (
            <div key={dayLabel} className="flex items-center gap-2">
              <div className="w-10 shrink-0 text-xs text-muted-foreground text-right font-medium">
                {dayLabel}
              </div>
              <div className="flex-1 flex gap-1 h-6">
                {Array.from({ length: 24 }).map((_, hourIndex) => {
                  const point = data.find(d => d.dayOfWeek === dayIndex && d.hourOfDay === hourIndex);
                  const count = point?.count || 0;
                  const title = `${count} ${count === 1 ? 'payment' : 'payments'} on ${dayLabel} at ${formatHour(hourIndex)} (EAT)`;
                  
                  return (
                    <div 
                      key={`${dayIndex}-${hourIndex}`}
                      title={title}
                      className="flex-1 h-full rounded-sm cursor-pointer hover:ring-1 hover:ring-ring transition-colors"
                      style={{ backgroundColor: getColor(count) }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: getColor(0) }}></div>
          <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: getColor(maxCount * 0.3) }}></div>
          <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: getColor(maxCount * 0.7) }}></div>
          <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: getColor(maxCount) }}></div>
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
