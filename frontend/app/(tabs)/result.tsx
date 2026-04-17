import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, ActivityIndicator, Platform, Animated,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { diagnosisApi } from "../../services/api";
import { Colors } from "../../constants/Colors";
import { API_BASE_URL } from "../../constants/Config";
import AuthGuard from "../../components/AuthGuard";

const BASE_URL = API_BASE_URL;
const { width } = Dimensions.get("window");
const IS_WEB    = Platform.OS === "web";

const LABEL_VI: Record<string, string> = {
  Leaf_Algal:          "Bệnh đốm tảo (tảo ký sinh)",
  Leaf_Blight:         "Bệnh cháy lá (Phytophthora)",
  Leaf_Colletotrichum: "Bệnh thán thư (đốm nâu)",
  Leaf_Healthy:        "Lá khỏe mạnh",
  Leaf_Phomopsis:      "Bệnh khô đầu lá (Phomopsis)",
  Leaf_Rhizoctonia:    "Bệnh lở cổ rễ / đốm lá (Rhizoctonia)",
};

const DISEASE_ICON: Record<string, string> = {
  Leaf_Algal:          "🦠",   // vi sinh vật ký sinh — tảo
  Leaf_Blight:         "🔥",   // cháy lá
  Leaf_Colletotrichum: "🍂",   // lá nâu khô — thán thư
  Leaf_Healthy:        "💚",   // khỏe mạnh
  Leaf_Phomopsis:      "🥀",   // lá héo khô từ đầu ngọn
  Leaf_Rhizoctonia:    "🌱",   // cây non bệnh ở gốc rễ
};

export default function ResultScreen() {
  const router  = useRouter();
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [rating,    setRating]    = useState(0);

  const [showCorrect,       setShowCorrect]       = useState(false);
  const [correctClass,      setCorrectClass]       = useState<string | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted]  = useState(false);
  const [submittingFb,      setSubmittingFb]       = useState(false);
  const [imgError,          setImgError]           = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const barAnim   = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    setLoading(true);
    setRating(0);
    setShowCorrect(false);
    setCorrectClass(null);
    setFeedbackSubmitted(false);
    setSubmittingFb(false);
    setImgError(false);
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    barAnim.setValue(0);

    AsyncStorage.getItem("last_diagnosis").then(async raw => {
      if (raw) {
        const diag = JSON.parse(raw);
        setDiagnosis(diag);
        // Kiểm tra đã từng báo sai diagnosis này chưa
        if (diag?.id) {
          const stored = await AsyncStorage.getItem(`correction_${diag.id}`);
          if (stored) {
            setCorrectClass(stored);
            setFeedbackSubmitted(true);
          }
        }
      }
      setLoading(false);
    });
  }, []));

  useEffect(() => {
    if (!diagnosis) return;
    const conf = (diagnosis.confidence ?? 0) * 100;
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(barAnim,   { toValue: conf / 100, duration: 800, delay: 200, useNativeDriver: false }),
    ]).start();
  }, [diagnosis]);

  const submitCorrection = async (cls: string) => {
    if (!diagnosis?.id || submittingFb) return;
    setCorrectClass(cls);
    setSubmittingFb(true);
    try {
      await diagnosisApi.feedback(diagnosis.id, {
        actual_class: cls,
        rating: 1,
        comment: "User correction via app",
      });
      // Lưu vào AsyncStorage để giữ trạng thái khi xem lại từ lịch sử
      await AsyncStorage.setItem(`correction_${diagnosis.id}`, cls);
      setFeedbackSubmitted(true);
      setShowCorrect(false);
    } catch {
      setCorrectClass(null);
    } finally {
      setSubmittingFb(false);
    }
  };

  const submitFeedback = async (r: number) => {
    if (!diagnosis) return;
    setRating(r);
    try {
      await diagnosisApi.feedback(diagnosis.id, { rating: r });
      Alert.alert("Cảm ơn!", "Phản hồi của bạn giúp cải thiện mô hình.");
    } catch {}
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!diagnosis) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 56, marginBottom: 16 }}>🌿</Text>
        <Text style={styles.emptyTitle}>Chưa có kết quả</Text>
        <Text style={styles.emptyText}>Hãy chụp ảnh lá sầu riêng để bắt đầu</Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push("/(tabs)/camera")}>
          <Text style={styles.emptyBtnText}>📷  Chụp ảnh ngay</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cls      = diagnosis.predicted_class ?? "Unknown";
  const conf     = (diagnosis.confidence ?? 0) * 100;
  const confStr  = conf.toFixed(1);
  const nameVi   = diagnosis.disease?.name_vi || LABEL_VI[cls] || cls;
  const icon     = DISEASE_ICON[cls] ?? "🍃";
  const badge    = Colors.diseaseBadge[cls as keyof typeof Colors.diseaseBadge]
                 ?? { bg: "#f0f0f0", text: "#555" };
  const disease  = diagnosis.disease;
  const isHealthy = cls === "Leaf_Healthy";
  const isOOD    = diagnosis.is_ood === true;

  const confColor = conf >= 80 ? "#27ae60"
                  : conf >= 50 ? "#f39c12"
                  : "#e74c3c";

  // Ưu tiên: data URI từ DB; bỏ qua image_url (Railway ephemeral đã xóa)
  const imgUri = diagnosis.image_data?.startsWith("data:")
    ? diagnosis.image_data
    : diagnosis.image_data || null;

  return (
    <AuthGuard>
    <View style={styles.root}>

      {/* ── Compact nav bar ── */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push("/(tabs)/camera")}>
          <Text style={styles.backBtnText}>←  Chụp lại</Text>
        </TouchableOpacity>
        <View style={styles.navTag}>
          <Text style={styles.navTagText}>KẾT QUẢ</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ── Image preview ── */}
          {imgUri && !imgError ? (
            <View style={styles.imgCard}>
              <Image
                source={{ uri: imgUri }}
                style={styles.imgPreview}
                resizeMode="cover"
                onError={() => setImgError(true)}
              />
              <View style={[styles.imgIconBadge, { backgroundColor: badge.bg }]}>
                <Text style={{ fontSize: 22 }}>{icon}</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.imgCard, styles.imgPlaceholder]}>
              <Text style={{ fontSize: 48 }}>{icon}</Text>
              <Text style={{ fontSize: 13, color: "#aaa", marginTop: 8 }}>
                {imgError ? "Không tải được ảnh" : "Chưa có ảnh"}
              </Text>
              <View style={[styles.imgIconBadge, { backgroundColor: badge.bg }]}>
                <Text style={{ fontSize: 22 }}>{icon}</Text>
              </View>
            </View>
          )}

          {/* ── Main result card ── */}
          <View style={styles.mainCard}>
            {/* Class chip */}
            <View style={[styles.classChip, { backgroundColor: badge.bg }]}>
              <Text style={[styles.classChipText, { color: badge.text }]}>{cls}</Text>
            </View>

            <Text style={[styles.diseaseName, { color: badge.text }]}>{nameVi}</Text>

            {disease?.scientific && (
              <Text style={styles.sciName}>{disease.scientific}</Text>
            )}

            {/* Confidence meter */}
            <View style={styles.meterWrap}>
              <View style={styles.meterHeader}>
                <Text style={styles.meterLabel}>Độ tin cậy</Text>
                <Text style={[styles.meterValue, { color: confColor }]}>{confStr}%</Text>
              </View>
              <View style={styles.meterTrack}>
                <Animated.View
                  style={[
                    styles.meterFill,
                    {
                      width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                      backgroundColor: confColor,
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.meterGlow,
                    {
                      left: barAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                      backgroundColor: confColor,
                    },
                  ]}
                />
              </View>
              <View style={styles.meterTicks}>
                {[0,25,50,75,100].map(t => (
                  <Text key={t} style={styles.meterTick}>{t}%</Text>
                ))}
              </View>
            </View>
          </View>

          {/* ── OOD Warning ── */}
          {isOOD && (
            <View style={styles.oodBox}>
              <Text style={styles.oodIcon}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.oodTitle}>Ảnh có thể không phải lá sầu riêng</Text>
                <Text style={styles.oodDesc}>
                  Hệ thống phát hiện ảnh không có đặc điểm của lá cây. Kết quả dự đoán bên dưới có thể không chính xác.{"\n"}
                  Hãy chụp lại ảnh lá rõ nét, đủ sáng để có kết quả tốt nhất.
                </Text>
                <TouchableOpacity
                  style={styles.oodRetakeBtn}
                  onPress={() => router.push("/(tabs)/camera")}
                >
                  <Text style={styles.oodRetakeBtnText}>📷  Chụp lại ảnh lá</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Meta chips ── */}
          <View style={styles.metaRow}>
            <MetaChip icon="🤖" label="Mô hình" value={diagnosis.model_version?.replace("-CLS","") ?? "YOLOv26n"} />
            <MetaChip icon="⚡" label="Thời gian" value={`${diagnosis.inference_ms ?? "—"} ms`} />
            <MetaChip icon="💾" label="Kích thước" value="3.05 MB" />
          </View>

          {/* ── Top-3 predictions ── */}
          {diagnosis.top3_predictions?.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardHeaderIcon}>📊</Text>
                <Text style={styles.cardTitle}>Top 3 dự đoán</Text>
              </View>
              {diagnosis.top3_predictions.map((p: any, i: number) => {
                const pConf  = p.confidence * 100;
                const pBadge = Colors.diseaseBadge[p.class as keyof typeof Colors.diseaseBadge]
                             ?? { bg: "#f0f0f0", text: "#555" };
                return (
                  <View key={i} style={[styles.top3Item, i === 0 && styles.top3ItemFirst]}>
                    <View style={[styles.rankBubble, i === 0 && { backgroundColor: "#f5a623" }]}>
                      <Text style={styles.rankText}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.top3NameRow}>
                        <Text style={styles.top3Name}>{LABEL_VI[p.class] ?? p.class}</Text>
                        <Text style={[styles.top3Pct, { color: pBadge.text }]}>
                          {pConf.toFixed(1)}%
                        </Text>
                      </View>
                      <View style={styles.top3Track}>
                        <View style={[styles.top3Fill, { width: `${pConf}%` as any, backgroundColor: pBadge.text }]} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Top-2 confusion warning ── */}
          {(() => {
            const top3 = diagnosis.top3_predictions;
            if (!top3 || top3.length < 2) return null;
            const gap = (top3[0].confidence - top3[1].confidence) * 100;
            if (gap >= 15) return null;
            return (
              <View style={styles.confusionBox}>
                <Text style={styles.confusionIcon}>🤔</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.confusionTitle}>Kết quả khó phân biệt</Text>
                  <Text style={styles.confusionDesc}>
                    Chênh lệch với "{LABEL_VI[top3[1].class] ?? top3[1].class}" chỉ {gap.toFixed(1)}%.
                    Nên kiểm tra thêm hoặc tham khảo chuyên gia.
                  </Text>
                </View>
              </View>
            );
          })()}

          {/* ── Báo nhận diện sai ── */}
          {!isHealthy && (
            <View style={styles.correctCard}>
              {feedbackSubmitted ? (
                <View style={styles.correctDone}>
                  <Text style={styles.correctDoneIcon}>✅</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.correctDoneTitle}>Cảm ơn bạn đã đính chính!</Text>
                    <Text style={styles.correctDoneDesc}>
                      Nhãn "{LABEL_VI[correctClass!] ?? correctClass}" đã được ghi nhận để cải thiện model.
                    </Text>
                  </View>
                </View>
              ) : showCorrect ? (
                <>
                  <Text style={styles.correctTitle}>Chọn bệnh đúng:</Text>
                  <View style={styles.correctGrid}>
                    {Object.entries(LABEL_VI)
                      .filter(([k]) => k !== "Leaf_Healthy" && k !== cls)
                      .map(([k, v]) => (
                        <TouchableOpacity
                          key={k}
                          style={[styles.correctChip, correctClass === k && styles.correctChipActive, submittingFb && { opacity: 0.5 }]}
                          onPress={() => submitCorrection(k)}
                          disabled={submittingFb}
                        >
                          <Text style={styles.correctChipIcon}>{DISEASE_ICON[k]}</Text>
                          <Text style={[styles.correctChipText, correctClass === k && styles.correctChipTextActive]}>
                            {v.replace(/\(.*\)/, "").trim()}
                          </Text>
                          {submittingFb && correctClass === k && (
                            <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 4 }} />
                          )}
                        </TouchableOpacity>
                      ))}
                  </View>
                  <TouchableOpacity onPress={() => setShowCorrect(false)} style={styles.correctCancelBtn}>
                    <Text style={styles.correctCancelText}>Huỷ</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.correctRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.correctRowTitle}>Nhận diện chưa đúng?</Text>
                    <Text style={styles.correctRowSub}>Đính chính giúp model học thông minh hơn</Text>
                  </View>
                  <TouchableOpacity style={styles.correctBtn} onPress={() => setShowCorrect(true)}>
                    <Text style={styles.correctBtnText}>✏️ Sai rồi</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ── Disease detail card ── */}
          {!isHealthy && (disease?.description_vi || disease?.symptoms_vi || disease?.cause_vi || disease?.season_vi) && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardHeaderIcon}>📋</Text>
                <Text style={styles.cardTitle}>Thông tin bệnh</Text>
              </View>

              {disease?.description_vi && (
                <View style={styles.diseaseSection}>
                  <Text style={styles.diseaseSectionLabel}>📌 Mô tả</Text>
                  <Text style={styles.diseaseSectionText}>{disease.description_vi}</Text>
                </View>
              )}

              {disease?.symptoms_vi && (
                <View style={styles.diseaseSection}>
                  <Text style={styles.diseaseSectionLabel}>🔍 Biểu hiện</Text>
                  <Text style={styles.diseaseSectionText}>{disease.symptoms_vi}</Text>
                </View>
              )}

              {disease?.cause_vi && (
                <View style={styles.diseaseSection}>
                  <Text style={styles.diseaseSectionLabel}>🔬 Nguyên nhân</Text>
                  <Text style={styles.diseaseSectionText}>{disease.cause_vi}</Text>
                </View>
              )}

              {disease?.season_vi && (
                <View style={[styles.diseaseSection, styles.diseaseSectionLast]}>
                  <Text style={styles.diseaseSectionLabel}>📅 Thời điểm phát sinh</Text>
                  <Text style={styles.diseaseSectionText}>{disease.season_vi}</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Status alert ── */}
          <View style={[styles.alertBox, { backgroundColor: isHealthy ? "#e8f5e9" : "#fff8e1", borderColor: isHealthy ? "#81c784" : "#ffca28" }]}>
            <Text style={styles.alertIcon}>{isHealthy ? "✅" : "⚠️"}</Text>
            <Text style={[styles.alertText, { color: isHealthy ? "#2e7d32" : "#e65100" }]}>
              {isHealthy
                ? "Lá cây khỏe mạnh — không phát hiện bệnh."
                : "Phát hiện dấu hiệu bệnh — xem hướng xử lý bên dưới."}
            </Text>
          </View>

          {/* ── Actions ── */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary]}
              onPress={() => {
                AsyncStorage.setItem("treatment_disease", cls);
                router.push("/(tabs)/treatment");
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.actionIcon}>💊</Text>
              <View>
                <Text style={styles.actionPrimaryTitle}>Hướng xử lý</Text>
                <Text style={styles.actionPrimarySub}>Treatment guide</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionSecondary]}
              onPress={() => router.push("/(tabs)/history")}
              activeOpacity={0.85}
            >
              <Text style={styles.actionIcon}>📋</Text>
              <View>
                <Text style={styles.actionSecondaryTitle}>Lịch sử</Text>
                <Text style={styles.actionSecondarySub}>History</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Rating ── */}
          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>Đánh giá kết quả</Text>
            <Text style={styles.ratingSubtitle}>Phản hồi của bạn giúp cải thiện mô hình AI</Text>
            <View style={styles.starsRow}>
              {[1,2,3,4,5].map(r => (
                <TouchableOpacity key={r} onPress={() => submitFeedback(r)} style={styles.starBtn}>
                  <Text style={[styles.star, rating >= r && styles.starActive]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <Text style={styles.ratingThanks}>
                {rating >= 4 ? "🎉 Tuyệt vời, cảm ơn bạn!" : rating >= 2 ? "🙏 Cảm ơn phản hồi!" : "📝 Cảm ơn, chúng tôi sẽ cải thiện."}
              </Text>
            )}
          </View>

          <View style={{ height: 32 }} />
        </Animated.View>
      </ScrollView>
    </View>
    </AuthGuard>
  );
}

function MetaChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaChipIcon}>{icon}</Text>
      <Text style={styles.metaChipValue}>{value}</Text>
      <Text style={styles.metaChipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: "#f0f4f0" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#f0f4f0" },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: IS_WEB ? 32 : 12,
    paddingTop: 10,
    paddingBottom: 8,
    maxWidth:   IS_WEB ? 860 : undefined,
    alignSelf:  IS_WEB ? "center" : undefined,
    width:      IS_WEB ? "100%" : undefined,
  },

  // Empty state
  emptyTitle:   { fontSize: 20, fontWeight: "800", color: Colors.primary, marginBottom: 6 },
  emptyText:    { fontSize: 14, color: Colors.textMuted, marginBottom: 24, textAlign: "center" },
  emptyBtn:     {
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10,
    elevation: 8,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Nav bar (compact, replaces full-height hero)
  navBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingTop:  Platform.OS === "ios" ? 52 : Platform.OS === "android" ? 32 : 12,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  backBtn: {
    backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 20,
    paddingVertical: 7, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.35)",
  },
  backBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  navTag: {
    backgroundColor: Colors.accent, borderRadius: 12,
    paddingVertical: 5, paddingHorizontal: 12,
  },
  navTagText: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 1.2 },

  // Inline image card
  imgCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 10,
    backgroundColor: "#c8e6c9",
    height: IS_WEB ? 300 : 210,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 6,
  },
  imgPreview: {
    width: "100%",
    height: "100%",
  },
  imgPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  imgIconBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },

  // Main card — no large marginTop needed anymore
  mainCard: {
    backgroundColor: "#fff", borderRadius: 20, padding: 18,
    marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1, shadowRadius: 14, elevation: 8,
  },
  classChip: {
    alignSelf: "flex-start", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5, marginBottom: 8,
  },
  classChipText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  diseaseName:   { fontSize: 22, fontWeight: "900", marginBottom: 3, lineHeight: 28 },
  sciName:       { fontSize: 12, color: Colors.textMuted, fontStyle: "italic", marginBottom: 12 },

  // Confidence meter
  meterWrap:   { marginTop: 4 },
  meterHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  meterLabel:  { fontSize: 12, color: Colors.textMuted, fontWeight: "600" },
  meterValue:  { fontSize: 20, fontWeight: "900" },
  meterTrack: {
    height: 10, backgroundColor: "#e8ece8", borderRadius: 5,
    overflow: "visible", position: "relative",
  },
  meterFill: { height: 10, borderRadius: 5, position: "absolute", top: 0, left: 0 },
  meterGlow: {
    position: "absolute", top: -3, width: 16, height: 16,
    borderRadius: 8, opacity: 0.6, marginLeft: -8,
  },
  meterTicks: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  meterTick:  { fontSize: 9, color: "#aaa" },

  // Meta chips
  metaRow:  { flexDirection: "row", gap: 8, marginBottom: 10 },
  metaChip: {
    flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 10, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 4,
  },
  metaChipIcon:  { fontSize: 16, marginBottom: 3 },
  metaChipValue: { fontSize: 12, fontWeight: "800", color: Colors.text, marginBottom: 1 },
  metaChipLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: "600", letterSpacing: 0.5 },

  // Cards
  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 5,
  },
  cardHeader:     { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  cardHeaderIcon: { fontSize: 18, marginRight: 8 },
  cardTitle:      { fontSize: 15, fontWeight: "800", color: Colors.primary },

  // Top-3
  top3Item: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  top3ItemFirst: { paddingVertical: 10 },
  rankBubble: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#e0e0e0", justifyContent: "center", alignItems: "center",
  },
  rankText:    { fontSize: 12, fontWeight: "800", color: "#fff" },
  top3NameRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  top3Name:    { fontSize: 13, color: Colors.text, flex: 1 },
  top3Pct:     { fontSize: 13, fontWeight: "800" },
  top3Track:   { height: 4, backgroundColor: "#f0f0f0", borderRadius: 2, overflow: "hidden" },
  top3Fill:    { height: 4, borderRadius: 2 },

  // Disease detail sections
  diseaseSection: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f4f0",
  },
  diseaseSectionLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  diseaseSectionLabel: {
    fontSize: 12, fontWeight: "800", color: Colors.primary,
    marginBottom: 5, letterSpacing: 0.3,
  },
  diseaseSectionText: { fontSize: 13, color: Colors.text, lineHeight: 21 },

  // Cause (legacy — kept for safety)
  causeText: { fontSize: 13, color: Colors.text, lineHeight: 21 },

  // OOD warning
  oodBox: {
    flexDirection: "row", gap: 12,
    backgroundColor: "#fff3e0",
    borderRadius: 16, borderWidth: 1.5, borderColor: "#ff9800",
    padding: 14, marginBottom: 10,
  },
  oodIcon:  { fontSize: 26, marginTop: 2 },
  oodTitle: { fontSize: 14, fontWeight: "800", color: "#e65100", marginBottom: 5 },
  oodDesc:  { fontSize: 12, color: "#bf360c", lineHeight: 18, marginBottom: 10 },
  oodRetakeBtn: {
    backgroundColor: "#e65100", borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 14, alignSelf: "flex-start",
  },
  oodRetakeBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  // Alert box
  alertBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 10,
  },
  alertIcon: { fontSize: 20 },
  alertText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 19 },

  // Actions
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 16, padding: 14,
    shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
  actionPrimary:      { backgroundColor: Colors.primary, shadowColor: Colors.primary },
  actionPrimaryTitle: { color: "#fff", fontWeight: "800", fontSize: 14 },
  actionPrimarySub:   { color: "rgba(255,255,255,0.7)", fontSize: 10, marginTop: 1 },
  actionSecondary:    { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.12, borderWidth: 1.5, borderColor: Colors.accent },
  actionSecondaryTitle: { color: Colors.primary, fontWeight: "800", fontSize: 14 },
  actionSecondarySub:   { color: Colors.textMuted, fontSize: 10, marginTop: 1 },
  actionIcon: { fontSize: 22 },

  // Rating
  ratingCard: {
    backgroundColor: "#fff", borderRadius: 20, padding: 18, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 5,
  },
  ratingTitle:    { fontSize: 15, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  ratingSubtitle: { fontSize: 12, color: Colors.textMuted, marginBottom: 12, textAlign: "center" },
  starsRow:       { flexDirection: "row", gap: 6 },
  starBtn:        { padding: 4 },
  star:           { fontSize: 32, color: "#d0d0d0" },
  starActive:     { color: "#f5a623" },
  ratingThanks:   { marginTop: 10, fontSize: 13, color: Colors.textMuted },

  // Top-2 confusion warning
  confusionBox: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    backgroundColor: "#fff8e1", borderRadius: 14, borderWidth: 1.5,
    borderColor: "#ffca28", padding: 12, marginBottom: 10,
  },
  confusionIcon:  { fontSize: 20, marginTop: 1 },
  confusionTitle: { fontSize: 13, fontWeight: "800", color: "#e65100", marginBottom: 3 },
  confusionDesc:  { fontSize: 12, color: "#bf360c", lineHeight: 18 },

  // Correction card
  correctCard: {
    backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 10,
    borderWidth: 1.5, borderColor: "#e8f5e9",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 4,
  },
  correctRow:       { flexDirection: "row", alignItems: "center", gap: 12 },
  correctRowTitle:  { fontSize: 14, fontWeight: "800", color: Colors.text, marginBottom: 2 },
  correctRowSub:    { fontSize: 11, color: Colors.textMuted, lineHeight: 16 },
  correctBtn: {
    backgroundColor: "#fff3e0", borderRadius: 12, paddingVertical: 10,
    paddingHorizontal: 16, borderWidth: 1.5, borderColor: "#ff9800",
  },
  correctBtnText:  { color: "#e65100", fontWeight: "800", fontSize: 13 },
  correctTitle:    { fontSize: 13, fontWeight: "800", color: Colors.text, marginBottom: 10 },
  correctGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  correctChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.bg,
  },
  correctChipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  correctChipIcon:       { fontSize: 14 },
  correctChipText:       { fontSize: 12, color: Colors.textMuted, fontWeight: "600" },
  correctChipTextActive: { color: "#fff" },
  correctCancelBtn: { alignSelf: "flex-start", paddingVertical: 4, paddingHorizontal: 8 },
  correctCancelText: { fontSize: 12, color: Colors.textMuted },
  correctDone: { flexDirection: "row", alignItems: "center", gap: 12 },
  correctDoneIcon:  { fontSize: 28 },
  correctDoneTitle: { fontSize: 14, fontWeight: "800", color: "#2e7d32", marginBottom: 3 },
  correctDoneDesc:  { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
});
