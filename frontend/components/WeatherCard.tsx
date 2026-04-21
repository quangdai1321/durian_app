/**
 * WeatherCard.tsx — mobile-friendly
 * Header: 2 dòng (stats + province | recommendations | neighbors)
 * Grid: horizontal scroll, ô tối thiểu 80px, nhãn đầy đủ
 */

import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, FlatList, ScrollView,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWeatherContext } from "../contexts/WeatherContext";
import {
  RISK_COLOR, RISK_BG, RISK_LABEL,
  weatherEmoji, PROVINCES, RiskLevel, ProvinceWeather,
  buildSmartRecommendations,
} from "../hooks/useWeather";
import { Colors } from "../constants/Colors";

// ─── Disease warning từ điều kiện thời tiết ─────────────────
function diseaseWarning(temp: number, humidity: number, rain: number)
  : { text: string; color: string } {
  // Mưa nhiều + ẩm cao + nhiệt độ lý tưởng → Cháy lá + Thán thư
  if (rain > 10 && humidity > 85 && temp >= 24 && temp <= 32)
    return { text: "⚠ Cháy lá · Thán thư", color: "#c62828" };
  // Mưa vừa + ẩm cao → Cháy lá
  if (rain > 5 && humidity > 80)
    return { text: "⚠ Cháy lá", color: "#e53935" };
  // Ẩm cao, ít mưa → Đốm tảo + Rhizoctonia
  if (humidity > 85 && rain <= 2)
    return { text: "⚠ Đốm tảo · Rhizoctonia", color: "#f57c00" };
  // Ẩm trung bình, mưa nhẹ → Thán thư
  if (humidity > 78 && rain > 0)
    return { text: "⚡ Thán thư", color: "#fb8c00" };
  // Khô hạn → Khô đầu lá (Phomopsis)
  if (rain < 1 && humidity < 60)
    return { text: "⚠ Khô đầu lá", color: "#f57c00" };
  // Bình thường
  return { text: "✅ Ít nguy cơ bệnh lá", color: "#388e3c" };
}

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
    neighborWeathers, lastUpdated,
    refresh, changeProvince,
  } = useWeatherContext();

  const [showPicker, setShowPicker] = useState(false);
  const { width: screenWidth } = useWindowDimensions();

  // ── Đọc chẩn đoán gần nhất từ AsyncStorage ──────────────
  const [recentDisease,   setRecentDisease]   = useState<string | null>(null);
  const [diagnosedAt,     setDiagnosedAt]     = useState<number | null>(null);
  const [recentLabelVI,   setRecentLabelVI]   = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("last_diagnosis").then(raw => {
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        const cls = d?.disease_class ?? d?.predicted_class ?? null;
        const ts  = d?.created_at
          ? new Date(d.created_at).getTime()
          : (d?.timestamp ?? null);
        setRecentDisease(cls);
        setDiagnosedAt(ts);
        // Label tiếng Việt
        const LABEL_VI: Record<string, string> = {
          Leaf_Algal:          "Đốm tảo",
          Leaf_Blight:         "Cháy lá",
          Leaf_Colletotrichum: "Thán thư",
          Leaf_Healthy:        "Lá khỏe",
          Leaf_Phomopsis:      "Khô đầu lá",
          Leaf_Rhizoctonia:    "Rhizoctonia",
        };
        setRecentLabelVI(cls ? (LABEL_VI[cls] ?? cls) : null);
      } catch {}
    });
  }, []);

  // Nếu màn hình đủ rộng → dàn 7 ô đều (flex), ngược lại scroll ngang
  const CARD_PADDING  = 32 + 16; // marginHorizontal*2 + grid padding*2
  const MIN_CELL_W    = 80;
  const useFlexGrid   = screenWidth - CARD_PADDING >= MIN_CELL_W * 7;
  // Chiều rộng mỗi ô khi dùng flex (có gap 4px × 6 khoảng)
  const flexCellW     = Math.floor((screenWidth - CARD_PADDING - 4 * 6) / 7);

  const updatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("vi-VN", { hour:"2-digit", minute:"2-digit" })
    : "--";

  // ── Smart recommendations (re-computed khi có dữ liệu bệnh) ──
  const smartRecs = currentWeather
    ? buildSmartRecommendations(currentWeather.forecasts, recentDisease, diagnosedAt)
    : { tips: [], bestSprayDay: null };
  const recommendation = smartRecs.tips;

  // Render danh sách ô — dùng chung cho cả flex và scroll
  const renderCells = (forecasts: NonNullable<typeof currentWeather>["forecasts"], flex: boolean) =>
    forecasts.map((f, i) => {
      const rc = RISK_COLOR[f.riskLevel];
      const rb = RISK_BG[f.riskLevel];
      const avgTemp = (f.tempMax + f.tempMin) / 2;
      const dw = diseaseWarning(avgTemp, f.humidity, f.rain);
      return (
        <View key={f.date} style={[
          s.cell,
          flex ? { flex: 1 } : { width: 100 },
          i === 0 && { backgroundColor: rb, borderColor: rc, borderWidth: 2 },
        ]}>
          <Text style={[s.cellDow, i===0 && { color: rc, fontWeight:"800" }]}>
            {shortDay(f.date, i)}
          </Text>
          <Text style={s.cellEmoji}>{weatherEmoji(f.weatherCode)}</Text>
          <View style={s.cellRow}>
            <Text style={[s.cellTempMax, i===0 && { color: rc }]}>{f.tempMax}°</Text>
            <Text style={s.cellSlash}>/</Text>
            <Text style={s.cellTempMin}>{f.tempMin}°</Text>
          </View>
          <Text style={s.cellSubLabel}>nhiệt độ (cao/thấp)</Text>
          <View style={s.cellRow}>
            <Text style={s.cellIcon}>💧</Text>
            <Text style={s.cellVal}>{f.humidity}%</Text>
          </View>
          <Text style={s.cellSubLabel}>độ ẩm không khí</Text>
          <View style={s.cellRow}>
            <Text style={s.cellIcon}>{f.rain > 0 ? "🌧" : "☀️"}</Text>
            <Text style={[s.cellVal, f.rain > 0 && { color:"#1976d2" }]}>
              {f.rain > 0 ? `${f.rain} mm` : "Không mưa"}
            </Text>
          </View>
          <Text style={s.cellSubLabel}>lượng mưa</Text>
          <View style={[s.riskChip, { backgroundColor: dw.color }]}>
            <Text style={s.riskChipTxt} numberOfLines={2}>{dw.text}</Text>
          </View>
        </View>
      );
    });

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
          <View style={s.hdr2TitleRow}>
            <Text style={s.hdr2Label}>💡 Khuyến nghị:</Text>
            {recentLabelVI && diagnosedAt && (Date.now() - diagnosedAt < 7 * 24 * 60 * 60 * 1000) && (
              <View style={s.hdr2Badge}>
                <Text style={s.hdr2BadgeTxt}>📌 Dựa trên: {recentLabelVI}</Text>
              </View>
            )}
          </View>
          {recommendation.slice(0, 3).map((tip, i) => (
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

      {/* ══ 7-DAY GRID ══
          Màn rộng: View hàng ngang flex, ô tự co dãn
          Màn hẹp:  ScrollView ngang, ô cố định 100px   */}
      {useFlexGrid ? (
        <View style={s.grid}>
          {renderCells(currentWeather.forecasts, true)}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.grid}>
          {renderCells(currentWeather.forecasts, false)}
        </ScrollView>
      )}

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
    paddingHorizontal:12, paddingVertical:8,
    borderTopWidth:1, borderTopColor:"rgba(0,0,0,.07)",
  },
  hdr2TitleRow: { flexDirection:"row", alignItems:"center", flexWrap:"wrap", gap:6, marginBottom:5 },
  hdr2Label:    { fontSize:11, fontWeight:"700", color:Colors.primary },
  hdr2Badge:    { backgroundColor:"rgba(0,0,0,.10)", borderRadius:20, paddingHorizontal:8, paddingVertical:2 },
  hdr2BadgeTxt: { fontSize:9, fontWeight:"700", color:Colors.text },
  hdr2Tip:      { fontSize:11, color:Colors.text, lineHeight:17, marginBottom:3 },

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

  // ── 7-day grid ──
  grid: {
    flexDirection: "row",          // ← luôn hàng ngang
    paddingHorizontal:8, paddingVertical:8, gap:4,
  },
  cell: {
    // width / flex set inline theo useFlexGrid
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
