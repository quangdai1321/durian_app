import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, Alert, TextInput, Image, Modal,
  KeyboardAvoidingView, Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { diagnosisApi, authApi, yieldStatsApi } from "../../services/api";
import { Colors } from "../../constants/Colors";
import { API_BASE_URL } from "../../constants/Config";

const SCREEN_W = Dimensions.get("window").width;
const YIELD_KEY = "yield_stats";

interface YieldRecord {
  id: string;
  year: number;
  area_ha: number;
  yield_ton: number;
  revenue_m?: number;   // triệu đồng (doanh thu)
  cost_m?: number;      // triệu đồng (chi phí)
  note?: string;
}

/** Format triệu đồng → "150 tr.đ" */
function fmtM(v?: number): string {
  if (v == null || v === 0) return "—";
  return `${v.toLocaleString("vi-VN")} tr.đ`;
}

/** Rút gọn số lớn cho nhãn biểu đồ: 1500 → "1.5K", 2000000 → "2M" */
function fmtChartNum(v: number, showSign = false): string {
  const abs  = Math.abs(v);
  const sign = showSign ? (v > 0 ? "+" : v < 0 ? "-" : "") : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`;
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}K`;
  return `${sign}${abs}`;
}

// ── Reusable chart components ────────────────────────────────

const BAR_H = 100; // max bar height px
const GRID_STEPS = 4;

interface ColDatum {
  label: string; value: number; color: string;
  showSign?: boolean; hasData?: boolean;
}

function ColumnChart({ data, maxVal, unit }: { data: ColDatum[]; maxVal: number; unit?: string }) {
  const max = Math.max(maxVal, 1);
  const gridVals = Array.from({ length: GRID_STEPS }, (_, i) => (i + 1) / GRID_STEPS * max);
  return (
    <View style={ch.wrap}>
      {/* Y-axis + grid area */}
      <View style={ch.yCol}>
        {gridVals.reverse().map((v, i) => (
          <View key={i} style={ch.yLblWrap}>
            <Text style={ch.yLbl}>{fmtChartNum(v)}</Text>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {/* Grid lines */}
        <View style={[ch.barsArea, { height: BAR_H }]}>
          {gridVals.map((_, i) => (
            <View key={i} style={[ch.gridLine, { bottom: ((i + 1) / GRID_STEPS) * BAR_H }]} />
          ))}
          {/* Baseline */}
          <View style={[ch.gridLine, { bottom: 0, backgroundColor: "#bdbdbd" }]} />
          {/* Bars row */}
          <View style={ch.barsRow}>
            {data.map((d, i) => {
              const h = d.hasData === false ? 0 : Math.max((Math.abs(d.value) / max) * BAR_H, d.value !== 0 ? 6 : 0);
              return (
                <View key={i} style={ch.barItem}>
                  {d.hasData !== false && d.value !== 0 && (
                    <Text style={[ch.barTopLbl, { color: d.color }]}>
                      {d.showSign && d.value > 0 ? "+" : ""}{fmtChartNum(d.value)}{unit ? unit : ""}
                    </Text>
                  )}
                  <View style={[ch.bar, { height: h, backgroundColor: d.color,
                    borderTopLeftRadius: 5, borderTopRightRadius: 5 }]} />
                </View>
              );
            })}
          </View>
        </View>
        {/* X labels */}
        <View style={ch.xRow}>
          {data.map((d, i) => (
            <Text key={i} style={ch.xLbl}>{d.label}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}


const ch = StyleSheet.create({
  wrap:       { flexDirection: "row", marginTop: 4, marginBottom: 6 },
  yCol:       { width: 34, justifyContent: "space-between", paddingBottom: 20 },
  yLblWrap:   { flex: 1, justifyContent: "flex-start" },
  yLbl:       { fontSize: 9, color: "#9e9e9e", textAlign: "right", paddingRight: 4 },
  barsArea:   { position: "relative", marginBottom: 0 },
  gridLine:   { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "#e8f5e9" },
  barsRow:    { position: "absolute", bottom: 0, left: 0, right: 0,
                flexDirection: "row", alignItems: "flex-end" },
  barItem:    { flex: 1, alignItems: "center" },
  bar:        { width: "60%", minHeight: 0 },
  barTopLbl:  { fontSize: 9, fontWeight: "800", marginBottom: 2, textAlign: "center" },
  xRow:       { flexDirection: "row", marginTop: 4 },
  xLbl:       { flex: 1, fontSize: 9, color: "#9e9e9e", textAlign: "center", fontWeight: "600" },
});

// ── Yield Statistics Modal ────────────────────────────────────
function YieldModal({ visible, onClose, username }: {
  visible: boolean; onClose: () => void; username: string;
}) {
  const [records,  setRecords]  = useState<YieldRecord[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [adding,   setAdding]   = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [year,     setYear]     = useState(String(new Date().getFullYear()));
  const [area,     setArea]     = useState("");
  const [yieldT,   setYieldT]   = useState("");
  const [revenue,  setRevenue]  = useState("");
  const [cost,     setCost]     = useState("");
  const [note,     setNote]     = useState("");

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    // 1. Thử load từ server (luôn mới nhất, dùng được mọi trình duyệt / thiết bị)
    yieldStatsApi.get()
      .then(res => {
        const recs: YieldRecord[] = res.records || [];
        setRecords(recs);
        // Cập nhật cache local
        AsyncStorage.setItem(`${YIELD_KEY}:${username}`, JSON.stringify(recs)).catch(() => {});
      })
      .catch(() => {
        // 2. Nếu server lỗi → dùng cache AsyncStorage
        AsyncStorage.getItem(`${YIELD_KEY}:${username}`)
          .then(raw => setRecords(raw ? JSON.parse(raw) : []))
          .catch(() => {});
      })
      .finally(() => setLoading(false));
  }, [visible, username]);

  const save = async (recs: YieldRecord[]) => {
    setRecords(recs);
    // Lưu lên server + cache local song song
    await Promise.allSettled([
      yieldStatsApi.set(recs),
      AsyncStorage.setItem(`${YIELD_KEY}:${username}`, JSON.stringify(recs)),
    ]);
  };

  const resetForm = () => {
    setYear(String(new Date().getFullYear()));
    setArea(""); setYieldT(""); setRevenue(""); setCost(""); setNote("");
    setEditId(null); setAdding(false);
  };

  const submitRecord = async () => {
    const y = parseInt(year), a = parseFloat(area), t = parseFloat(yieldT);
    if (!y || y < 2000 || y > 2100) return Alert.alert("Lỗi", "Năm không hợp lệ");
    if (!a || a <= 0) return Alert.alert("Lỗi", "Diện tích không hợp lệ");
    if (!t || t <= 0) return Alert.alert("Lỗi", "Sản lượng không hợp lệ");
    const rev = revenue ? parseFloat(revenue) : undefined;
    const cst = cost    ? parseFloat(cost)    : undefined;
    if (rev && rev > 100_000) return Alert.alert("Lỗi", "Doanh thu nhập theo đơn vị triệu đồng.\nVí dụ: 150 = 150 triệu đồng");
    if (cst && cst > 100_000) return Alert.alert("Lỗi", "Chi phí nhập theo đơn vị triệu đồng.\nVí dụ: 80 = 80 triệu đồng");

    const rec: YieldRecord = {
      id: editId || Date.now().toString(),
      year: y, area_ha: a, yield_ton: t,
      revenue_m: rev,
      cost_m:    cst,
      note:      note || undefined,
    };
    const updated = editId
      ? records.map(r => r.id === editId ? rec : r)
      : [...records, rec].sort((a, b) => b.year - a.year);
    await save(updated);
    resetForm();
  };

  const deleteRecord = (id: string) => {
    if (Platform.OS === "web") {
      if (!window.confirm("Xoá bản ghi này?")) return;
      save(records.filter(r => r.id !== id));
    } else {
      Alert.alert("Xoá", "Xoá bản ghi này?", [
        { text: "Huỷ" },
        { text: "Xoá", style: "destructive", onPress: () => save(records.filter(r => r.id !== id)) },
      ]);
    }
  };

  const startEdit = (r: YieldRecord) => {
    setEditId(r.id); setYear(String(r.year)); setArea(String(r.area_ha));
    setYieldT(String(r.yield_ton));
    setRevenue(r.revenue_m != null ? String(r.revenue_m) : "");
    setCost(r.cost_m != null ? String(r.cost_m) : "");
    setNote(r.note || ""); setAdding(true);
  };

  // Computed totals
  const totalRevenue  = records.reduce((s, r) => s + (r.revenue_m || 0), 0);
  const totalCost     = records.reduce((s, r) => s + (r.cost_m    || 0), 0);
  const totalProfit   = totalRevenue - totalCost;
  const hasFinancial  = records.some(r => r.revenue_m || r.cost_m);

  // Chart scale
  const maxYield      = Math.max(...records.map(r => r.yield_ton), 1);
  const maxAbsProfit  = Math.max(...records.map(r => Math.abs((r.revenue_m || 0) - (r.cost_m || 0))), 1);
  const sorted        = [...records].sort((a, b) => a.year - b.year);

  // Live profit preview in form
  const previewRev    = parseFloat(revenue) || 0;
  const previewCst    = parseFloat(cost)    || 0;
  const previewProfit = previewRev - previewCst;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={ym.overlay}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
          <View style={ym.sheet}>
            {/* Header */}
            <View style={ym.header}>
              <View>
                <Text style={ym.title}>📊 Thống kê sản lượng</Text>
                <Text style={ym.sub}>Theo dõi năng suất & tài chính vườn sầu riêng</Text>
              </View>
              <TouchableOpacity style={ym.closeBtn} onPress={onClose}>
                <Text style={ym.closeTxt}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={ym.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Loading indicator */}
              {loading && (
                <View style={{ alignItems: "center", paddingVertical: 24 }}>
                  <ActivityIndicator color={Colors.primary} size="small" />
                  <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 8 }}>Đang tải dữ liệu...</Text>
                </View>
              )}

              {/* Tổng quan nhanh — hiển thị khi có ít nhất 1 bản ghi */}
              {records.length > 0 && (
                <View style={ym.quickRow}>
                  <View style={ym.quickItem}>
                    <Text style={ym.quickVal}>{records.length} năm</Text>
                    <Text style={ym.quickLbl}>Theo dõi</Text>
                  </View>
                  <View style={ym.quickDiv} />
                  <View style={ym.quickItem}>
                    <Text style={ym.quickVal}>
                      {(records.reduce((s, r) => s + (r.area_ha > 0 ? r.yield_ton / r.area_ha : 0), 0) / records.length).toFixed(1)} t/ha
                    </Text>
                    <Text style={ym.quickLbl}>TB năng suất</Text>
                  </View>
                  <View style={ym.quickDiv} />
                  <View style={ym.quickItem}>
                    <Text style={ym.quickVal}>{Math.max(...records.map(r => r.yield_ton))} tấn</Text>
                    <Text style={ym.quickLbl}>Cao nhất</Text>
                  </View>
                  <View style={ym.quickDiv} />
                  <View style={ym.quickItem}>
                    <Text style={ym.quickVal}>{Math.max(...records.map(r => r.area_ha))} ha</Text>
                    <Text style={ym.quickLbl}>Diện tích</Text>
                  </View>
                </View>
              )}

              {/* Summary cards tài chính — hiển thị khi có dữ liệu tài chính */}
              {hasFinancial && records.length > 0 && (
                <View style={ym.summaryRow}>
                  <View style={[ym.summaryCard, { backgroundColor: "#e8f5e9" }]}>
                    <Text style={ym.summaryIcon}>💰</Text>
                    <Text style={[ym.summaryVal, { color: "#2e7d32" }]}>{fmtM(totalRevenue)}</Text>
                    <Text style={ym.summaryLbl}>Tổng thu</Text>
                  </View>
                  <View style={[ym.summaryCard, { backgroundColor: "#fce4ec" }]}>
                    <Text style={ym.summaryIcon}>💸</Text>
                    <Text style={[ym.summaryVal, { color: "#c62828" }]}>{fmtM(totalCost)}</Text>
                    <Text style={ym.summaryLbl}>Tổng chi</Text>
                  </View>
                  <View style={[ym.summaryCard, { backgroundColor: totalProfit >= 0 ? "#e8f5e9" : "#fce4ec" }]}>
                    <Text style={ym.summaryIcon}>{totalProfit >= 0 ? "📈" : "📉"}</Text>
                    <Text style={[ym.summaryVal, { color: totalProfit >= 0 ? "#2e7d32" : "#c62828" }]}>
                      {totalProfit >= 0 ? "+" : ""}{fmtM(Math.abs(totalProfit))}
                    </Text>
                    <Text style={ym.summaryLbl}>Lợi nhuận</Text>
                  </View>
                </View>
              )}

              {/* Form thêm/sửa */}
              {adding ? (
                <View style={ym.form}>
                  <Text style={ym.formTitle}>{editId ? "✏️ Sửa bản ghi" : "➕ Thêm năm mới"}</Text>
                  <View style={ym.formRow}>
                    <View style={[ym.fieldWrap, { flex: 1 }]}>
                      <Text style={ym.label}>Năm *</Text>
                      <TextInput style={ym.input} value={year} onChangeText={setYear}
                        keyboardType="number-pad" placeholder="2024" placeholderTextColor="#aaa" />
                    </View>
                    <View style={[ym.fieldWrap, { flex: 1.5 }]}>
                      <Text style={ym.label}>Diện tích (ha) *</Text>
                      <TextInput style={ym.input} value={area} onChangeText={setArea}
                        keyboardType="decimal-pad" placeholder="0.5" placeholderTextColor="#aaa" />
                    </View>
                  </View>
                  <View style={ym.formRow}>
                    <View style={[ym.fieldWrap, { flex: 1 }]}>
                      <Text style={ym.label}>Sản lượng (tấn) *</Text>
                      <TextInput style={ym.input} value={yieldT} onChangeText={setYieldT}
                        keyboardType="decimal-pad" placeholder="2.5" placeholderTextColor="#aaa" />
                    </View>
                    <View style={[ym.fieldWrap, { flex: 1 }]}>
                      <Text style={ym.label}>Doanh thu (tr.đ)</Text>
                      <TextInput style={ym.input} value={revenue} onChangeText={setRevenue}
                        keyboardType="decimal-pad" placeholder="150" placeholderTextColor="#aaa" />
                    </View>
                  </View>
                  <View style={ym.formRow}>
                    <View style={[ym.fieldWrap, { flex: 1 }]}>
                      <Text style={ym.label}>Chi phí (tr.đ)</Text>
                      <TextInput style={ym.input} value={cost} onChangeText={setCost}
                        keyboardType="decimal-pad" placeholder="80" placeholderTextColor="#aaa" />
                    </View>
                    <View style={[ym.fieldWrap, { flex: 1, justifyContent: "center" }]}>
                      {(revenue || cost) ? (
                        <View style={[ym.profitPreview, { backgroundColor: previewProfit >= 0 ? "#e8f5e9" : "#fce4ec" }]}>
                          <Text style={ym.profitPreviewLbl}>Lãi / Lỗ</Text>
                          <Text style={[ym.profitPreviewVal, { color: previewProfit >= 0 ? "#2e7d32" : "#c62828" }]}>
                            {previewProfit >= 0 ? "+" : ""}{previewProfit.toLocaleString("vi-VN")} tr
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Text style={ym.hint}>💡 Nhập số tiền theo triệu đồng — Ví dụ: 150 = 150 triệu đ</Text>
                  <View style={ym.fieldWrap}>
                    <Text style={ym.label}>Ghi chú</Text>
                    <TextInput style={[ym.input, { height: 56 }]} value={note} onChangeText={setNote}
                      placeholder="Thời tiết, sâu bệnh, kỹ thuật mới..." placeholderTextColor="#aaa"
                      multiline />
                  </View>
                  <View style={ym.formBtns}>
                    <TouchableOpacity style={ym.cancelBtn} onPress={resetForm}>
                      <Text style={ym.cancelTxt}>Huỷ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={ym.saveBtn} onPress={submitRecord}>
                      <Text style={ym.saveTxt}>💾 Lưu</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={ym.addBtn} onPress={() => setAdding(true)}>
                  <Text style={ym.addBtnTxt}>➕ Thêm năm mới</Text>
                </TouchableOpacity>
              )}

              {/* Danh sách */}
              {records.length === 0 ? (
                <View style={ym.empty}>
                  <Text style={ym.emptyIcon}>🌱</Text>
                  <Text style={ym.emptyTxt}>Chưa có dữ liệu sản lượng</Text>
                  <Text style={ym.emptySub}>Nhấn "Thêm năm mới" để bắt đầu theo dõi</Text>
                </View>
              ) : (
                <>
                  {/* ── Chart box ── */}
                  <View style={ym.chartBox}>

                    {/* Biểu đồ 1: Sản lượng */}
                    <Text style={ym.chartTitle}>📈 Sản lượng theo năm (tấn)</Text>
                    <ColumnChart
                      data={sorted.map(r => ({
                        label: String(r.year),
                        value: r.yield_ton,
                        color: Colors.primary,
                      }))}
                      maxVal={maxYield}
                      unit="t"
                    />

                    {/* Biểu đồ 2: Lợi nhuận (chỉ khi có tài chính) */}
                    {hasFinancial && (
                      <>
                        <View style={ym.chartDivider} />
                        <Text style={ym.chartTitle}>💰 Lợi nhuận theo năm (triệu đ)</Text>
                        <ColumnChart
                          data={sorted.map(r => {
                            const p = (r.revenue_m || 0) - (r.cost_m || 0);
                            return {
                              label: String(r.year),
                              value: p,
                              color: p >= 0 ? "#43a047" : "#ef5350",
                              showSign: true,
                              hasData: r.revenue_m != null || r.cost_m != null,
                            };
                          })}
                          maxVal={maxAbsProfit}
                          unit="tr"
                        />
                      </>
                    )}
                  </View>

                  {/* Records list */}
                  {records.map((r, i) => {
                    const profit    = (r.revenue_m || 0) - (r.cost_m || 0);
                    const isProfit  = profit > 0;
                    const hasFinRec = r.revenue_m != null || r.cost_m != null;
                    return (
                      <View key={r.id} style={[ym.recCard, i === 0 && { borderTopWidth: 0 }]}>
                        <View style={ym.recHeader}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text style={ym.recYear}>📅 {r.year}</Text>
                            {hasFinRec && (
                              <View style={[ym.recProfitBadge, {
                                backgroundColor: isProfit ? "#e8f5e9" : profit < 0 ? "#fce4ec" : "#f5f5f5",
                              }]}>
                                <Text style={[ym.recProfitTxt, {
                                  color: isProfit ? "#2e7d32" : profit < 0 ? "#c62828" : "#888",
                                }]}>
                                  {isProfit ? "✅ Có lãi" : profit < 0 ? "⚠️ Lỗ vốn" : "± Hoà vốn"}
                                </Text>
                              </View>
                            )}
                          </View>
                          <View style={ym.recActions}>
                            <TouchableOpacity style={ym.recEditBtn} onPress={() => startEdit(r)}>
                              <Text style={ym.recEditTxt}>Sửa</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={ym.recDelBtn} onPress={() => deleteRecord(r.id)}>
                              <Text style={ym.recDelTxt}>Xoá</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Sản lượng stats */}
                        <View style={ym.recStats}>
                          <View style={ym.recStat}>
                            <Text style={ym.recStatVal}>{r.area_ha} ha</Text>
                            <Text style={ym.recStatLbl}>Diện tích</Text>
                          </View>
                          <View style={ym.recDivider} />
                          <View style={ym.recStat}>
                            <Text style={ym.recStatVal}>{r.yield_ton} tấn</Text>
                            <Text style={ym.recStatLbl}>Sản lượng</Text>
                          </View>
                          <View style={ym.recDivider} />
                          <View style={ym.recStat}>
                            <Text style={ym.recStatVal}>{r.area_ha > 0 ? (r.yield_ton / r.area_ha).toFixed(1) : "—"} t/ha</Text>
                            <Text style={ym.recStatLbl}>Năng suất</Text>
                          </View>
                        </View>

                        {/* Tài chính */}
                        {hasFinRec && (
                          <View style={ym.finRow}>
                            <View style={ym.finItem}>
                              <Text style={ym.finLbl}>💰 Doanh thu</Text>
                              <Text style={[ym.finVal, { color: "#2e7d32" }]}>{fmtM(r.revenue_m)}</Text>
                            </View>
                            <View style={ym.finDivider} />
                            <View style={ym.finItem}>
                              <Text style={ym.finLbl}>💸 Chi phí</Text>
                              <Text style={[ym.finVal, { color: "#c62828" }]}>{fmtM(r.cost_m)}</Text>
                            </View>
                            <View style={ym.finDivider} />
                            <View style={ym.finItem}>
                              <Text style={ym.finLbl}>{isProfit ? "📈 Lợi nhuận" : profit < 0 ? "📉 Lỗ" : "± Lãi/Lỗ"}</Text>
                              <Text style={[ym.finVal, { color: isProfit ? "#2e7d32" : profit < 0 ? "#c62828" : "#666" }]}>
                                {isProfit ? "+" : ""}{fmtM(Math.abs(profit))}
                              </Text>
                            </View>
                          </View>
                        )}

                        {r.note ? <Text style={ym.recNote}>💬 {r.note}</Text> : null}
                      </View>
                    );
                  })}
                </>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const ym = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet:      { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%", minHeight: 400 },
  header:     { backgroundColor: Colors.primary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title:      { color: "#fff", fontSize: 17, fontWeight: "800" },
  sub:        { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  closeBtn:   { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 16, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  closeTxt:   { color: "#fff", fontSize: 16, fontWeight: "700" },
  body:       { padding: 16 },

  // Quick stats (always visible)
  quickRow:  { flexDirection: "row", backgroundColor: "#f0faf4", borderRadius: 12, padding: 12, marginBottom: 14 },
  quickItem: { flex: 1, alignItems: "center" },
  quickVal:  { fontSize: 13, fontWeight: "800", color: Colors.text },
  quickLbl:  { fontSize: 10, color: Colors.textMuted, marginTop: 2, textAlign: "center" },
  quickDiv:  { width: 1, backgroundColor: Colors.border },

  // Summary totals
  summaryRow:  { flexDirection: "row", gap: 8, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center" },
  summaryIcon: { fontSize: 18, marginBottom: 3 },
  summaryVal:  { fontSize: 11, fontWeight: "800", textAlign: "center" },
  summaryLbl:  { fontSize: 10, color: Colors.textMuted, marginTop: 2, textAlign: "center" },

  addBtn:     { backgroundColor: Colors.primaryLt, borderRadius: 12, padding: 14, alignItems: "center", marginBottom: 16 },
  addBtnTxt:  { color: Colors.primary, fontWeight: "700", fontSize: 14 },

  form:       { backgroundColor: "#f8fffe", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  formTitle:  { fontSize: 14, fontWeight: "700", color: Colors.text, marginBottom: 12 },
  formRow:    { flexDirection: "row", gap: 10 },
  fieldWrap:  { marginBottom: 10 },
  label:      { fontSize: 11, color: Colors.textMuted, marginBottom: 4, fontWeight: "600" },
  input:      { backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: Colors.text },
  hint:       { fontSize: 11, color: "#7e6514", fontStyle: "italic", marginBottom: 10, backgroundColor: "#fffde7", padding: 8, borderRadius: 6, borderLeftWidth: 3, borderLeftColor: "#f9a825" },
  profitPreview:    { borderRadius: 8, padding: 8, alignItems: "center", justifyContent: "center", marginTop: 20, height: 46 },
  profitPreviewLbl: { fontSize: 10, color: Colors.textMuted, marginBottom: 1 },
  profitPreviewVal: { fontSize: 13, fontWeight: "800" },
  formBtns:   { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn:  { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, alignItems: "center" },
  cancelTxt:  { color: Colors.textMuted, fontWeight: "600" },
  saveBtn:    { flex: 2, backgroundColor: Colors.primary, borderRadius: 10, padding: 12, alignItems: "center" },
  saveTxt:    { color: "#fff", fontWeight: "700" },

  empty:      { alignItems: "center", paddingVertical: 40 },
  emptyIcon:  { fontSize: 48, marginBottom: 10 },
  emptyTxt:   { fontSize: 15, fontWeight: "700", color: Colors.text, marginBottom: 6 },
  emptySub:   { fontSize: 12, color: Colors.textMuted, textAlign: "center" },

  chartBox:     { backgroundColor: "#f8fffe", borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#c8e6c9" },
  chartTitle:   { fontSize: 13, fontWeight: "700", color: Colors.primary, marginBottom: 10 },
  chartDivider: { height: 1, backgroundColor: "#d4edda", marginVertical: 16 },

  recCard:        { paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  recHeader:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  recYear:        { fontSize: 15, fontWeight: "800", color: Colors.text },
  recProfitBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  recProfitTxt:   { fontSize: 11, fontWeight: "600" },
  recActions:     { flexDirection: "row", gap: 8 },
  recEditBtn:     { backgroundColor: "#e3f2fd", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  recEditTxt:     { color: "#1565c0", fontSize: 12, fontWeight: "600" },
  recDelBtn:      { backgroundColor: "#fce4ec", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  recDelTxt:      { color: "#c62828", fontSize: 12, fontWeight: "600" },
  recStats:       { flexDirection: "row", alignItems: "center", backgroundColor: "#fafafa", borderRadius: 10, padding: 10, marginBottom: 8 },
  recStat:        { flex: 1, alignItems: "center" },
  recStatVal:     { fontSize: 14, fontWeight: "800", color: Colors.text },
  recStatLbl:     { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  recDivider:     { width: 1, height: 32, backgroundColor: Colors.border },

  finRow:     { flexDirection: "row", backgroundColor: "#f9f9f9", borderRadius: 10, padding: 10, marginBottom: 4 },
  finItem:    { flex: 1, alignItems: "center" },
  finLbl:     { fontSize: 10, color: Colors.textMuted, marginBottom: 3, textAlign: "center" },
  finVal:     { fontSize: 12, fontWeight: "800", textAlign: "center" },
  finDivider: { width: 1, height: 36, backgroundColor: Colors.border },

  recNote:    { marginTop: 6, fontSize: 12, color: Colors.textMuted, fontStyle: "italic" },
});

const BASE_URL = API_BASE_URL;

const DISEASE_LABELS: Record<string, string> = {
  Leaf_Algal:          "Tảo lá",
  Leaf_Blight:         "Cháy lá",
  Leaf_Colletotrichum: "Colletotrichum",
  Leaf_Healthy:        "Khỏe mạnh",
  Leaf_Phomopsis:      "Phomopsis",
  Leaf_Rhizoctonia:    "Rhizoctonia",
};

const PROVINCES = [
  "Bình Dương", "Bình Phước", "Cần Thơ", "Đắk Lắk", "Đắk Nông",
  "Đồng Nai", "Đồng Tháp", "Hậu Giang", "Khánh Hòa", "Kiên Giang",
  "Lâm Đồng", "Long An", "Tiền Giang", "Trà Vinh", "Vĩnh Long",
];

/** Chuẩn hoá tên tỉnh/thành bị lỗi encoding (ký tự ? thay cho chữ có dấu) */
function fixProvince(raw?: string): string {
  if (!raw) return "";
  if (PROVINCES.includes(raw)) return raw;
  // Bảng map các chuỗi bị lỗi encoding → tên đúng
  const FIX: Record<string, string> = {
    "Bình Phu?c": "Bình Phước",  "Bình Phu\u1EDB?c": "Bình Phước",
    "Đ?k L?k":   "Đắk Lắk",     "Đ?k Nông":         "Đắk Nông",
    "H?u Giang": "Hậu Giang",    "Ti?n Giang":        "Tiền Giang",
    "Lâm Đ?ng":  "Lâm Đồng",     "Đ?ng Nai":          "Đồng Nai",
    "Đ?ng Tháp": "Đồng Tháp",    "Kiên Giang":        "Kiên Giang",
    "Tr? Vinh":  "Trà Vinh",     "Vĩnh Long":         "Vĩnh Long",
  };
  if (FIX[raw]) return FIX[raw];
  // Generic fallback: xoá dấu ? + so khớp mờ với danh sách PROVINCES
  const noQ = raw.replace(/\?/g, "").toLowerCase();
  const ascii = (s: string) => s.toLowerCase().replace(/[\u0100-\uFFFF]/g, "");
  return PROVINCES.find(p => ascii(p) === ascii(noQ) || ascii(p) === ascii(raw)) || raw;
}

interface StatItem { label: string; value: string; icon: string; color: string }
interface DiagnosisItem { id: string; predicted_class: string; confidence: number; created_at: string; province?: string }

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [diagCount,    setDiagCount]    = useState<number | null>(null);
  const [recentItems,  setRecentItems]  = useState<DiagnosisItem[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const [avatarLoading, setAvatarLoading] = useState(false);
  const [showYield,    setShowYield]    = useState(false);

  // Edit state
  const [editing,     setEditing]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [editName,    setEditName]    = useState("");
  const [editPhone,   setEditPhone]   = useState("");
  const [editProvince,setEditProvince]= useState("");
  const [saveError,   setSaveError]   = useState("");

  useEffect(() => {
    diagnosisApi.list(0, 5)
      .then((d: any) => {
        setDiagCount(d.total ?? d.items?.length ?? 0);
        setRecentItems(d.items?.slice(0, 3) || []);
      })
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, []);

  const pickAvatar = async () => {
    // Web: use file input
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file"; input.accept = "image/*";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        setAvatarLoading(true);
        try {
          const reader = new FileReader();
          const dataUri: string = await new Promise((res, rej) => {
            reader.onload = e => res((e.target as any).result);
            reader.onerror = rej;
            reader.readAsDataURL(file);
          });
          await authApi.uploadAvatar(dataUri);
          await refreshUser();
        } catch (e: any) {
          Alert.alert("Lỗi", e?.message || "Không thể tải ảnh lên");
        } finally { setAvatarLoading(false); }
      };
      input.click();
      return;
    }
    // Native: show action sheet
    const choice = await new Promise<"camera"|"gallery"|null>(resolve => {
      Alert.alert("Ảnh đại diện", "Chọn nguồn ảnh", [
        { text: "📷 Chụp ảnh",    onPress: () => resolve("camera") },
        { text: "🖼️ Thư viện",    onPress: () => resolve("gallery") },
        { text: "Huỷ", style: "cancel", onPress: () => resolve(null) },
      ]);
    });
    if (!choice) return;
    let result;
    if (choice === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") return;
      result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, aspect: [1,1] });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;
      result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true, aspect: [1,1] });
    }
    if (result?.canceled || !result?.assets?.[0]) return;
    setAvatarLoading(true);
    try {
      await authApi.uploadAvatar(result.assets[0].uri);
      await refreshUser();
    } catch (e: any) {
      Alert.alert("Lỗi", e?.message || "Không thể tải ảnh lên");
    } finally { setAvatarLoading(false); }
  };

  const startEdit = () => {
    setEditName(user?.full_name || "");
    setEditPhone((user as any)?.phone || "");
    setEditProvince(user?.province || "");
    setSaveError("");
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setSaveError("");
  };

  const saveEdit = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await authApi.updateProfile({
        full_name: editName || undefined,
        phone:     editPhone || undefined,
        province:  editProvince || undefined,
      });
      await refreshUser(); // pull fresh data into AuthContext + AsyncStorage
      setEditing(false);
    } catch (e: any) {
      setSaveError(e.message || "Không thể lưu thông tin");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      if (!window.confirm("Đăng xuất khỏi tài khoản?")) return;
    } else {
      await new Promise<void>((res, rej) =>
        Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?",
          [{ text: "Huỷ", onPress: rej }, { text: "Đăng xuất", style: "destructive", onPress: res }]
        )
      ).catch(() => null);
    }
    await logout();
    router.replace("/login");
  };

  if (!user) {
    return (
      <View style={s.center}>
        <Text style={s.noUserText}>Chưa đăng nhập</Text>
        <TouchableOpacity style={s.loginBtn} onPress={() => router.replace("/login")}>
          <Text style={s.loginBtnText}>Đăng nhập</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stats: StatItem[] = [
    { label: "Lần chẩn đoán", value: loadingStats ? "..." : String(diagCount ?? 0), icon: "🔬", color: Colors.primary },
    { label: "Tỉnh/Thành",    value: fixProvince(user.province) || "—", icon: "📍", color: Colors.info },
    { label: "Vai trò",       value: user.role === "admin" ? "Quản trị" : "Nông dân", icon: "👤", color: Colors.secondary },
  ];

  const initials = (user.full_name || user.username)
    .split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <ScrollView style={s.root} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.avatarWrap} onPress={pickAvatar} activeOpacity={0.8}>
          {(user.avatar_data || user.avatar_url) ? (
            <Image
              source={{ uri: user.avatar_data || `${BASE_URL}${user.avatar_url}` }}
              style={s.avatarImg}
            />
          ) : (
            <View style={s.avatarCircle}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
          )}
          {avatarLoading ? (
            <View style={s.avatarOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <View style={s.avatarEditBadge}>
              <Text style={s.avatarEditIcon}>📷</Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={s.name}>{user.full_name || user.username}</Text>
        <Text style={s.username}>@{user.username}</Text>
        <Text style={s.email}>{user.email}</Text>
      </View>

      {/* Stats — 2×2 grid với ô thứ 4 là Thống kê sản lượng */}
      <View style={s.statsGrid}>
        {stats.map((st, i) => (
          <View key={i} style={s.statBox}>
            <Text style={s.statIcon}>{st.icon}</Text>
            <Text style={[s.statValue, { color: st.color }]}>{st.value}</Text>
            <Text style={s.statLabel}>{st.label}</Text>
          </View>
        ))}
        {/* Ô thứ 4: Thống kê sản lượng (clickable) */}
        <TouchableOpacity style={[s.statBox, s.statBoxYield]} onPress={() => setShowYield(true)} activeOpacity={0.8}>
          <Text style={s.statIcon}>📊</Text>
          <Text style={[s.statValue, { color: Colors.primary }]}>Xem →</Text>
          <Text style={s.statLabel}>Thống kê sản lượng</Text>
        </TouchableOpacity>
      </View>

      {/* Info card */}
      <View style={s.card}>
        <View style={s.cardTitleRow}>
          <Text style={s.cardTitle}>Thông tin tài khoản</Text>
          {!editing && (
            <TouchableOpacity onPress={startEdit} style={s.editBtn}>
              <Text style={s.editBtnText}>Chỉnh sửa</Text>
            </TouchableOpacity>
          )}
        </View>

        {editing ? (
          <View style={s.editForm}>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Họ và tên</Text>
              <TextInput
                style={s.fieldInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Nhập họ và tên"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Số điện thoại</Text>
              <TextInput
                style={s.fieldInput}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Nhập số điện thoại"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Tỉnh/Thành phố</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsScroll}>
                {PROVINCES.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[s.chip, editProvince === p && s.chipSelected]}
                    onPress={() => setEditProvince(prev => prev === p ? "" : p)}
                  >
                    <Text style={[s.chipText, editProvince === p && s.chipTextSelected]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {saveError ? (
              <View style={s.saveErrorBox}>
                <Text style={s.saveErrorText}>{saveError}</Text>
              </View>
            ) : null}

            <View style={s.editActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={cancelEdit} disabled={saving}>
                <Text style={s.cancelBtnText}>Huỷ</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={saveEdit} disabled={saving} activeOpacity={0.8}>
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.saveBtnText}>Lưu thay đổi</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <InfoRow icon="📛" label="Tên đăng nhập" value={user.username} />
            <InfoRow icon="✉️"  label="Email"          value={user.email} />
            <InfoRow icon="👤" label="Họ và tên"      value={user.full_name || "Chưa cập nhật"} />
            <InfoRow icon="📞" label="Điện thoại"     value={(user as any).phone || "Chưa cập nhật"} />
            <InfoRow icon="📍" label="Tỉnh/Thành"     value={fixProvince(user.province) || "Chưa cập nhật"} />
            <InfoRow icon="🔑" label="Vai trò"         value={user.role === "admin" ? "Quản trị viên" : "Người dùng"} last />
          </>
        )}
      </View>

      {/* Recent diagnoses */}
      {recentItems.length > 0 && (
        <View style={s.card}>
          <View style={s.cardTitleRow}>
            <Text style={s.cardTitle}>Chẩn đoán gần đây</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/history")}>
              <Text style={s.seeAll}>Xem tất cả →</Text>
            </TouchableOpacity>
          </View>
          {recentItems.map((d, i) => (
            <View key={i} style={[s.diagRow, i < recentItems.length - 1 && s.diagRowBorder]}>
              <View style={[s.diagDot, { backgroundColor: d.predicted_class?.includes("Healthy") ? Colors.success : Colors.warning }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.diagClass}>
                  {DISEASE_LABELS[d.predicted_class] || d.predicted_class}
                </Text>
                <Text style={s.diagMeta}>
                  {Math.round((d.confidence || 0) * 100)}% tự tin
                  {d.province ? ` · ${fixProvince(d.province)}` : ""}
                </Text>
              </View>
              <Text style={s.diagTime}>{formatDate(d.created_at)}</Text>
            </View>
          ))}
        </View>
      )}

      <YieldModal visible={showYield} onClose={() => setShowYield(false)} username={user.username} />

      {/* Logout */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={s.logoutText}>🚪 Đăng xuất</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function InfoRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <View style={[ir.row, !last && ir.border]}>
      <Text style={ir.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={ir.label}>{label}</Text>
        <Text style={ir.value}>{value}</Text>
      </View>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return ""; }
}

const ir = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  border:{ borderBottomWidth: 1, borderBottomColor: Colors.border },
  icon:  { fontSize: 20, marginRight: 12, width: 28, textAlign: "center" },
  label: { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  value: { fontSize: 14, color: Colors.text, fontWeight: "500" },
});

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  noUserText: { fontSize: 16, color: Colors.textMuted, marginBottom: 16 },
  loginBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  loginBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  header: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 30,
    alignItems: "center",
  },
  avatarWrap: { marginBottom: 12, position: "relative" },
  avatarImg: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 3, borderColor: "rgba(255,255,255,0.6)",
  },
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "rgba(255,255,255,0.4)",
  },
  avatarText: { fontSize: 30, fontWeight: "800", color: "#fff" },
  avatarOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 44, backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center",
  },
  avatarEditBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.accent,
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: Colors.primary,
  },
  avatarEditIcon: { fontSize: 13 },
  name:     { fontSize: 20, fontWeight: "700", color: "#fff", marginBottom: 4 },
  username: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 2 },
  email:    { fontSize: 12, color: "rgba(255,255,255,0.6)" },

  statsGrid: { flexDirection: "row", marginHorizontal: 12, marginVertical: 10, gap: 6 },
  statBox: {
    flex: 1, backgroundColor: "#fff", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4,
    alignItems: "center", borderWidth: 1, borderColor: Colors.border,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  statBoxYield: {
    borderColor: Colors.primary, borderWidth: 1.5,
    backgroundColor: Colors.primaryLt,
  },
  statIcon:  { fontSize: 18, marginBottom: 4 },
  statValue: { fontSize: 12, fontWeight: "800", marginBottom: 2, textAlign: "center" },
  statLabel: { fontSize: 9, color: Colors.textMuted, textAlign: "center" },

  card: {
    backgroundColor: "#fff", marginHorizontal: 14, marginBottom: 14,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardTitle:    { fontSize: 14, fontWeight: "700", color: Colors.text, marginBottom: 12 },
  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  seeAll:       { fontSize: 12, color: Colors.primary, fontWeight: "600" },

  editBtn:     { backgroundColor: Colors.primaryLt, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  editBtnText: { fontSize: 12, color: Colors.primary, fontWeight: "700" },

  editForm: { paddingTop: 4 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 6, fontWeight: "600" },
  fieldInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: Colors.text, backgroundColor: Colors.bg,
  },
  chipsScroll: { marginTop: 2 },
  chip: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, marginRight: 8,
    backgroundColor: "#fff",
  },
  chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12, color: Colors.text },
  chipTextSelected: { color: "#fff", fontWeight: "700" },

  saveErrorBox: { backgroundColor: "#ffebee", borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: "#ffcdd2" },
  saveErrorText: { color: "#c62828", fontSize: 12 },

  editActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingVertical: 11, alignItems: "center",
  },
  cancelBtnText: { fontSize: 14, color: Colors.textMuted, fontWeight: "600" },
  saveBtn: {
    flex: 2, backgroundColor: Colors.primary, borderRadius: 10,
    paddingVertical: 11, alignItems: "center",
  },
  saveBtnText: { fontSize: 14, color: "#fff", fontWeight: "700" },

  diagRow:   { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  diagRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  diagDot:   { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  diagClass: { fontSize: 13, fontWeight: "600", color: Colors.text, marginBottom: 2 },
  diagMeta:  { fontSize: 11, color: Colors.textMuted },
  diagTime:  { fontSize: 11, color: Colors.textMuted, marginLeft: 8 },

  logoutBtn: {
    marginHorizontal: 14, marginTop: 4, borderRadius: 12,
    backgroundColor: "#fff", padding: 15, alignItems: "center",
    borderWidth: 1, borderColor: "#fca5a5",
  },
  logoutText: { color: "#dc2626", fontWeight: "700", fontSize: 15 },
});
