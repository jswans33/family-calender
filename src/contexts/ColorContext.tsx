import React, { createContext, useContext, useState, useEffect } from 'react';

import { CalendarColors } from '../types/shared';

interface ColorContextType {
  colors: CalendarColors;
  updateColor: (calendarName: string, color: string) => void;
  resetToDefaults: () => void;
  getCalendarColor: (calendarName: string) => string;
}

import { CALENDAR_CONFIG, STORAGE_KEYS } from '../config/constants';

const DEFAULT_COLORS: CalendarColors = CALENDAR_CONFIG.DEFAULT_COLORS;

const STORAGE_KEY = STORAGE_KEYS.CALENDAR_COLORS;

const ColorContext = createContext<ColorContextType | undefined>(undefined);

export const ColorProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [colors, setColors] = useState<CalendarColors>(DEFAULT_COLORS);

  useEffect(() => {
    const savedColors = localStorage.getItem(STORAGE_KEY);
    if (savedColors) {
      try {
        const parsed = JSON.parse(savedColors);
        setColors({ ...DEFAULT_COLORS, ...parsed });
      } catch (error) {
        console.error('Failed to parse saved colors:', error);
      }
    }
  }, []);

  const updateColor = (calendarName: string, color: string) => {
    const newColors = { ...colors, [calendarName]: color };
    setColors(newColors);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newColors));
  };

  const resetToDefaults = () => {
    setColors(DEFAULT_COLORS);
    localStorage.removeItem(STORAGE_KEY);
  };

  const getCalendarColor = (calendarName: string): string => {
    return (
      colors[calendarName] ||
      DEFAULT_COLORS[calendarName] ||
      CALENDAR_CONFIG.FALLBACK_COLOR
    );
  };

  return (
    <ColorContext.Provider
      value={{ colors, updateColor, resetToDefaults, getCalendarColor }}
    >
      {children}
    </ColorContext.Provider>
  );
};

export const useColors = (): ColorContextType => {
  const context = useContext(ColorContext);
  if (!context) {
    throw new Error('useColors must be used within a ColorProvider');
  }
  return context;
};
