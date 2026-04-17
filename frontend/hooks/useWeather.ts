/**
 * useWeather.ts
 * ─────────────
 * Hook lấy dự báo thời tiết 7 ngày từ Open-Meteo (free, no API key).
 * - Tự động detect tỉnh từ GPS (expo-location + Nominatim)
 * - Hoặc load tỉnh đã lưu trong AsyncStorage
 * - Tính risk score từng ngày dựa trên nhiệt độ, độ ẩm, lượng mưa
 * - Cache kết quả 1 giờ
 */

import { useState, useEffect, useCallback } from "react";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ═══════════════════════════════════════════════════════════════
//  PROVINCE DATABASE
// ═══════════════════════════════════════════════════════════════
export type ProvinceInfo = {
  lat: number;
  lon: number;
  neighbors: string[];
};

export const PROVINCES: Record<string, ProvinceInfo> = {
  "Bình Phước":   { lat: 11.75, lon: 106.92, neighbors: ["Bình Dương", "Đồng Nai", "Tây Ninh", "Đắk Nông", "Lâm Đồng"] },
  "Đắk Lắk":     { lat: 12.71, lon: 108.24, neighbors: ["Đắk Nông", "Lâm Đồng", "Gia Lai", "Khánh Hòa"] },
  "Đắk Nông":    { lat: 12.00, lon: 107.69, neighbors: ["Đắk Lắk", "Lâm Đồng", "Bình Phước", "Gia Lai"] },
  "Lâm Đồng":    { lat: 11.95, lon: 108.44, neighbors: ["Đắk Lắk", "Đắk Nông", "Đồng Nai", "Khánh Hòa"] },
  "Đồng Nai":    { lat: 11.07, lon: 107.17, neighbors: ["Bình Phước", "Bình Dương", "Lâm Đồng"] },
  "Bình Dương":  { lat: 11.33, lon: 106.61, neighbors: ["Bình Phước", "Đồng Nai", "Tây Ninh"] },
  "Tây Ninh":    { lat: 11.31, lon: 106.10, neighbors: ["Bình Phước", "Bình Dương"] },
  "Tiền Giang":  { lat: 10.35, lon: 106.36, neighbors: ["Bến Tre", "Vĩnh Long", "Long An"] },
  "Bến Tre":     { lat: 10.24, lon: 106.38, neighbors: ["Tiền Giang", "Vĩnh Long", "Trà Vinh"] },
  "Vĩnh Long":   { lat: 10.24, lon: 105.97, neighbors: ["Tiền Giang", "Bến Tre", "Cần Thơ"] },
  "Cần Thơ":     { lat: 10.03, lon: 105.78, neighbors: ["Vĩnh Long", "Hậu Giang", "An Giang"] },
  "Hậu Giang":   { lat: 9.79,  lon: 105.64, neighbors: ["Cần Thơ", "Sóc Trăng", "Kiên Giang"] },
  "Khánh Hòa":   { lat: 12.25, lon: 109.18, neighbors: ["Đắk Lắk", "Lâm Đồng", "Ninh Thuận"] },
  "Gia Lai":     { lat: 13.98, lon: 108.00, neighbors: ["Đắk Lắk", "Đắk Nông", "Kon Tum"] },
  "Kon Tum":     { lat: 14.35, lon: 108.00, neighbors: ["Gia Lai"] },
  "Long An":     { lat: 10.54, lon: 106.41, neighbors: ["Tiền Giang", "Đồng Tháp"] },
  "Đồng Tháp":   { lat: 10.49, lon: 105.63, neighbors: ["Long An", "An Giang", "Cần Thơ"] },
  "An Giang":    { lat: 10.38, lon: 105.44, neighbors: ["Đồng Tháp", "Cần Thơ", "Kiên Giang"] },
  "Kiên Giang":  { lat: 10.01, lon: 105.08, neighbors: ["An Giang", "Hậu Giang", "Cần Thơ"] },
  "Ninh Thuận":  { lat: 11.57, lon: 108.99, neighbors: ["Khánh Hòa", "Lâm Đồng", "Bình Thuận"] },
  "Bình Thuận":  { lat: 10.93, lon: 108.10, neighbors: ["Ninh Thuận", "Lâm Đồng", "Đồng Nai"] },
};

// Nominatim alias → key trong PROVINCES
const NOMINATIM_ALIAS: Record<string, string> = {
  "Bình Phước Province":   "Bình Phước",
  "Đắk Lắk Province":      "Đắk Lắk",
  "Dak Lak":               "Đắk Lắk",
  "Đắk Nông Province":     "Đắk Nông",
  "Lâm Đồng Province":     "Lâm Đồng",
  "Đồng Nai Province":     "Đồng Nai",
  "Bình Dương Province":   "Bình Dương",
  "Tây Ninh Province":     "Tây Ninh",
  "Tiền Giang Province":   "Tiền Giang",
  "Bến Tre Province":      "Bến Tre",
  "Vĩnh Long Province":    "Vĩnh Long",
  "Cần Thơ":               "Cần Thơ",
  "Can Tho":               "Cần Thơ",
  "Hậu Giang Province":    "Hậu Giang",
  "Khánh Hòa Province":    "Khánh Hòa",
  "Gia Lai Province":      "Gia Lai",
  "Kon Tum Province":      "Kon Tum",
  "Long An Province":      "Long An",
  "Đồng Tháp Province":    "Đồng Tháp",
  "An Giang Province":     "An Giang",
  "Kiên Giang Province":   "Kiên Giang",
  "Ninh Thuận Province":   "Ninh Thuận",
  "Bình Thuận Province":   "Bình Thuận",
};

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════
export type RiskLevel = "low" | "medium" | "high" | "very_high";

export type DayForecast = {
  date: string;        // YYYY-MM-DD
  tempMax: number;
  tempMin: number;
  humidity: number;
  rain: number;        // mm
  uvIndex: number;
  weatherCode: number; // WMO code
  riskLevel: RiskLevel;
  riskScore: number;   // 0-100
};

export type ProvinceWeather = {
  province: string;
  forecasts: DayForecast[];
  weekRisk: RiskLevel;        // nguy cơ cao nhất trong tuần
  rainDays: number;           // số ngày mưa
  avgHumidity: number;
};

export type WeatherState = {
  loading: boolean;
  error: string | null;
  currentProvince: string | null;
  currentWeather: ProvinceWeather | null;
  neighborWeathers: ProvinceWeather[];
  lastUpdated: number | null;      // timestamp
  recommendation: string[];        // khuyến nghị tuần
  bestSprayDay: string | null;     // ngày tốt nhất để phun thuốc (YYYY-MM-DD)
};

// ═══════════════════════════════════════════════════════════════
//  WEATHER CODE → EMOJI
// ═══════════════════════════════════════════════════════════════
export function weatherEmoji(code: number): string {
  if (code === 0)                    return "☀️";
  if (code <= 2)                     return "⛅";
  if (code === 3)                    return "☁️";
  if (code <= 49)                    return "🌫️";
  if (code <= 59)                    return "🌦️";
  if (code <= 69)                    return "🌧️";
  if (code <= 79)                    return "❄️";
  if (code <= 84)                    return "🌧️";
  if (code <= 94)                    return "⛈️";
  return "🌩️";
}

// ═══════════════════════════════════════════════════════════════
//  RISK ENGINE
// ═══════════════════════════════════════════════════════════════
export function calcRiskScore(temp: number, humidity: number, rain: number): number {
  let score = 0;
  // Mưa
  if (rain >= 20) score += 40;
  else if (rain >= 10) score += 30;
  else if (rain >= 5) score += 20;
  else if (rain > 0) score += 10;
  // Độ ẩm
  if (humidity >= 90) score += 30;
  else if (humidity >= 85) score += 20;
  else if (humidity >= 80) score += 10;
  // Nhiệt độ (25-30°C lý tưởng cho nấm bệnh)
  if (temp >= 25 && temp <= 30) score += 20;
  else if (temp >= 22 && temp <= 33) score += 10;
  return Math.min(score, 100);
}

export function scoreToRisk(score: number): RiskLevel {
  if (score >= 70) return "very_high";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  low:       "🟢 Thấp",
  medium:    "🟡 Trung bình",
  high:      "🟠 Cao",
  very_high: "🔴 Rất cao",
};

export const RISK_COLOR: Record<RiskLevel, string> = {
  low:       "#4caf50",
  medium:    "#ff9800",
  high:      "#f44336",
  very_high: "#b71c1c",
};

export const RISK_BG: Record<RiskLevel, string> = {
  low:       "#e8f5e9",
  medium:    "#fff8e1",
  high:      "#ffebee",
  very_high: "#fce4ec",
};

// ═══════════════════════════════════════════════════════════════
//  RECOMMENDATION ENGINE
// ═══════════════════════════════════════════════════════════════
function buildRecommendations(forecasts: DayForecast[]): { tips: string[]; bestSprayDay: string | null } {
  const tips: string[] = [];
  const highRiskDays = forecasts.filter(f => f.riskScore >= 50).length;
  const rainDays     = forecasts.filter(f => f.rain > 5).length;
  const avgHum       = forecasts.reduce((s, f) => s + f.humidity, 0) / forecasts.length;

  // Tìm ngày tốt nhất phun thuốc (nắng, ẩm thấp, không mưa)
  const bestDay = forecasts.find(f => f.rain < 2 && f.humidity < 78 && f.riskScore < 30);

  if (highRiskDays >= 4) {
    tips.push("⚠️ Tuần nguy hiểm — chuẩn bị Metalaxyl / Fosetyl-Al ngay hôm nay");
    tips.push("🔍 Kiểm tra vườn mỗi ngày, phát hiện sớm triệu chứng cháy lá, thán thư");
  } else if (highRiskDays >= 2) {
    tips.push("⚡ Có ngày nguy cơ cao — theo dõi sát, sẵn sàng phun phòng ngừa");
  }

  if (rainDays >= 4) {
    tips.push("🌧️ Mưa nhiều — kiểm tra thoát nước, tránh đọng nước gốc cây");
    tips.push("🚫 Không phun thuốc trong ngày mưa (bị rửa trôi)");
  }

  if (avgHum > 85) {
    tips.push("💧 Độ ẩm cao kéo dài — tỉa cành tạo thông thoáng tán cây");
  }

  if (bestDay) {
    const [, m, d] = bestDay.date.split("-");
    tips.push(`✅ Thời điểm phun thuốc tốt nhất: ngày ${d}/${m} (trời nắng, ẩm thấp)`);
  }

  if (tips.length === 0) {
    tips.push("🟢 Tuần này nguy cơ thấp — tiếp tục chăm sóc định kỳ");
    tips.push("📋 Kiểm tra vườn 2-3 lần/tuần để phát hiện sớm");
  }

  return { tips, bestSprayDay: bestDay?.date ?? null };
}

// ═══════════════════════════════════════════════════════════════
//  OPEN-METEO FETCHER
// ═══════════════════════════════════════════════════════════════
async function fetchWeatherForProvince(province: string): Promise<ProvinceWeather | null> {
  const info = PROVINCES[province];
  if (!info) return null;
  try {
    const url = `https://api.open-meteo.com/v1/forecast`
      + `?latitude=${info.lat}&longitude=${info.lon}`
      + `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,`
      + `relative_humidity_2m_mean,uv_index_max,weather_code`
      + `&timezone=Asia%2FHo_Chi_Minh&forecast_days=7`;

    const res  = await fetch(url);
    const json = await res.json();
    const d    = json.daily;
    const forecasts: DayForecast[] = d.time.map((date: string, i: number) => {
      const temp     = (d.temperature_2m_max[i] + d.temperature_2m_min[i]) / 2;
      const humidity = d.relative_humidity_2m_mean[i] ?? 70;
      const rain     = d.precipitation_sum[i] ?? 0;
      const score    = calcRiskScore(temp, humidity, rain);
      return {
        date,
        tempMax:     Math.round(d.temperature_2m_max[i]),
        tempMin:     Math.round(d.temperature_2m_min[i]),
        humidity:    Math.round(humidity),
        rain:        Math.round(rain * 10) / 10,
        uvIndex:     d.uv_index_max[i] ?? 0,
        weatherCode: d.weather_code[i] ?? 0,
        riskScore:   score,
        riskLevel:   scoreToRisk(score),
      };
    });

    const weekScore   = Math.max(...forecasts.map(f => f.riskScore));
    const rainDays    = forecasts.filter(f => f.rain > 5).length;
    const avgHumidity = Math.round(forecasts.reduce((s, f) => s + f.humidity, 0) / forecasts.length);

    return { province, forecasts, weekRisk: scoreToRisk(weekScore), rainDays, avgHumidity };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  REVERSE GEOCODE — Nominatim (free, no key)
// ═══════════════════════════════════════════════════════════════
async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=vi`;
    const res  = await fetch(url, { headers: { "User-Agent": "DurianApp/1.0" } });
    const json = await res.json();
    const state = json?.address?.state ?? json?.address?.province ?? "";
    // Try direct match
    if (PROVINCES[state]) return state;
    // Try alias map
    for (const [alias, key] of Object.entries(NOMINATIM_ALIAS)) {
      if (state.includes(alias) || alias.includes(state)) return key;
    }
    // Try partial match
    for (const key of Object.keys(PROVINCES)) {
      if (state.includes(key) || key.includes(state)) return key;
    }
    return null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  FIND NEAREST PROVINCE (fallback khi GPS không match)
// ═══════════════════════════════════════════════════════════════
function nearestProvince(lat: number, lon: number): string {
  let best = "Bình Phước";
  let bestDist = Infinity;
  for (const [name, info] of Object.entries(PROVINCES)) {
    const d = Math.sqrt((lat - info.lat) ** 2 + (lon - info.lon) ** 2);
    if (d < bestDist) { bestDist = d; best = name; }
  }
  return best;
}

// ═══════════════════════════════════════════════════════════════
//  CACHE KEYS
// ═══════════════════════════════════════════════════════════════
const CACHE_KEY      = "weather_cache_v2";
const PROVINCE_KEY   = "weather_province";
const CACHE_TTL      = 60 * 60 * 1000; // 1 giờ

// ═══════════════════════════════════════════════════════════════
//  MAIN HOOK
// ═══════════════════════════════════════════════════════════════
export function useWeather() {
  const [state, setState] = useState<WeatherState>({
    loading: true,
    error: null,
    currentProvince: null,
    currentWeather: null,
    neighborWeathers: [],
    lastUpdated: null,
    recommendation: [],
    bestSprayDay: null,
  });

  const load = useCallback(async (forceRefresh = false) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      // 1. Load cache (nếu còn valid và không force)
      if (!forceRefresh) {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.ts < CACHE_TTL) {
            setState({ ...parsed.data, loading: false, error: null });
            return;
          }
        }
      }

      // 2. Xác định tỉnh
      let province: string | null = await AsyncStorage.getItem(PROVINCE_KEY);

      if (!province) {
        // Thử GPS
        try {
          const perm = await Location.requestForegroundPermissionsAsync();
          if (perm.granted) {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
            const { latitude, longitude } = loc.coords;
            province = await reverseGeocode(latitude, longitude);
            if (!province) province = nearestProvince(latitude, longitude);
          }
        } catch {}
        if (!province) province = "Bình Phước"; // default
        await AsyncStorage.setItem(PROVINCE_KEY, province);
      }

      // 3. Fetch thời tiết song song (tỉnh hiện tại + lân cận)
      const neighborNames = (PROVINCES[province]?.neighbors ?? []).slice(0, 4);
      const allNames = [province, ...neighborNames];
      const results  = await Promise.all(allNames.map(fetchWeatherForProvince));

      const currentWeather   = results[0];
      const neighborWeathers = results.slice(1).filter(Boolean) as ProvinceWeather[];

      if (!currentWeather) throw new Error("Không lấy được dữ liệu thời tiết");

      const { tips, bestSprayDay } = buildRecommendations(currentWeather.forecasts);

      const newState: WeatherState = {
        loading:        false,
        error:          null,
        currentProvince: province,
        currentWeather,
        neighborWeathers,
        lastUpdated:    Date.now(),
        recommendation: tips,
        bestSprayDay,
      };

      // 4. Lưu cache
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: newState }));
      setState(newState);

    } catch (e: any) {
      setState(s => ({ ...s, loading: false, error: e?.message ?? "Lỗi tải dữ liệu" }));
    }
  }, []);

  // Cho phép thay đổi tỉnh thủ công
  const changeProvince = useCallback(async (province: string) => {
    await AsyncStorage.setItem(PROVINCE_KEY, province);
    await AsyncStorage.removeItem(CACHE_KEY);
    load(true);
  }, [load]);

  useEffect(() => { load(); }, [load]);

  return { ...state, refresh: () => load(true), changeProvince };
}
