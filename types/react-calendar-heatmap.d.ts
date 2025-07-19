declare module 'react-calendar-heatmap' {
  import React from 'react';

  export interface CalendarHeatmapProps {
    values?: Array<{
      date: string;
      count?: number;
      [key: string]: any;
    }>;
    startDate?: Date | string;
    endDate?: Date | string;
    numDays?: number;
    width?: number;
    height?: number;
    gutterSize?: number;
    horizontal?: boolean;
    showMonthLabels?: boolean;
    showWeekdayLabels?: boolean;
    showOutOfRangeDays?: boolean;
    tooltipDataAttrs?: (value: any) => { [key: string]: string };
    titleForValue?: (value: any) => string;
    classForValue?: (value: any) => string;
    transformDayElement?: (element: React.ReactElement, value: any, index: number) => React.ReactElement;
    onClick?: (value: any, e: React.MouseEvent) => void;
    onMouseOver?: (value: any, e: React.MouseEvent) => void;
    onMouseLeave?: (value: any, e: React.MouseEvent) => void;
  }

  const CalendarHeatmap: React.FC<CalendarHeatmapProps>;
  export default CalendarHeatmap;
} 