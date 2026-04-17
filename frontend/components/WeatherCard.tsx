/**
 * WeatherCard.tsx — all-in-header version
 * Header chứa: tên tỉnh | khuyến nghị | thống kê + badge
 * Hàng 2 trong header: nguy cơ tỉnh lân cận (compact)
 * Bên dưới: chỉ còn 7-day grid + legend
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
function dayLabel(dateStr: string, idx: number): string {
  if (idx === 0) return "Hôm\nnay";
  if (idx === 1) return "Mai";
  const d   = new Date(dateStr + "T00:00:00");
  const dow = ["CN","T2","T3","T4","T5","T6","T7"][d.getDay()];
  return `${dow}\n${d.getDate()}/${d.getMonth()+1}`;
}

function RiskDot({ level, size = 7 }: { level: RiskLevel; size?: number }) {
  return (
    <View style={{ width:size, height:size, borderRadius:size/2, backgroundColor:RISK_COLOR[level] }} />
  );
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

  // ── Loading ──
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

  // Lấy tối đa 2 dòng khuyến nghị quan trọng nhất
  const topTips = recommendation.slice(0, 2);

  return (
    <View style={[s.card, { borderColor: riskC }]}>

      {/* ══════════════════════════════════════════════════════
          HEADER — 3 cột: [tỉnh] [khuyến nghị] [stats+badge]
          ══════════════════════════════════════════════════ */}
      <View style={[s.header, { backgroundColor: riskB }]}>

        {/* Cột trái: title + province */}
        <View style={s.hdrLeft}>
          <Text style={s.hdrTitle}>🌦️ Dự báo 7 ngày</Text>
          <TouchableOpacity onPress={() => setShowPicker(true)}>
            <Text style={[s.provinceTxt, { color: riskC }]}>📍 {currentProvince} ▾</Text>
          </TouchableOpacity>
        </View>

        {/* Cột giữa: khuyến nghị tuần */}
        <View style={s.hdrMid}>
          <Text style={s.hdrMidLabel}>💡 Khuyến nghị</Text>
          {topTips.map((tip, i) => (
            <Text key={i} style={s.hdrMidTip} numberOfLines={2}>{tip}</Text>
          ))}
        </View>

        {/* Cột phải: stats + badge + refresh */}
        <View style={s.hdrRight}>
          <View style={s.pill}><Text style={s.pillTxt}>🌧️ {currentWeather.rainDays}/7</Text></View>
          <View style={s.pill}><Text style={s.pillTxt}>💧 {currentWeather.avgHumidity}%</Text></View>
          <View style={[s.riskBadge, { backgroundColor: riskC }]}>
            <Text style={s.riskBadgeTxt}>{RISK_LABEL[currentWeather.weekRisk]}</Text>
          </View>
          <TouchableOpacity onPress={refresh} hitSlop={{top:8,bottom:8,left:8,right:8}}>
            <Text style={{ fontSize:15 }}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══════════════════════════════════════════════════════
          HEADER ROW 2 — Nguy cơ tỉnh lân cận (nếu có)
          Nằm trong cùng vùng màu header, compact 1 dòng scroll
          ══════════════════════════════════════════════════ */}
      {neighborWeathers.length > 0 && (
        <View style={[s.neighborBar, { backgroundColor: riskB }]}>
          <Text style={[s.neighborBarLabel, { color: riskC }]}>Lân cận:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.neighborScroll}>
            {neighborWeathers.map(pw => (
              <View key={pw.province} style={s.neighborChip}>
                <Text style={s.neighborChipName}>{pw.province}</Text>
                <View style={s.neighborDots}>
                  {pw.forecasts.map(f => (
                    <RiskDot key={f.date} level={f.riskLevel} size={6} />
                  ))}
                </View>
                <Text style={[s.neighborChipBadge, { color: RISK_COLOR[pw.weekRisk] }]}>
                  {pw.weekRisk==="very_high"?"Rất cao":pw.weekRisk==="high"?"Cao":pw.weekRisk==="medium"?"TB":"Thấp"}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════
          7-DAY GRID
          ══════════════════════════════════════════════════ */}
      <View style={s.grid}>
        {currentWeather.forecasts.map((f, i) => {
          const rc = RISK_COLOR[f.riskLevel];
          const rb = RISK_BG[f.riskLevel];
          return (
            <View key={f.date} style={[
              s.cell,
              i === 0 && { backgroundColor: rb, borderColor: rc, borderWidth: 1.5 },
            ]}>
              <Text style={[s.cellDow, i===0 && { color: rc, fontWeight:"800" }]}
                numberOfLines={2} textBreakStrategy="simple">
                {dayLabel(f.date, i)}
              </Text>
              <Text style={s.cellEmoji}>{weatherEmoji(f.weatherCode)}</Text>
              <Text style={s.cellTemp}>{f.tempMax}°</Text>
              <Text style={s.cellHum}>{f.humidity}%</Text>
              {f.rain > 0
                ? <Text style={s.cellRain}>{f.rain}mm</Text>
                : <View style={{ height:11 }} />
              }
              <RiskDot level={f.riskLevel} size={6} />
            </View>
          );
        })}
      </View>

      {/* ── Legend ── */}
      <View style={s.legend}>
        {(["low","medium","high","very_high"] as RiskLevel[]).map(r => (
          <View key={r} style={s.legendItem}>
            <RiskDot level={r} size={7} />
            <Text style={s.legendTxt}>
              {r==="low"?"Thấp":r==="medium"?"TB":r==="high"?"Cao":"Rất cao"}
            </Text>
          </View>
        ))}
        <Text style={s.updatedTxt}>· cập nhật {updatedStr}</Text>
      </View>

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

  // ── Header row 1 ──
  header: {
    flexDirection:"row", alignItems:"stretch",
    paddingHorizontal:12, paddingTop:10, paddingBottom:10,
    gap:10,
  },
  hdrLeft: {
    justifyContent:"center", minWidth:90,
  },
  hdrTitle:    { fontSize:11, fontWeight:"700", color:Colors.text, marginBottom:3 },
  provinceTxt: { fontSize:13, fontWeight:"800" },

  hdrMid: {
    flex:1, justifyContent:"center",
    borderLeftWidth:1, borderRightWidth:1,
    borderColor:"rgba(0,0,0,.08)",
    paddingHorizontal:10,
  },
  hdrMidLabel: { fontSize:10, fontWeight:"700", color:Colors.primary, marginBottom:3 },
  hdrMidTip:   { fontSize:10, color:Colors.text, lineHeight:14, marginBottom:1 },

  hdrRight: {
    flexDirection:"row", alignItems:"center",
    flexWrap:"wrap", gap:5, justifyContent:"flex-end",
    maxWidth:160,
  },
  pill:         { backgroundColor:"rgba(0,0,0,.07)", borderRadius:20, paddingHorizontal:7, paddingVertical:3 },
  pillTxt:      { fontSize:9, fontWeight:"600", color:Colors.text },
  riskBadge:    { borderRadius:20, paddingHorizontal:8, paddingVertical:3 },
  riskBadgeTxt: { color:"#fff", fontSize:9, fontWeight:"700" },

  // ── Header row 2 — neighbors ──
  neighborBar: {
    flexDirection:"row", alignItems:"center",
    paddingHorizontal:12, paddingBottom:9,
    gap:8,
    borderTopWidth:1, borderTopColor:"rgba(0,0,0,.07)",
  },
  neighborBarLabel: { fontSize:10, fontWeight:"700", flexShrink:0 },
  neighborScroll:   { gap:12, alignItems:"center" },
  neighborChip:     { flexDirection:"row", alignItems:"center", gap:4 },
  neighborChipName: { fontSize:10, fontWeight:"600", color:Colors.text },
  neighborDots:     { flexDirection:"row", gap:2 },
  neighborChipBadge:{ fontSize:10, fontWeight:"700" },

  // ── 7-day grid ──
  grid: {
    flexDirection:"row",
    paddingHorizontal:8, paddingVertical:8, gap:4,
  },
  cell: {
    flex:1, alignItems:"center",
    backgroundColor:"#f7f7f7",
    borderRadius:10, paddingVertical:7, paddingHorizontal:2,
    borderWidth:1, borderColor:"#ebebeb",
    gap:2,
  },
  cellDow:   { fontSize:8, fontWeight:"600", color:Colors.textMuted, textAlign:"center", lineHeight:11 },
  cellEmoji: { fontSize:15 },
  cellTemp:  { fontSize:12, fontWeight:"800", color:Colors.text },
  cellHum:   { fontSize:8,  color:Colors.textMuted },
  cellRain:  { fontSize:8,  color:"#1976d2" },

  // ── Legend ──
  legend: {
    flexDirection:"row", alignItems:"center", justifyContent:"center",
    gap:10, paddingBottom:8, paddingHorizontal:12,
  },
  legendItem:  { flexDirection:"row", alignItems:"center", gap:3 },
  legendTxt:   { fontSize:9, color:Colors.textMuted },
  updatedTxt:  { fontSize:9, color:Colors.textMuted },

  // ── States ──
  skRow:    { flexDirection:"row", alignItems:"center", gap:10, padding:16 },
  skTxt:    { fontSize:12, color:Colors.textMuted },
  errTxt:   { fontSize:12, color:"#c62828", padding:14 },
  retryBtn: { marginHorizontal:14, marginBottom:10, backgroundColor:Colors.primary, borderRadius:8, padding:8, alignItems:"center" },
  retryTxt: { color:"#fff", fontSize:12, fontWeight:"600" },
});
