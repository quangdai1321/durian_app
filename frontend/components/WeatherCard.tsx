/**
 * WeatherCard.tsx
 * ───────────────
 * Card dự báo 7 ngày đầy đủ + khuyến nghị nông nghiệp.
 * - 7 ô dàn đều toàn bộ chiều ngang, tap để chọn ngày
 * - Khi chọn ngày → picker loại công việc + nút "Đặt lịch chăm sóc"
 */

import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, FlatList, ScrollView,
} from "react-native";
import {
  useWeather, RISK_COLOR, RISK_BG, RISK_LABEL,
  weatherEmoji, PROVINCES, RiskLevel, ProvinceWeather,
} from "../hooks/useWeather";
import { Colors } from "../constants/Colors";

// ───────────────────────────────────────────────
//  Helpers
// ───────────────────────────────────────────────
function shortDayLabel(dateStr: string, index: number): string {
  if (index === 0) return "Hôm nay";
  if (index === 1) return "Mai";
  const d   = new Date(dateStr + "T00:00:00");
  const dow = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.getDay()];
  return `${dow}\n${d.getDate()}/${d.getMonth() + 1}`;
}

function fullDayLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
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
//  Task types (quick-pick)
// ───────────────────────────────────────────────
const QUICK_TASKS = [
  { key: "phun_thuoc", label: "Phun thuốc",   icon: "🌿" },
  { key: "bon_phan",   label: "Bón phân",      icon: "🌱" },
  { key: "tuoi_nuoc",  label: "Tưới nước",     icon: "💧" },
  { key: "cat_tia",    label: "Cắt tỉa",       icon: "✂️" },
  { key: "kiem_tra",   label: "Kiểm tra vườn", icon: "🔍" },
  { key: "thu_hoach",  label: "Thu hoạch",     icon: "🌾" },
];

// ───────────────────────────────────────────────
//  ForecastGrid — 7 ô fill full width
// ───────────────────────────────────────────────
function ForecastGrid({
  weather,
  selectedDate,
  onSelectDate,
}: {
  weather: ProvinceWeather;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  return (
    <View style={fg.grid}>
      {weather.forecasts.map((f, i) => {
        const isSelected = f.date === selectedDate;
        const isToday    = i === 0;
        const riskC      = RISK_COLOR[f.riskLevel];
        const riskB      = RISK_BG[f.riskLevel];

        return (
          <TouchableOpacity
            key={f.date}
            style={[
              fg.cell,
              isToday    && { borderColor: riskC, borderWidth: 1.5 },
              isSelected && { backgroundColor: riskC, borderColor: riskC, borderWidth: 2 },
              !isSelected && isToday && { backgroundColor: riskB },
            ]}
            onPress={() => onSelectDate(isSelected ? "" : f.date)}
            activeOpacity={0.75}
          >
            {/* Nhãn ngày */}
            <Text style={[fg.dow, isSelected && { color: "#fff" }]}
              numberOfLines={2} textBreakStrategy="simple"
            >
              {shortDayLabel(f.date, i)}
            </Text>

            {/* Icon thời tiết */}
            <Text style={fg.emoji}>{weatherEmoji(f.weatherCode)}</Text>

            {/* Nhiệt độ max */}
            <Text style={[fg.temp, isSelected && { color: "#fff" }]}>
              {f.tempMax}°
            </Text>

            {/* Độ ẩm */}
            <Text style={[fg.hum, isSelected && { color: "rgba(255,255,255,.85)" }]}>
              {f.humidity}%
            </Text>

            {/* Mưa */}
            {f.rain > 0 ? (
              <Text style={[fg.rain, isSelected && { color: "rgba(255,255,255,.9)" }]}>
                {f.rain}mm
              </Text>
            ) : (
              <View style={{ height: 14 }} />
            )}

            {/* Risk dot */}
            <View style={fg.dotWrap}>
              <View style={[
                fg.dot,
                { backgroundColor: isSelected ? "#fff" : riskC },
              ]} />
            </View>

            {/* Checkmark khi chọn */}
            {isSelected && (
              <View style={fg.checkBadge}>
                <Text style={fg.checkText}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const fg = StyleSheet.create({
  grid: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 5,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#f7f7f7",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    position: "relative",
  },
  dow: {
    fontSize: 9, fontWeight: "700",
    color: Colors.textMuted,
    textAlign: "center",
    marginBottom: 4,
    lineHeight: 13,
  },
  emoji:  { fontSize: 17, marginBottom: 3 },
  temp:   { fontSize: 13, fontWeight: "800", color: Colors.text },
  hum:    { fontSize: 9,  color: Colors.textMuted, marginTop: 1 },
  rain:   { fontSize: 9,  color: "#1976d2", marginTop: 1 },
  dotWrap: { marginTop: 4, alignItems: "center" },
  dot:     { width: 7, height: 7, borderRadius: 3.5 },
  checkBadge: {
    position: "absolute", top: 4, right: 4,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.35)",
    alignItems: "center", justifyContent: "center",
  },
  checkText: { fontSize: 8, color: "#fff", fontWeight: "900" },
});

// ───────────────────────────────────────────────
//  Task picker + schedule button
// ───────────────────────────────────────────────
function ScheduleSection({
  selectedDate,
  selectedTask,
  onSelectTask,
  onSchedule,
  riskColor,
}: {
  selectedDate: string;
  selectedTask: string;
  onSelectTask: (key: string) => void;
  onSchedule: () => void;
  riskColor: string;
}) {
  const task = QUICK_TASKS.find(t => t.key === selectedTask) ?? QUICK_TASKS[0];
  return (
    <View style={ss.wrap}>
      {/* Ngày đã chọn */}
      <Text style={ss.title}>
        📅 Đặt lịch ngày <Text style={{ color: riskColor, fontWeight: "800" }}>
          {fullDayLabel(selectedDate)}
        </Text> — chọn công việc:
      </Text>

      {/* Quick-pick chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={ss.chips}
      >
        {QUICK_TASKS.map(t => {
          const active = t.key === selectedTask;
          return (
            <TouchableOpacity
              key={t.key}
              style={[ss.chip, active && { backgroundColor: riskColor, borderColor: riskColor }]}
              onPress={() => onSelectTask(t.key)}
              activeOpacity={0.8}
            >
              <Text style={ss.chipIcon}>{t.icon}</Text>
              <Text style={[ss.chipLabel, active && { color: "#fff" }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Nút đặt lịch */}
      <TouchableOpacity
        style={[ss.btn, { backgroundColor: riskColor }]}
        onPress={onSchedule}
        activeOpacity={0.85}
      >
        <Text style={ss.btnText}>
          {task.icon} Đặt lịch {task.label.toLowerCase()} ngày {fullDayLabel(selectedDate)}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const ss = StyleSheet.create({
  wrap: {
    marginHorizontal: 10, marginBottom: 10,
    backgroundColor: "#f9f9f9",
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: "#e8e8e8",
  },
  title: { fontSize: 12, color: Colors.textMuted, marginBottom: 10, lineHeight: 18 },
  chips: { gap: 7, paddingBottom: 2 },
  chip:  {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#fff",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1.5, borderColor: "#e0e0e0",
  },
  chipIcon:  { fontSize: 14 },
  chipLabel: { fontSize: 12, fontWeight: "600", color: Colors.text },
  btn: {
    marginTop: 10, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});

// ───────────────────────────────────────────────
//  Tỉnh lân cận row
// ───────────────────────────────────────────────
function NeighborRow({ pw }: { pw: ProvinceWeather }) {
  return (
    <View style={nb.row}>
      <Text style={nb.name}>📍 {pw.province}</Text>
      <View style={nb.dots}>
        {pw.forecasts.map(f => (
          <RiskDot key={f.date} level={f.riskLevel} size={9} />
        ))}
      </View>
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
function ProvincePicker({ visible, current, onSelect, onClose }: {
  visible: boolean; current: string | null;
  onSelect: (p: string) => void; onClose: () => void;
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
            data={provinces} keyExtractor={p => p}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[pm.item, item === current && pm.itemActive]}
                onPress={() => { onSelect(item); onClose(); }}
              >
                <Text style={[pm.itemText, item === current && pm.itemTextActive]}>
                  {item === current ? "✓  " : "    "}{item}
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
  itemActive:     { backgroundColor: Colors.primaryLt },
  itemText:       { fontSize: 15, color: Colors.text },
  itemTextActive: { fontWeight: "700", color: Colors.primary },
});

// ───────────────────────────────────────────────
//  MAIN COMPONENT
// ───────────────────────────────────────────────
export default function WeatherCard({
  onSchedulePress,
}: {
  onSchedulePress?: (date: string, taskKey: string) => void;
}) {
  const {
    loading, error, currentProvince, currentWeather,
    neighborWeathers, lastUpdated, recommendation,
    refresh, changeProvince,
  } = useWeather();

  const [showPicker,    setShowPicker]    = useState(false);
  const [showNeighbors, setShowNeighbors] = useState(false);
  const [selectedDate,  setSelectedDate]  = useState<string>("");
  const [selectedTask,  setSelectedTask]  = useState<string>("phun_thuoc");

  const updatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : null;

  // ── Skeleton ──
  if (loading && !currentWeather) {
    return (
      <View style={s.card}>
        <View style={s.skeletonRow}>
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
          <TouchableOpacity onPress={() => setShowPicker(true)}>
            <Text style={[s.provinceName, { color: riskColor }]}>📍 {currentProvince} ▾</Text>
          </TouchableOpacity>
        </View>
        <View style={s.headerRight}>
          <View style={[s.riskBadge, { backgroundColor: riskColor }]}>
            <Text style={s.riskBadgeText}>{RISK_LABEL[currentWeather.weekRisk]}</Text>
          </View>
          <TouchableOpacity onPress={refresh} style={s.refreshBtn}>
            <Text style={{ fontSize: 18 }}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Stats ── */}
      <View style={s.statsRow}>
        <View style={s.statItem}>
          <Text style={s.statVal}>🌧️ {currentWeather.rainDays}/7</Text>
          <Text style={s.statLbl}>ngày mưa</Text>
        </View>
        <View style={s.statDiv} />
        <View style={s.statItem}>
          <Text style={s.statVal}>💧 {currentWeather.avgHumidity}%</Text>
          <Text style={s.statLbl}>ẩm trung bình</Text>
        </View>
        <View style={s.statDiv} />
        <View style={s.statItem}>
          <Text style={s.statVal}>{updatedStr ?? "--"}</Text>
          <Text style={s.statLbl}>cập nhật</Text>
        </View>
      </View>

      {/* ── 7 ngày grid (fill full width) ── */}
      <ForecastGrid
        weather={currentWeather}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      {/* ── Hint khi chưa chọn ── */}
      {!selectedDate && (
        <Text style={s.hint}>👆 Nhấn vào ô ngày để đặt lịch chăm sóc</Text>
      )}

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

      {/* ── Schedule section (chỉ hiện khi chọn ngày) ── */}
      {selectedDate && (
        <ScheduleSection
          selectedDate={selectedDate}
          selectedTask={selectedTask}
          onSelectTask={setSelectedTask}
          onSchedule={() => {
            onSchedulePress?.(selectedDate, selectedTask);
            setSelectedDate("");
          }}
          riskColor={riskColor}
        />
      )}

      {/* ── Khuyến nghị ── */}
      <View style={s.tipsSection}>
        <Text style={s.tipsTitle}>💡 Khuyến nghị tuần này</Text>
        {recommendation.map((tip, i) => (
          <Text key={i} style={s.tipText}>{tip}</Text>
        ))}
      </View>

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
                <Text style={s.neighborHeaderTxt}>Tỉnh</Text>
                <Text style={s.neighborHeaderTxt}>Hôm nay → 7 ngày</Text>
                <Text style={s.neighborHeaderTxt}>Tuần</Text>
              </View>
              {neighborWeathers.map(pw => <NeighborRow key={pw.province} pw={pw} />)}
            </View>
          )}
        </>
      )}

      <ProvincePicker
        visible={showPicker}
        current={currentProvince}
        onSelect={changeProvince}
        onClose={() => setShowPicker(false)}
      />
    </View>
  );
}

// ───────────────────────────────────────────────
const s = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 18,
    borderWidth: 1.5, borderColor: Colors.border,
    marginHorizontal: 16, marginTop: 14, marginBottom: 6,
    overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.07,
    shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerLeft:     { flex: 1 },
  headerRight:    { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle:    { fontSize: 13, fontWeight: "700", color: Colors.text, marginBottom: 3 },
  provinceName:   { fontSize: 14, fontWeight: "800" },
  riskBadge:      { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  riskBadgeText:  { color: "#fff", fontSize: 11, fontWeight: "700" },
  refreshBtn:     { padding: 4 },

  statsRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  statItem:   { flex: 1, alignItems: "center" },
  statVal:    { fontSize: 12, fontWeight: "700", color: Colors.text },
  statLbl:    { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  statDiv:    { width: 1, height: 28, backgroundColor: "#e0e0e0" },

  hint: {
    textAlign: "center", fontSize: 11, color: Colors.textMuted,
    marginTop: -2, marginBottom: 6, fontStyle: "italic",
  },

  legendRow: {
    flexDirection: "row", justifyContent: "center", gap: 14,
    paddingVertical: 4, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: "#f5f5f5",
    marginBottom: 2,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendText: { fontSize: 10, color: Colors.textMuted },

  tipsSection: {
    backgroundColor: "#f8fffe",
    marginHorizontal: 10, marginTop: 8, marginBottom: 10,
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#e0f2f1",
  },
  tipsTitle: { fontSize: 12, fontWeight: "700", color: Colors.primary, marginBottom: 8 },
  tipText:   { fontSize: 12, color: Colors.text, lineHeight: 19, marginBottom: 4 },

  neighborToggle: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: "#f0f0f0",
    alignItems: "center",
  },
  neighborToggleText: { fontSize: 12, color: Colors.primary, fontWeight: "600" },
  neighborList:       { paddingHorizontal: 16, paddingBottom: 12 },
  neighborHeader:     {
    flexDirection: "row", justifyContent: "space-between",
    marginBottom: 4, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  neighborHeaderTxt: { fontSize: 10, color: Colors.textMuted, fontWeight: "600" },

  skeletonRow:  { flexDirection: "row", alignItems: "center", gap: 10, padding: 20 },
  skeletonText: { fontSize: 13, color: Colors.textMuted },
  errorText:    { fontSize: 13, color: "#c62828", padding: 16 },
  retryBtn:     { marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.primary, borderRadius: 10, padding: 10, alignItems: "center" },
  retryText:    { color: "#fff", fontSize: 13, fontWeight: "600" },
});
