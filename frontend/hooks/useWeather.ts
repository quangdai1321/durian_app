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

/** Mùa vụ dựa vào tháng hiện tại (miền Nam VN) */
function detectSeason(): "dry" | "rainy" | "transition" {
  const m = new Date().getMonth() + 1; // 1-12
  if (m >= 12 || m <= 3) return "dry";
  if (m >= 5 && m <= 10) return "rainy";
  return "transition"; // 4, 11
}

/**
 * Tìm ngày tốt nhất phun thuốc:
 * Ưu tiên: không mưa, ẩm < 78%, không quá nóng (< 36°)
 */
function findBestSprayDay(forecasts: DayForecast[]): DayForecast | undefined {
  return forecasts.find(f => f.rain < 2 && f.humidity < 78 && f.tempMax < 36 && f.riskScore < 40);
}

/** Đếm số ngày sắp tới có thời tiết thuận lợi cho bệnh cụ thể */
function countDangerousDays(
  forecasts: DayForecast[],
  minRain: number,
  minHumidity: number,
): number {
  return forecasts.filter(f => f.rain >= minRain || f.humidity >= minHumidity).length;
}

/**
 * buildSmartRecommendations — Rule engine có ngữ cảnh
 * @param forecasts      7 ngày dự báo
 * @param recentDisease  lớp bệnh từ lần chẩn đoán gần nhất (có thể null)
 * @param diagnosedAt    timestamp (ms) chẩn đoán gần nhất để tính "vừa mới" hay "cũ"
 */
export function buildSmartRecommendations(
  forecasts: DayForecast[],
  recentDisease?: string | null,
  diagnosedAt?: number | null,
): { tips: string[]; bestSprayDay: string | null } {
  const tips: string[] = [];
  const season        = detectSeason();
  const highRiskDays  = forecasts.filter(f => f.riskScore >= 50).length;
  const rainDays      = forecasts.filter(f => f.rain > 5).length;
  const avgHum        = Math.round(forecasts.reduce((s, f) => s + f.humidity, 0) / forecasts.length);
  const maxRain       = Math.max(...forecasts.map(f => f.rain));
  const bestDay       = findBestSprayDay(forecasts);

  // ── Kiểm tra chẩn đoán có "mới" không (trong 7 ngày qua) ──
  const isRecent = diagnosedAt != null && Date.now() - diagnosedAt < 7 * 24 * 60 * 60 * 1000;

  // ── Mùa vụ context ──
  const seasonNote =
    season === "dry"        ? "Mùa khô" :
    season === "rainy"      ? "Mùa mưa" :
    "Giai đoạn chuyển mùa";

  // ═══════════════════════════════════════════════════════════
  //  PHẦN 1 — Lời khuyên cá nhân hoá theo bệnh vừa chẩn đoán
  // ═══════════════════════════════════════════════════════════
  if (recentDisease && isRecent) {
    const dangerDays = countDangerousDays(forecasts.slice(0, 4), 3, 80);

    switch (recentDisease) {
      case "Leaf_Blight": {
        // Phytophthora — phát tán mạnh khi mưa + ẩm
        if (dangerDays >= 3) {
          tips.push(`🚨 Vườn vừa phát hiện Cháy lá — ${dangerDays} ngày tới mưa ẩm thuận lợi cho bệnh lan nhanh. Phun Metalaxyl + Fosetyl-Al ngay hôm nay!`);
          tips.push("🔍 Kiểm tra lá buổi sáng mỗi ngày, cắt bỏ ngay cành lá bị nặng, tiêu hủy ngoài vườn.");
        } else if (dangerDays >= 1) {
          tips.push("⚠️ Vườn có Cháy lá — sắp có 1-2 ngày mưa. Phun phòng Metalaxyl trước khi mưa đến.");
          tips.push("💡 Pha thêm chất bám dính khi phun để thuốc không bị rửa trôi.");
        } else {
          tips.push("✅ Vườn có Cháy lá nhưng tuần này thời tiết khô — tranh thủ phun Metalaxyl để kiểm soát.");
        }
        tips.push("🌿 Tỉa tán thông thoáng, tránh tưới ướt lá — Phytophthora lây qua nước bắn.");
        break;
      }

      case "Leaf_Colletotrichum": {
        // Thán thư — mưa nhẹ + ẩm cao
        const humidDays = forecasts.slice(0, 4).filter(f => f.humidity > 80).length;
        if (humidDays >= 3) {
          tips.push(`⚠️ Vườn có Thán thư — ${humidDays} ngày tới ẩm > 80%, bệnh dễ lây sang lá non. Phun Carbendazim hoặc Thiophanate-methyl ngay.`);
        } else {
          tips.push("🍂 Vườn có Thán thư — thời tiết tạm ổn, duy trì phun phòng Carbendazim 1 lần/tuần.");
        }
        tips.push("✂️ Cắt bỏ lá bệnh đã chuyển nâu, thu gom và tiêu hủy để cắt nguồn bào tử.");
        break;
      }

      case "Leaf_Algal": {
        // Đốm tảo — ẩm cao + ít gió
        const wetDays = countDangerousDays(forecasts.slice(0, 5), 1, 85);
        if (wetDays >= 3) {
          tips.push(`🦠 Vườn có Đốm tảo — ${wetDays} ngày tới ẩm ướt kéo dài. Phun Copper Oxychloride hoặc Bordeaux mixture để ngăn tảo lan.`);
        } else {
          tips.push("🦠 Vườn có Đốm tảo — phun Copper Oxychloride phòng ngừa, đặc biệt mặt dưới lá.");
        }
        tips.push("☀️ Tỉa cành để ánh sáng và gió vào tán — tảo không phát triển được ở nơi khô thoáng.");
        break;
      }

      case "Leaf_Rhizoctonia": {
        // Rhizoctonia — ẩm cao + đất ướt
        if (rainDays >= 3) {
          tips.push("🌱 Vườn có Rhizoctonia — mưa nhiều tuần này sẽ làm ẩm đất, bệnh dễ lan rễ non. Kiểm tra hệ thống thoát nước ngay.");
          tips.push("💊 Phun Validamycin hoặc Hexaconazole vào gốc cây, tập trung vùng gần mặt đất.");
        } else {
          tips.push("🌱 Vườn có Rhizoctonia — tuần này ít mưa, thuận lợi xử lý: phun Validamycin gốc + rải vôi xung quanh.");
        }
        tips.push("🚿 Không tưới quá ẩm, đảm bảo đất không đọng nước sau mưa.");
        break;
      }

      case "Leaf_Phomopsis": {
        // Khô đầu lá — thường do khô hạn + nấm cơ hội
        if (season === "dry" || maxRain < 5) {
          tips.push("🥀 Vườn có Khô đầu lá (Phomopsis) — mùa khô làm cây yếu, dễ nhiễm nấm. Tưới bổ sung đủ ẩm cho đất.");
          tips.push("💊 Phun Iprodione hoặc Chlorothalonil kết hợp bón phân Kali để tăng sức đề kháng lá.");
        } else {
          tips.push("🥀 Vườn có Khô đầu lá — phun Iprodione phòng ngừa. Kiểm tra thêm dinh dưỡng (thiếu Canxi, Kali dễ gây bệnh).");
        }
        break;
      }

      case "Leaf_Healthy":
      default: {
        // Lá khỏe nhưng thời tiết xấu → khuyến nghị phòng ngừa
        if (highRiskDays >= 3) {
          tips.push(`💪 Lá hiện khỏe mạnh — nhưng ${highRiskDays} ngày tới nguy cơ cao. ${seasonNote}, nên phun phòng trước khi mưa.`);
          tips.push("🛡️ Phun phòng Metalaxyl + Carbendazim kết hợp để bảo vệ toàn diện.");
        }
        break;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  PHẦN 2 — Lời khuyên theo thời tiết (luôn hiển thị)
  // ═══════════════════════════════════════════════════════════

  // Cảnh báo tuần nguy hiểm (nếu chưa có cảnh báo bệnh cụ thể)
  if (tips.length === 0) {
    if (highRiskDays >= 4) {
      tips.push(`⚠️ ${seasonNote} — tuần nguy hiểm (${highRiskDays}/7 ngày nguy cơ cao). Chuẩn bị Metalaxyl / Fosetyl-Al ngay hôm nay.`);
      tips.push("🔍 Kiểm tra vườn mỗi sáng — phát hiện sớm cháy lá, thán thư để xử lý kịp thời.");
    } else if (highRiskDays >= 2) {
      tips.push(`⚡ ${seasonNote} — có ${highRiskDays} ngày nguy cơ cao. Theo dõi sát, sẵn sàng phun phòng khi thấy triệu chứng đầu tiên.`);
    }
  }

  // Mưa nhiều → thoát nước
  if (rainDays >= 4) {
    tips.push("🌧️ Mưa nhiều liên tục — kiểm tra mương thoát nước, tránh đọng nước gốc cây gây thối rễ.");
    if (!tips.some(t => t.includes("Không phun"))) {
      tips.push("🚫 Không phun thuốc trong ngày mưa — thuốc sẽ bị rửa trôi và gây lãng phí.");
    }
  }

  // Độ ẩm cao kéo dài → tỉa cành
  if (avgHum > 85 && !tips.some(t => t.includes("tỉa cành") || t.includes("tỉa tán"))) {
    tips.push(`💧 Độ ẩm trung bình tuần này cao (${avgHum}%) — tỉa cành bên trong tán để tạo thông thoáng, giảm ẩm vi khí hậu.`);
  }

  // Ngày tốt nhất phun
  if (bestDay) {
    const [, m, d] = bestDay.date.split("-");
    const label = bestDay.date === forecasts[0].date ? "Hôm nay"
                : bestDay.date === forecasts[1]?.date ? "Ngày mai"
                : `Ngày ${d}/${m}`;
    if (!tips.some(t => t.includes("phun thuốc tốt nhất"))) {
      tips.push(`✅ Thời điểm phun thuốc tốt nhất: ${label} (nắng ráo, ẩm thấp, thuốc bám tốt).`);
    }
  }

  // Mùa khô → nhắc tưới nước
  if (season === "dry" && maxRain < 3 && !tips.some(t => t.includes("tưới"))) {
    tips.push("☀️ Mùa khô — đảm bảo tưới đủ nước 2 ngày/lần, giữ ẩm gốc để cây không bị stress.");
  }

  // Nếu vẫn không có tip nào
  if (tips.length === 0) {
    tips.push("🟢 Tuần này nguy cơ thấp — tiếp tục chăm sóc định kỳ, kiểm tra vườn 2-3 lần/tuần.");
    tips.push("📋 Ghi chép tình trạng lá hàng tuần để phát hiện sớm dấu hiệu bệnh.");
  }

  return { tips, bestSprayDay: bestDay?.date ?? null };
}

/** Backward-compat wrapper (dùng trong load() không có context bệnh) */
function buildRecommendations(forecasts: DayForecast[]): { tips: string[]; bestSprayDay: string | null } {
  return buildSmartRecommendations(forecasts, null, null);
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
