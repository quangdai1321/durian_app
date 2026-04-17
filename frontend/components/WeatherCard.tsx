/**
 * WeatherCard.tsx — mobile-friendly
 * Header: 2 dòng (stats + province | recommendations | neighbors)
 * Grid: horizontal scroll, ô tối thiểu 80px, nhãn đầy đủ
 */

import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, FlatList, ScrollView,
} from "react-native";
import { useWeatherContext } from "../contexts/WeatherContext";
import {
  RISK_COLOR, RISK_BG, RISK_LABEL,
  weatherEmoji, PROVINCES, RiskLevel, ProvinceWeather,
} from "../hooks/useWeather";
import { Colors } from "../constants/Colors";

// ─── Helpers ─────────────────────────────────────────────────
function shortDay(dateStr: string, idx: number): string {
  if (idx === 0) return "Hôm nay";
  if (idx === 1) return "Ngày mai";
  const d   = new Date(dateStr + "T00:00:00");
  const dow = ["CN","T2","T3","T4","T5","T6","T7"][d.getDay()];
  return `${dow} ${d.getDate()}/${d.getMonth()+1}`;
}

// ─── Province picker modal ────────────────────────────────────
function ProvincePicker({ visible, current, onSelect, onClose }: {
  visible: boolean; current: string | null;
  onSelect: (p: string) => void; onClose: () => void;
}) {
  const list = Object.keys(PROVINCES).sort();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={pm.backdrop}>
        <View style={pm.sheet}>
          <View style={pm.hdr}>
            <Text style={pm.title}>Chọn tỉnh / thành phố</Text>
            <TouchableOpacity onPress={onClose}><Text style={pm.x}>✕</Text></TouchableOpacity>
          </View>
          <FlatList data={list} keyExtractor={p=>p} renderItem={({item})=>(
            <TouchableOpacity style={[pm.row, item===current && pm.rowOn]}
              onPress={()=>{ onSelect(item); onClose(); }}>
              <Text style={[pm.rowTxt, item===current && pm.rowTxtOn]}>
                {item===current ? "✓  " : "    "}{item}
              </Text>
            </TouchableOpacity>
          )}/>
        </View>
      </View>
    </Modal>
  );
}
const pm = StyleSheet.create({
  backdrop: { flex:1, backgroundColor:"rgba(0,0,0,.45)", justifyContent:"flex-end" },
  sheet:    { backgroundColor:"#fff", borderTopLeftRadius:22, borderTopRightRadius:22, maxHeight:"72%", paddingBottom:28 },
  hdr:      { flexDirection:"row", justifyContent:"space-between", alignItems:"center", padding:18, borderBottomWidth:1, borderBottomColor:"#eee" },
  title:    { fontSize:16, fontWeight:"700", color:Colors.text },
  x:        { fontSize:20, color:Colors.textMuted, padding:4 },
  row:      { paddingVertical:12, paddingHorizontal:22, borderBottomWidth:1, borderBottomColor:"#f2f2f2" },
  rowOn:    { backgroundColor:Colors.primaryLt },
  rowTxt:   { fontSize:14, color:Colors.text },
  rowTxtOn: { fontWeight:"700", color:Colors.primary },
});

// ─── MAIN ────────────────────────────────────────────────────
export default function WeatherCard() {
  const {
    loading, error, currentProvince, currentWeather,
    neighborWeathers, lastUpdated, recommendation,
    refresh, changeProvince,
  } = useWeatherContext();

  const [showPicker, setShowPicker] = useState(false);

  const updatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("vi-VN", { hour:"2-digit", minute:"2-digit" })
    : "--";

  if (loading && !currentWeather) {
    return (
      <View style={s.card}>
        <View style={s.skRow}>
          <ActivityIndicator color={Colors.primary} size="small" />
          <Text style={s.skTxt}>Đang tải dự báo thời tiết...</Text>
        </View>
      </View>
    );
  }
  if (error) {
    return (
      <View style={s.card}>
        <Text style={s.errTxt}>⚠️ {error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={refresh}>
          <Text style={s.retryTxt}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!currentWeather) return null;

  const riskC = RISK_COLOR[currentWeather.weekRisk];
  const riskB = RISK_BG[currentWeather.weekRisk];

  return (
    <View style={[s.card, { borderColor: riskC }]}>

      {/* ══ HEADER DÒNG 1: province + stats + badge ══ */}
      <View style={[s.hdr1, { backgroundColor: riskB }]}>
        {/* Trái: title + province */}
        <View style={s.hdr1Left}>
          <Text style={s.hdrTitle}>🌦️ Dự báo thời tiết 7 ngày</Text>
          <TouchableOpacity onPress={() => setShowPicker(true)}>
            <Text style={[s.provinceTxt, { color: riskC }]}>📍 {currentProvince} ▾</Text>
          </TouchableOpacity>
        </View>

        {/* Phải: pills + badge + refresh */}
        <View style={s.hdr1Right}>
          <View style={s.pill}><Text style={s.pillTxt}>🌧️ {currentWeather.rainDays}/7 ngày mưa</Text></View>
          <View style={s.pill}><Text style={s.pillTxt}>💧 {currentWeather.avgHumidity}% ẩm</Text></View>
          <View style={[s.riskBadge, { backgroundColor: riskC }]}>
            <Text style={s.riskBadgeTxt}>{RISK_LABEL[currentWeather.weekRisk]}</Text>
          </View>
          <TouchableOpacity onPress={refresh} hitSlop={{top:8,bottom:8,left:8,right:8}}>
            <Text style={{ fontSize:16 }}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══ HEADER DÒNG 2: khuyến nghị (full width) ══ */}
      {recommendation.length > 0 && (
        <View style={[s.hdr2, { backgroundColor: riskB }]}>
          <Text style={s.hdr2Label}>💡 Khuyến nghị:</Text>
          {recommendation.slice(0, 2).map((tip, i) => (
            <Text key={i} style={s.hdr2Tip}>{tip}</Text>
          ))}
        </View>
      )}

      {/* ══ HEADER DÒNG 3: tỉnh lân cận (horizontal scroll) ══ */}
      {neighborWeathers.length > 0 && (
        <View style={[s.hdr3, { backgroundColor: riskB }]}>
          <Text style={[s.hdr3Label, { color: riskC }]}>Lân cận:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.hdr3Scroll}>
            {neighborWeathers.map((pw: ProvinceWeather) => (
              <View key={pw.province} style={s.neighborChip}>
                <Text style={s.neighborName}>{pw.province}</Text>
                <View style={s.neighborDots}>
                  {pw.forecasts.map(f => (
                    <View key={f.date} style={{
                      width:6, height:6, borderRadius:3,
                      backgroundColor: RISK_COLOR[f.riskLevel],
                    }}/>
                  ))}
                </View>
                <Text style={[s.neighborRisk, { color: RISK_COLOR[pw.weekRisk] }]}>
                  {pw.weekRisk==="very_high"?"Rất cao":pw.weekRisk==="high"?"Cao":pw.weekRisk==="medium"?"TB":"Thấp"}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ══ 7-DAY GRID — horizontal scroll, ô tối thiểu 80px ══ */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.grid}
      >
        {currentWeather.forecasts.map((f, i) => {
          const rc = RISK_COLOR[f.riskLevel];
          const rb = RISK_BG[f.riskLevel];
          const riskLabel =
            f.riskLevel === "very_high" ? "Rất cao" :
            f.riskLevel === "high"      ? "Cao"     :
            f.riskLevel === "medium"    ? "TB"      : "Thấp";
          return (
            <View key={f.date} style={[
              s.cell,
              i === 0 && { backgroundColor: rb, borderColor: rc, borderWidth: 2 },
            ]}>
              {/* Ngày */}
              <Text style={[s.cellDow, i===0 && { color: rc, fontWeight:"800" }]}>
                {shortDay(f.date, i)}
              </Text>

              {/* Icon */}
              <Text style={s.cellEmoji}>{weatherEmoji(f.weatherCode)}</Text>

              {/* Nhiệt độ */}
              <View style={s.cellRow}>
                <Text style={[s.cellTempMax, i===0 && { color: rc }]}>{f.tempMax}°</Text>
                <Text style={s.cellSlash}>/</Text>
                <Text style={s.cellTempMin}>{f.tempMin}°</Text>
              </View>
              <Text style={s.cellSubLabel}>nhiệt độ (cao/thấp)</Text>

              {/* Độ ẩm */}
              <View style={s.cellRow}>
                <Text style={s.cellIcon}>💧</Text>
                <Text style={s.cellVal}>{f.humidity}%</Text>
              </View>
              <Text style={s.cellSubLabel}>độ ẩm không khí</Text>

              {/* Lượng mưa */}
              <View style={s.cellRow}>
                <Text style={s.cellIcon}>{f.rain > 0 ? "🌧" : "☀️"}</Text>
                <Text style={[s.cellVal, f.rain > 0 && { color:"#1976d2" }]}>
                  {f.rain > 0 ? `${f.rain} mm` : "Không mưa"}
                </Text>
              </View>
              <Text style={s.cellSubLabel}>lượng mưa</Text>

              {/* Risk chip */}
              <View style={[s.riskChip, { backgroundColor: rc }]}>
                <Text style={s.riskChipTxt}>⚠ Nguy cơ: {riskLabel}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* ── Footer ── */}
      <Text style={s.footer}>🕐 Cập nhật lúc {updatedStr}  ·  Nguồn: Open-Meteo</Text>

      <ProvincePicker
        visible={showPicker}
        current={currentProvince}
        onSelect={changeProvince}
        onClose={() => setShowPicker(false)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  card: {
    backgroundColor:"#fff", borderRadius:16,
    borderWidth:1.5, borderColor:Colors.border,
    marginHorizontal:16, marginTop:12, marginBottom:4,
    overflow:"hidden",
    shadowColor:"#000", shadowOpacity:0.06,
    shadowRadius:8, shadowOffset:{width:0,height:2},
    elevation:3,
  },

  // ── Header dòng 1 ──
  hdr1: {
    flexDirection:"row", alignItems:"center",
    paddingHorizontal:12, paddingVertical:10,
    gap:8,
  },
  hdr1Left:  { flex:1 },
  hdr1Right: { flexDirection:"row", alignItems:"center", flexWrap:"wrap", gap:5, maxWidth:"55%", justifyContent:"flex-end" },
  hdrTitle:    { fontSize:11, fontWeight:"700", color:Colors.text, marginBottom:3 },
  provinceTxt: { fontSize:14, fontWeight:"800" },
  pill:         { backgroundColor:"rgba(0,0,0,.07)", borderRadius:20, paddingHorizontal:8, paddingVertical:3 },
  pillTxt:      { fontSize:10, fontWeight:"600", color:Colors.text },
  riskBadge:    { borderRadius:20, paddingHorizontal:9, paddingVertical:4 },
  riskBadgeTxt: { color:"#fff", fontSize:10, fontWeight:"700" },

  // ── Header dòng 2 — khuyến nghị ──
  hdr2: {
    paddingHorizontal:12, paddingBottom:8,
    borderTopWidth:1, borderTopColor:"rgba(0,0,0,.07)",
  },
  hdr2Label: { fontSize:11, fontWeight:"700", color:Colors.primary, marginBottom:4 },
  hdr2Tip:   { fontSize:11, color:Colors.text, lineHeight:17, marginBottom:2 },

  // ── Header dòng 3 — lân cận ──
  hdr3: {
    flexDirection:"row", alignItems:"center",
    paddingHorizontal:12, paddingBottom:9,
    borderTopWidth:1, borderTopColor:"rgba(0,0,0,.07)",
    gap:6,
  },
  hdr3Label:  { fontSize:10, fontWeight:"700", flexShrink:0 },
  hdr3Scroll: { gap:12, alignItems:"center" },
  neighborChip: { flexDirection:"row", alignItems:"center", gap:4 },
  neighborName: { fontSize:10, fontWeight:"600", color:Colors.text },
  neighborDots: { flexDirection:"row", gap:2 },
  neighborRisk: { fontSize:10, fontWeight:"700" },

  // ── 7-day grid (horizontal scroll) ──
  grid: {
    paddingHorizontal:10, paddingVertical:10, gap:8,
  },
  cell: {
    width:100,                    // ← fixed width, scroll để xem hết
    alignItems:"center",
    backgroundColor:"#f7f7f7",
    borderRadius:12, paddingVertical:10, paddingHorizontal:8,
    borderWidth:1, borderColor:"#ebebeb",
    gap:1,
  },
  cellDow:      { fontSize:11, fontWeight:"700", color:Colors.textMuted, textAlign:"center", marginBottom:4 },
  cellEmoji:    { fontSize:22, marginBottom:4 },

  cellRow:      { flexDirection:"row", alignItems:"baseline", gap:2, marginTop:5 },
  cellTempMax:  { fontSize:15, fontWeight:"900", color:Colors.text },
  cellSlash:    { fontSize:11, color:Colors.textMuted },
  cellTempMin:  { fontSize:11, fontWeight:"500", color:Colors.textMuted },
  cellIcon:     { fontSize:12 },
  cellVal:      { fontSize:12, fontWeight:"700", color:Colors.text },
  cellSubLabel: { fontSize:9, color:Colors.textMuted, textAlign:"center", marginBottom:1 },

  riskChip: {
    marginTop:7, borderRadius:8,
    paddingHorizontal:7, paddingVertical:3,
    alignSelf:"stretch", alignItems:"center",
  },
  riskChipTxt: { fontSize:9, fontWeight:"800", color:"#fff" },

  // ── Footer ──
  footer: { fontSize:9, color:Colors.textMuted, textAlign:"center", paddingBottom:8 },

  // ── States ──
  skRow:    { flexDirection:"row", alignItems:"center", gap:10, padding:16 },
  skTxt:    { fontSize:12, color:Colors.textMuted },
  errTxt:   { fontSize:12, color:"#c62828", padding:14 },
  retryBtn: { marginHorizontal:14, marginBottom:10, backgroundColor:Colors.primary, borderRadius:8, padding:8, alignItems:"center" },
  retryTxt: { color:"#fff", fontSize:12, fontWeight:"600" },
});
