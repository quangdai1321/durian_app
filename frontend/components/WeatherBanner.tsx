/**
 * WeatherBanner.tsx
 * ─────────────────
 * Banner nhỏ hiển thị trên đầu màn hình Camera.
 * Tap → chuyển sang tab Xử lý (cuộn lên đầu xem chi tiết).
 */

import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useWeatherContext } from "../contexts/WeatherContext";
import { RISK_COLOR, RISK_BG, weatherEmoji } from "../hooks/useWeather";
import { Colors } from "../constants/Colors";

export default function WeatherBanner() {
  const router = useRouter();
  const { loading, error, currentProvince, currentWeather } = useWeatherContext();

  // Không hiển thị khi đang load lần đầu hoặc lỗi
  if (loading && !currentWeather) {
    return (
      <View style={s.skeleton}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={s.skeletonText}>Đang tải thời tiết...</Text>
      </View>
    );
  }

  if (error || !currentWeather) return null;

  const today    = currentWeather.forecasts[0];
  const riskColor = RISK_COLOR[currentWeather.weekRisk];
  const riskBg    = RISK_BG[currentWeather.weekRisk];

  const riskShort: Record<string, string> = {
    low:       "Nguy cơ thấp",
    medium:    "Nguy cơ TB",
    high:      "Nguy cơ cao",
    very_high: "Nguy cơ rất cao",
  };

  return (
    <TouchableOpacity
      style={[s.banner, { backgroundColor: riskBg, borderColor: riskColor }]}
      onPress={() => router.push("/(tabs)/treatment")}
      activeOpacity={0.8}
    >
      {/* Trái: icon + tên tỉnh */}
      <View style={s.left}>
        <Text style={s.weatherIcon}>{weatherEmoji(today.weatherCode)}</Text>
        <View>
          <Text style={s.province}>📍 {currentProvince}</Text>
          <Text style={s.temp}>{today.tempMax}°/{today.tempMin}° · {today.humidity}%</Text>
        </View>
      </View>

      {/* Giữa: risk badge + rain days */}
      <View style={[s.badge, { backgroundColor: riskColor }]}>
        <Text style={s.badgeText}>{riskShort[currentWeather.weekRisk]}</Text>
        {currentWeather.rainDays > 0 && (
          <Text style={s.badgeSub}>🌧️ {currentWeather.rainDays}/7 ngày mưa</Text>
        )}
      </View>

      {/* Phải: 4 ngày mini */}
      <View style={s.miniDays}>
        {currentWeather.forecasts.slice(1, 5).map((f, i) => {
          const dotColor = RISK_COLOR[f.riskLevel];
          return (
            <View key={i} style={s.miniDay}>
              <Text style={s.miniEmoji}>{weatherEmoji(f.weatherCode)}</Text>
              <View style={[s.miniDot, { backgroundColor: dotColor }]} />
            </View>
          );
        })}
      </View>

      {/* Arrow */}
      <Text style={[s.arrow, { color: riskColor }]}>›</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  skeleton: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#f5f5f5", marginHorizontal: 16, marginTop: 10,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  skeletonText: { fontSize: 12, color: Colors.textMuted },

  banner: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginTop: 10, marginBottom: 2,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1.5,
    shadowColor: "#000", shadowOpacity: 0.06,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 8,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1 },
  weatherIcon: { fontSize: 24 },
  province:  { fontSize: 11, fontWeight: "700", color: Colors.text },
  temp:      { fontSize: 10, color: Colors.textMuted, marginTop: 1 },

  badge: {
    borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5,
    alignItems: "center", minWidth: 90,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  badgeSub:  { color: "rgba(255,255,255,.85)", fontSize: 9, marginTop: 1 },

  miniDays: { flexDirection: "row", gap: 4, alignItems: "center" },
  miniDay:  { alignItems: "center", gap: 2 },
  miniEmoji: { fontSize: 14 },
  miniDot:  { width: 6, height: 6, borderRadius: 3 },

  arrow: { fontSize: 22, fontWeight: "300", marginLeft: 2 },
});
