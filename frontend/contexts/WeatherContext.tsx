/**
 * WeatherContext.tsx
 * ──────────────────
 * Single source of truth cho toàn bộ weather state.
 * Cả WeatherBanner (Camera tab) và WeatherCard (Treatment tab)
 * đều dùng chung 1 instance — đổi tỉnh ở đâu, cập nhật ở đó.
 */

import React, { createContext, useContext, ReactNode } from "react";
import { useWeather } from "../hooks/useWeather";

// Re-export type từ hook để các component import 1 chỗ
export type { WeatherState, ProvinceWeather, DayForecast, RiskLevel } from "../hooks/useWeather";

type WeatherContextType = ReturnType<typeof useWeather>;

const WeatherContext = createContext<WeatherContextType | null>(null);

export function WeatherProvider({ children }: { children: ReactNode }) {
  const weather = useWeather();
  return (
    <WeatherContext.Provider value={weather}>
      {children}
    </WeatherContext.Provider>
  );
}

export function useWeatherContext(): WeatherContextType {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error("useWeatherContext must be used inside <WeatherProvider>");
  return ctx;
}
