/**
 * WeatherCard.tsx
 * ───────────────
 * Card dự báo 7 ngày đầy đủ + khuyến nghị nông nghiệp.
 * Dùng trong màn hình Xử lý (treatment.tsx).
 */

import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, FlatList, ScrollView, Platform,
} from "react-native";
import {
  useWeather, RISK_COLOR, RISK_BG, RISK_LABEL,
  weatherEmoji, PROVINCES, RiskLevel, ProvinceWeather,
} from "../hooks/useWeather";
import { Colors } from "../constants/Colors";

// ───────────────────────────────────────────────
//  Helpers
// ───────────────────────────────────────────────
function dayLabel(dateStr: string, index: number): string {
  if (index === 0) return "Hôm nay";
  if (index === 1) return "Ngày mai";
  const d = new Date(dateStr + "T00:00:00");
  const dow = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.getDay()];
  return `${dow} ${d.getDate()}/${d.getMonth() + 1}`;
}

function RiskDot({ level, size = 8 }: { level: RiskLevel; size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: RISK_COLOR[level],
    }} />
  );
}

// ───────────────────────────────────────────────
//  Sub-component: Row 7 ngày
// ───────────────────────────────────────────────
function ForecastRow({ weather }: { weather: ProvinceWeather }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={fc.row}
    >
      {weather.forecasts.map((f, i) => (
        <View key={f.date} style={[fc.cell,
          i === 0 && { backgroundColor: RISK_BG[f.riskLevel], borderColor: RISK_COLOR[f.riskLevel], borderWidth: 1.5 }
        ]}>
          <Text style={fc.dow}>{dayLabel(f.date, i)}</Text>
          <Text style={fc.emoji}>{weatherEmoji(f.weatherCode)}</Text>
          <Text style={fc.temp}>{f.tempMax}°</Text>
          <Text style={fc.hum}>💧{f.humidity}%</Text>
          {f.rain > 0 && <Text style={fc.rain}>🌧️{f.rain}mm</Text>}
          <View style={{ marginTop: 4 }}>
            <RiskDot level={f.riskLevel} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const fc = StyleSheet.create({
  row:  { paddingHorizontal: 4, paddingBottom: 4, gap: 8 },
  cell: {
    alignItems: "center", backgroundColor: "#f9f9f9",
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10,
    minWidth: 68, borderWidth: 1, borderColor: "#eee",
  },
  dow:   { fontSize: 10, fontWeight: "600", color: Colors.textMuted, marginBottom: 4 },
  emoji: { fontSize: 20, marginBottom: 4 },
  temp:  { fontSize: 14, fontWeight: "700", color: Colors.text },
  hum:   { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  rain:  { fontSize: 10, color: "#1976d2", marginTop: 1 },
});

// ───────────────────────────────────────────────
//  Sub-component: Tỉnh lân cận row
// ───────────────────────────────────────────────
function NeighborRow({ pw }: { pw: ProvinceWeather }) {
  const dots = pw.forecasts.map(f => (
    <RiskDot key={f.date} level={f.riskLevel} size={9} />
  ));
  return (
    <View style={nb.row}>
      <Text style={nb.name}>📍 {pw.province}</Text>
      <View style={nb.dots}>{dots}</View>
      <Text style={[nb.badge, { color: RISK_COLOR[pw.weekRisk] }]}>
        {pw.weekRisk === "very_high" ? "Rất cao" :
         pw.weekRisk === "high"      ? "Cao" :
         pw.weekRisk === "medium"    ? "TB" : "Thấp"}
      </Text>
    </View>
  );
}

const nb = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 8 },
  name:  { flex: 1, fontSize: 12, fontWeight: "600", color: Colors.text },
  dots:  { flexDirection: "row", gap: 4 },
  badge: { fontSize: 11, fontWeight: "700", minWidth: 40, textAlign: "right" },
});

// ───────────────────────────────────────────────
//  Province picker modal
// ───────────────────────────────────────────────
function ProvincePicker({
  visible, current, onSelect, onClose,
}: {
  visible: boolean;
  current: string | null;
  onSelect: (p: string) => void;
  onClose: () => void;
}) {
  const provinces = Object.keys(PROVINCES).sort();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={pm.backdrop}>
        <View style={pm.sheet}>
          <View style={pm.header}>
            <Text style={pm.title}>Chọn tỉnh / thành phố</Text>
            <TouchableOpacity onPress={onClose}><Text style={pm.close}>✕</Text></TouchableOpacity>
          </View>
          <FlatList
            data={provinces}
            keyExtractor={p => p}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[pm.item, item === current && pm.itemActive]}
                onPress={() => { onSelect(item); onClose(); }}
              >
                <Text style={[pm.itemText, item === current && pm.itemTextActive]}>
                  {item === current ? "✓ " : "   "}{item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const pm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:    { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "75%", paddingBottom: 32 },
  header:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#eee" },
  title:    { fontSize: 17, fontWeight: "700", color: Colors.text },
  close:    { fontSize: 20, color: Colors.textMuted, padding: 4 },
  item:     { paddingVertical: 14, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  itemActive: { backgroundColor: Colors.primaryLt },
  itemText:   { fontSize: 15, color: Colors.text },
  itemTextActive: { fontWeight: "700", color: Colors.primary },
});

// ───────────────────────────────────────────────
//  MAIN COMPONENT
// ───────────────────────────────────────────────
export default function WeatherCard({
  onSchedulePress,
}: {
  onSchedulePress?: (date: string) => void;
}) {
  const {
    loading, error, currentProvince, currentWeather,
    neighborWeathers, lastUpdated, recommendation,
    bestSprayDay, refresh, changeProvince,
  } = useWeather();

  const [showPicker,    setShowPicker]    = useState(false);
  const [showNeighbors, setShowNeighbors] = useState(false);

  // ── Format thời gian cập nhật ──
  const updatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : null;

  // ── Skeleton ──
  if (loading && !currentWeather) {
    return (
      <View style={s.card}>
        <View style={s.skeletonHeader}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={s.skeletonText}>Đang tải dự báo thời tiết...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.card}>
        <Text style={s.errorText}>⚠️ {error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={refresh}>
          <Text style={s.retryText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!currentWeather) return null;

  const riskColor = RISK_COLOR[currentWeather.weekRisk];
  const riskBg    = RISK_BG[currentWeather.weekRisk];

  return (
    <View style={[s.card, { borderColor: riskColor }]}>

      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: riskBg }]}>
        <View style={s.headerLeft}>
          <Text style={s.headerTitle}>🌦️ Dự báo thời tiết</Text>
          <TouchableOpacity style={s.provinceRow} onPress={() => setShowPicker(true)}>
            <Text style={[s.provinceName, { color: riskColor }]}>
              📍 {currentProvince} ▾
            </Text>
          </TouchableOpacity>
        </View>
        <View style={s.headerRight}>
          <View style={[s.riskBadge, { backgroundColor: riskColor }]}>
            <Text style={s.riskBadgeText}>{RISK_LABEL[currentWeather.weekRisk]}</Text>
          </View>
          <TouchableOpacity onPress={refresh} style={s.refreshBtn}>
            <Text style={s.refreshText}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Stats row ── */}
      <View style={s.statsRow}>
        <View style={s.statItem}>
          <Text style={s.statVal}>🌧️ {currentWeather.rainDays}/7</Text>
          <Text style={s.statLbl}>ngày mưa</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statVal}>💧 {currentWeather.avgHumidity}%</Text>
          <Text style={s.statLbl}>ẩm TB</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statVal}>{updatedStr ?? "--"}</Text>
          <Text style={s.statLbl}>cập nhật</Text>
        </View>
      </View>

      {/* ── 7 ngày ── */}
      <ForecastRow weather={currentWeather} />

      {/* ── Risk legend ── */}
      <View style={s.legendRow}>
        {(["low","medium","high","very_high"] as RiskLevel[]).map(r => (
          <View key={r} style={s.legendItem}>
            <RiskDot level={r} size={8} />
            <Text style={s.legendText}>
              {r === "low" ? "Thấp" : r === "medium" ? "TB" : r === "high" ? "Cao" : "Rất cao"}
            </Text>
          </View>
        ))}
      </View>

      {/* ── Khuyến nghị ── */}
      <View style={s.tipsSection}>
        <Text style={s.tipsTitle}>💡 Khuyến nghị tuần này</Text>
        {recommendation.map((tip, i) => (
          <Text key={i} style={s.tipText}>{tip}</Text>
        ))}
      </View>

      {/* ── Nút đặt lịch ── */}
      {bestSprayDay && onSchedulePress && (
        <TouchableOpacity
          style={[s.scheduleBtn, { backgroundColor: riskColor }]}
          onPress={() => onSchedulePress(bestSprayDay)}
          activeOpacity={0.85}
        >
          <Text style={s.scheduleBtnText}>
            📅 Đặt lịch phun thuốc ngày {bestSprayDay.split("-").reverse().slice(0, 2).join("/")}
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Tỉnh lân cận (collapsible) ── */}
      {neighborWeathers.length > 0 && (
        <>
          <TouchableOpacity
            style={s.neighborToggle}
            onPress={() => setShowNeighbors(v => !v)}
          >
            <Text style={s.neighborToggleText}>
              {showNeighbors ? "▲" : "▼"} Nguy cơ tỉnh lân cận
            </Text>
          </TouchableOpacity>
          {showNeighbors && (
            <View style={s.neighborList}>
              <View style={s.neighborHeader}>
                <Text style={s.neighborHeaderText}>Tỉnh</Text>
                <Text style={s.neighborHeaderText}>T5 T6 T7 CN T2 T3 T4</Text>
                <Text style={s.neighborHeaderText}>Tuần</Text>
              </View>
              {neighborWeathers.map(pw => <NeighborRow key={pw.province} pw={pw} />)}
            </View>
          )}
        </>
      )}

      {/* Province picker modal */}
      <ProvincePicker
        visible={showPicker}
        current={currentProvince}
        onSelect={changeProvince}
        onClose={() => setShowPicker(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },

  // Header
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerLeft:  { flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 13, fontWeight: "700", color: Colors.text, marginBottom: 3 },
  provinceRow: { flexDirection: "row", alignItems: "center" },
  provinceName: { fontSize: 14, fontWeight: "800" },
  riskBadge:   { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  riskBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  refreshBtn:  { padding: 4 },
  refreshText: { fontSize: 18 },

  // Stats
  statsRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  statItem:    { flex: 1, alignItems: "center" },
  statVal:     { fontSize: 12, fontWeight: "700", color: Colors.text },
  statLbl:     { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: "#e0e0e0" },

  // Legend
  legendRow: {
    flexDirection: "row", justifyContent: "center", gap: 14,
    paddingVertical: 6, paddingHorizontal: 16,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendText: { fontSize: 10, color: Colors.textMuted },

  // Tips
  tipsSection: {
    backgroundColor: "#f8fffe",
    marginHorizontal: 12, marginVertical: 8,
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#e0f2f1",
  },
  tipsTitle: { fontSize: 12, fontWeight: "700", color: Colors.primary, marginBottom: 8 },
  tipText:   { fontSize: 12, color: Colors.text, lineHeight: 19, marginBottom: 4 },

  // Schedule button
  scheduleBtn: {
    marginHorizontal: 12, marginBottom: 12,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
    alignItems: "center",
  },
  scheduleBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Neighbors
  neighborToggle: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: "#f0f0f0",
    alignItems: "center",
  },
  neighborToggleText: { fontSize: 12, color: Colors.primary, fontWeight: "600" },
  neighborList: { paddingHorizontal: 16, paddingBottom: 12 },
  neighborHeader: {
    flexDirection: "row", justifyContent: "space-between",
    marginBottom: 4, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  neighborHeaderText: { fontSize: 10, color: Colors.textMuted, fontWeight: "600" },

  // Skeleton / error
  skeletonHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 20 },
  skeletonText:   { fontSize: 13, color: Colors.textMuted },
  errorText:      { fontSize: 13, color: "#c62828", padding: 16 },
  retryBtn:       { marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.primary, borderRadius: 10, padding: 10, alignItems: "center" },
  retryText:      { color: "#fff", fontSize: 13, fontWeight: "600" },
});
