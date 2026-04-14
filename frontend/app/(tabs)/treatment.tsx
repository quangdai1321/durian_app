import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, TextInput, KeyboardAvoidingView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { diseaseApi, chatApi } from "../../services/api";
import { Colors } from "../../constants/Colors";

/** Render markdown đơn giản: **bold**, *italic*, `code`, list */
function MarkdownText({ text, style }: { text: string; style?: any }) {
  const lines = text.split("\n");
  return (
    <View style={{ flex: 1 }}>
      {lines.map((line, li) => {
        const isList = /^(\d+\.\s+|-\s+|\*\s+)/.test(line.trim());
        const cleanLine = isList ? line.replace(/^(\d+\.\s+|-\s+|\*\s+)/, "") : line;
        const prefix = isList ? line.match(/^(\d+\.\s+|-\s+|\*\s+)/)?.[0] ?? "" : "";
        const parts: { text: string; bold?: boolean; italic?: boolean; code?: boolean }[] = [];
        let remaining = cleanLine;
        const inlineRe = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
        let lastIdx = 0, match: RegExpExecArray | null;
        while ((match = inlineRe.exec(remaining)) !== null) {
          if (match.index > lastIdx) parts.push({ text: remaining.slice(lastIdx, match.index) });
          if (match[2]) parts.push({ text: match[2], bold: true });
          else if (match[3]) parts.push({ text: match[3], italic: true });
          else if (match[4]) parts.push({ text: match[4], code: true });
          lastIdx = match.index + match[0].length;
        }
        if (lastIdx < remaining.length) parts.push({ text: remaining.slice(lastIdx) });
        return (
          <Text key={li} style={[style, { marginBottom: line === "" ? 4 : 1 }]}>
            {isList && <Text style={[style, { fontWeight: "700" }]}>{prefix}</Text>}
            {parts.map((p, pi) => (
              <Text key={pi} style={[
                style,
                p.bold && { fontWeight: "700" },
                p.italic && { fontStyle: "italic" },
                p.code && { fontFamily: "monospace", backgroundColor: "#f0f0f0", borderRadius: 3, fontSize: 11 },
              ]}>{p.text}</Text>
            ))}
          </Text>
        );
      })}
    </View>
  );
}

const SEVERITY_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  low:      { text: "Thấp · Low",                  color: "#2e7d32", bg: "#e8f5e9" },
  moderate: { text: "Trung bình · Moderate",        color: "#f57c00", bg: "#fff3e0" },
  high:     { text: "Cao · High",                   color: "#c62828", bg: "#ffebee" },
  critical: { text: "Nghiêm trọng · Critical",      color: "#880e4f", bg: "#fce4ec" },
};

type ChatMsg = { role: "user" | "assistant"; text: string };

const WELCOME_MSG = (diseaseName?: string): ChatMsg => ({
  role: "assistant",
  text: diseaseName
    ? `Xin chào! Tôi là trợ lý AI nông nghiệp. Hỏi tôi về bệnh **${diseaseName}** hoặc bất kỳ câu hỏi nào về cây sầu riêng nhé!`
    : "Xin chào! Tôi là trợ lý AI nông nghiệp. Hỏi tôi về bệnh cây sầu riêng nhé!",
});

export default function TreatmentScreen() {
  const router = useRouter();
  const [disease,  setDisease]  = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [allList,  setAllList]  = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");

  const [messages,    setMessages]    = useState<ChatMsg[]>([WELCOME_MSG()]);
  const [chatInput,   setChatInput]   = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const all: any[] = await diseaseApi.list() as any[];
        setAllList(all.filter(d => d.code !== "Leaf_Healthy"));
        const code = await AsyncStorage.getItem("treatment_disease") || "Leaf_Algal";
        setSelected(code);
        const d = all.find(x => x.code === code);
        setDisease(d || all[0]);
      } catch {}
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    setMessages([WELCOME_MSG(disease?.name_vi)]);
  }, [disease?.code]);

  const selectDisease = (code: string) => {
    setSelected(code);
    const d = allList.find(x => x.code === code);
    if (d) setDisease(d);
  };

  const askAI = async () => {
    const q = chatInput.trim();
    if (!q || chatLoading) return;
    setChatInput("");

    const userMsg: ChatMsg = { role: "user", text: q };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setChatLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const systemPrompt = disease
        ? `Bạn là chuyên gia nông nghiệp về cây sầu riêng, chuyên về bệnh ${disease.name_vi} (${disease.name_en}).
Nguyên nhân: ${disease.cause_vi || ""}. Mức độ: ${disease.severity || ""}.
Trả lời ngắn gọn, thực tế bằng tiếng Việt. Nếu không liên quan đến nông nghiệp sầu riêng, hướng dẫn lại nhẹ nhàng.`
        : `Bạn là chuyên gia nông nghiệp về cây sầu riêng. Trả lời ngắn gọn, thực tế bằng tiếng Việt.`;

      const data = await chatApi.chat(
        [
          { role: "system", content: systemPrompt },
          ...nextMessages.map(m => ({ role: m.role, content: m.text })),
        ],
        { max_tokens: 512, temperature: 0.7 }
      );
      const reply = data.choices?.[0]?.message?.content?.trim() || "Xin lỗi, không nhận được phản hồi.";
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", text: `⚠️ Lỗi: ${e?.message || "Không kết nối được AI."}` }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const sev = disease?.severity ? SEVERITY_LABEL[disease.severity] : SEVERITY_LABEL.moderate;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💊 Hướng xử lý bệnh</Text>
        <Text style={styles.headerSub}>Treatment Guide</Text>
      </View>

      {/* Disease selector chips */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.chipScroll} contentContainerStyle={styles.chipRow}
      >
        {allList.map(d => {
          const isActive = selected === d.code;
          const badge = Colors.diseaseBadge[d.code as keyof typeof Colors.diseaseBadge]
                     ?? { bg: "#eee", text: "#555" };
          return (
            <TouchableOpacity
              key={d.code}
              style={[styles.chip, isActive && { backgroundColor: badge.text }]}
              onPress={() => selectDisease(d.code)}
            >
              <Text style={[styles.chipText, isActive && { color: "#fff" }]}>{d.name_vi}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Main scroll — disease info + chat */}
      <ScrollView
        ref={scrollRef}
        style={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Disease content (only if loaded) */}
        {disease && (
          <>
            {/* Hero card */}
            <View style={styles.heroCard}>
              <View style={styles.heroLeft}>
                <Text style={styles.diseaseName}>{disease.name_vi}</Text>
                <Text style={styles.diseaseName2}>{disease.name_en}</Text>
                {disease.scientific && <Text style={styles.sciName}>{disease.scientific}</Text>}
              </View>
              <View style={[styles.sevBadge, { backgroundColor: sev.bg }]}>
                <Text style={[styles.sevText, { color: sev.color }]}>⚡ {sev.text}</Text>
              </View>
            </View>

            {/* Cause */}
            {disease.cause_vi && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📌 Nguyên nhân · Cause</Text>
                <View style={styles.causeBox}>
                  <Text style={styles.causeVI}>{disease.cause_vi}</Text>
                  {disease.cause_en && <Text style={styles.causeEN}>{disease.cause_en}</Text>}
                </View>
              </View>
            )}

            {/* Treatment steps */}
            {disease.steps?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🔧 Các bước xử lý · Treatment Steps</Text>
                {disease.steps.map((step: any, i: number) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{step.step_order}</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepVI}>{step.step_vi}</Text>
                      <Text style={styles.stepEN}>{step.step_en}</Text>
                      {step.chemical && (
                        <View style={styles.chemTag}>
                          <Text style={styles.chemText}>💊 {step.chemical}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Warning */}
            <View style={styles.warnBox}>
              <Text style={styles.warnTitle}>⚠️ Lưu ý quan trọng</Text>
              <Text style={styles.warnText}>
                Tham khảo ý kiến kỹ sư nông nghiệp trước khi sử dụng thuốc bảo vệ thực vật.
                Tuân thủ đúng liều lượng và thời gian cách ly.
              </Text>
              <Text style={styles.warnTextEN}>
                Consult an agronomist before applying pesticides. Follow recommended dosage and pre-harvest intervals.
              </Text>
            </View>
          </>
        )}

        {/* ── AI Chat Box — always shown ── */}
        <View style={styles.chatCard}>
          <View style={styles.chatHeader}>
            <View style={styles.chatHeaderLeft}>
              <View style={styles.aiDot} />
              <Text style={styles.chatTitle}>Hỏi đáp AI Nông nghiệp</Text>
            </View>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>GPT-4o mini</Text>
            </View>
          </View>
          <Text style={styles.chatSubtitle}>
            Hỏi về bệnh, cách xử lý, phân bón, kỹ thuật canh tác sầu riêng
          </Text>

          {/* Messages */}
          <View style={styles.chatMsgs}>
            {messages.map((m, i) => (
              <View key={i} style={[styles.msgBubble, m.role === "user" ? styles.msgUser : styles.msgAI]}>
                {m.role === "assistant" && <Text style={styles.msgAILabel}>🤖 AI</Text>}
                {m.role === "assistant" ? (
                  <MarkdownText text={m.text} style={[styles.msgText, styles.msgTextAI]} />
                ) : (
                  <Text style={[styles.msgText, styles.msgTextUser]}>{m.text}</Text>
                )}
              </View>
            ))}
            {chatLoading && (
              <View style={[styles.msgBubble, styles.msgAI]}>
                <Text style={styles.msgAILabel}>🤖 AI</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>Đang trả lời...</Text>
                </View>
              </View>
            )}
          </View>

          {/* Input row */}
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Hỏi về bệnh này..."
              placeholderTextColor="#aaa"
              multiline
              maxLength={400}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={askAI}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!chatInput.trim() || chatLoading) && styles.sendBtnDisabled]}
              onPress={askAI}
              disabled={!chatInput.trim() || chatLoading}
            >
              <Text style={styles.sendBtnText}>↑</Text>
            </TouchableOpacity>
          </View>

          {/* Quick questions */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll}>
            {["Cách phòng bệnh?","Thuốc nào hiệu quả?","Khi nào phun thuốc?","Bệnh có lây không?","Liều lượng phun?"].map(q => (
              <TouchableOpacity key={q} style={styles.quickBtn} onPress={() => setChatInput(q)}>
                <Text style={styles.quickBtnText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Scan button */}
        <TouchableOpacity style={styles.scanBtn} onPress={() => router.push("/(tabs)/camera")}>
          <Text style={styles.scanBtnText}>📷 Chẩn đoán lá mới · New Scan</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === "ios" ? 54 : 32,
    paddingBottom: 14, paddingHorizontal: 20,
  },
  headerTitle:  { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerSub:    { color: "rgba(255,255,255,.7)", fontSize: 12, marginTop: 3 },
  chipScroll:   { maxHeight: 54, backgroundColor: Colors.bg },
  chipRow:      { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center" },
  chip:         { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: "#e0e0e0" },
  chipText:     { fontSize: 12, fontWeight: "600", color: Colors.text },
  body:         { flex: 1, padding: 16 },
  heroCard: {
    backgroundColor: Colors.primaryLt, borderRadius: 14,
    padding: 16, marginBottom: 16,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
  },
  heroLeft:    { flex: 1, marginRight: 10 },
  diseaseName: { fontSize: 20, fontWeight: "800", color: Colors.primary },
  diseaseName2:{ fontSize: 14, color: Colors.secondary, marginTop: 2 },
  sciName:     { fontSize: 13, color: Colors.accent, fontStyle: "italic", marginTop: 4 },
  sevBadge:    { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  sevText:     { fontSize: 11, fontWeight: "700" },
  section:     { marginBottom: 18 },
  sectionTitle:{ fontSize: 15, fontWeight: "700", color: Colors.primary, marginBottom: 10 },
  causeBox:    { backgroundColor: Colors.bg, borderRadius: 10, padding: 14, borderLeftWidth: 3, borderLeftColor: Colors.accent },
  causeVI:     { fontSize: 14, color: Colors.text, lineHeight: 22, marginBottom: 8 },
  causeEN:     { fontSize: 12, color: Colors.textMuted, lineHeight: 20, fontStyle: "italic" },
  stepRow:     { flexDirection: "row", gap: 12, marginBottom: 14, alignItems: "flex-start" },
  stepNum: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center",
  },
  stepNumText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  stepContent: { flex: 1 },
  stepVI:      { fontSize: 14, color: Colors.text, lineHeight: 21, fontWeight: "600" },
  stepEN:      { fontSize: 12, color: Colors.textMuted, lineHeight: 19, marginTop: 2 },
  chemTag:     { backgroundColor: "#e3f2fd", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginTop: 6 },
  chemText:    { fontSize: 11, color: "#1565c0", fontWeight: "600" },
  warnBox:     { backgroundColor: "#fff8e1", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#ffe082" },
  warnTitle:   { fontSize: 14, fontWeight: "700", color: "#e65100", marginBottom: 8 },
  warnText:    { fontSize: 13, color: "#bf360c", lineHeight: 20, marginBottom: 6 },
  warnTextEN:  { fontSize: 12, color: "#e65100", lineHeight: 19, fontStyle: "italic" },

  // Chat card
  chatCard: {
    backgroundColor: "#fff", borderRadius: 18,
    borderWidth: 1.5, borderColor: "#e0ede0",
    marginBottom: 16, overflow: "hidden",
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1, shadowRadius: 14, elevation: 6,
  },
  chatHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 12,
  },
  chatHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiDot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: "#a5d6a7" },
  chatTitle:      { color: "#fff", fontWeight: "700", fontSize: 14 },
  aiBadge:        { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  aiBadgeText:    { color: "#fff", fontSize: 10, fontWeight: "600" },
  chatSubtitle:   { fontSize: 12, color: Colors.textMuted, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  chatMsgs:       { padding: 12 },
  msgBubble:      { borderRadius: 14, padding: 12, marginBottom: 8, maxWidth: "90%" },
  msgUser:        { alignSelf: "flex-end", backgroundColor: Colors.primary },
  msgAI:          { alignSelf: "flex-start", backgroundColor: "#f5f8f5", borderWidth: 1, borderColor: "#e0e8e0" },
  msgAILabel:     { fontSize: 10, color: Colors.textMuted, fontWeight: "600", marginBottom: 4 },
  msgText:        { fontSize: 13, lineHeight: 20 },
  msgTextUser:    { color: "#fff" },
  msgTextAI:      { color: Colors.text },
  chatInputRow: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: "#f0f0f0",
  },
  chatInput: {
    flex: 1, backgroundColor: "#f5f8f5", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 10 : 8,
    fontSize: 13, color: Colors.text, maxHeight: 100,
    borderWidth: 1, borderColor: "#e0e8e0",
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary,
    justifyContent: "center", alignItems: "center",
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 6, elevation: 5,
  },
  sendBtnDisabled: { backgroundColor: "#ccc", shadowOpacity: 0 },
  sendBtnText:     { color: "#fff", fontSize: 18, fontWeight: "700", lineHeight: 22 },
  quickScroll:     { paddingHorizontal: 12, paddingBottom: 12 },
  quickBtn: {
    backgroundColor: Colors.primaryLt, borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginTop: 4,
    borderWidth: 1, borderColor: "#c8e6c9",
  },
  quickBtnText: { fontSize: 12, color: Colors.primary, fontWeight: "600" },
  scanBtn:      { backgroundColor: Colors.primary, borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 8 },
  scanBtnText:  { color: "#fff", fontSize: 16, fontWeight: "700" },
});
