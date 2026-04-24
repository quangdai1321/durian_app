import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Animated, ActivityIndicator, Platform,
  KeyboardAvoidingView, Dimensions,
} from "react-native";
import { Colors } from "../constants/Colors";
import { chatApi } from "../services/api";

/** Chuyển lỗi API thành chuỗi tiếng Việt thân thiện */
function friendlyError(e: any): string {
  const status = e?.status;
  const msg    = (e?.message || "").toLowerCase();

  if (status === 401 || msg.includes("invalid or expired") || msg.includes("not authenticated"))
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.";
  if (status === 403)
    return "Bạn không có quyền sử dụng tính năng này.";
  if (status === 503 || msg.includes("chưa được cấu hình"))
    return "Dịch vụ AI đang bảo trì. Vui lòng thử lại sau.";
  if (status === 429 || msg.includes("rate limit") || msg.includes("quota"))
    return "Quá nhiều yêu cầu. Hãy đợi vài giây rồi thử lại.";
  if (status >= 500)
    return "Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút.";
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch"))
    return "Không có kết nối mạng. Kiểm tra WiFi / dữ liệu di động rồi thử lại.";

  return "Không kết nối được AI. Vui lòng thử lại.";
}

const SYSTEM_PROMPT = `Bạn là chuyên gia nông nghiệp sầu riêng AI. Trả lời ngắn gọn, thực tế bằng tiếng Việt.
Chuyên về: bệnh cây sầu riêng, kỹ thuật canh tác, phân bón, phòng trừ sâu bệnh, thu hoạch.
Nếu không liên quan đến nông nghiệp sầu riêng, nhẹ nhàng hướng về chủ đề này.`;

type Msg = { role: "user" | "assistant"; text: string };

/** Render text với markdown đơn giản: **bold**, *italic*, `code`, numbered list */
function MarkdownText({ text, style }: { text: string; style?: any }) {
  // Tách theo dòng trước
  const lines = text.split("\n");
  return (
    <View style={{ flex: 1 }}>
      {lines.map((line, li) => {
        // Numbered list: "1. item" hoặc "- item"
        const isList = /^(\d+\.\s+|-\s+|\*\s+)/.test(line.trim());
        const cleanLine = isList ? line.replace(/^(\d+\.\s+|-\s+|\*\s+)/, "") : line;
        const prefix = isList ? line.match(/^(\d+\.\s+|-\s+|\*\s+)/)?.[0] ?? "" : "";

        // Parse inline: **bold**, *italic*, `code`
        const parts: { text: string; bold?: boolean; italic?: boolean; code?: boolean }[] = [];
        let remaining = cleanLine;
        const inlineRe = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
        let lastIdx = 0;
        let match;
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
                p.bold   && { fontWeight: "700" },
                p.italic && { fontStyle: "italic" },
                p.code   && { fontFamily: "monospace", backgroundColor: "#f0f0f0", borderRadius: 3, paddingHorizontal: 3, fontSize: 11 },
              ]}>{p.text}</Text>
            ))}
          </Text>
        );
      })}
    </View>
  );
}

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get("window");
const PANEL_H = Math.min(480, SCREEN_H * 0.65);
const PANEL_W = Math.min(360, SCREEN_W - 32);

export default function FloatingChat() {
  const [open,    setOpen]    = useState(false);
  const [msgs,    setMsgs]    = useState<Msg[]>([
    { role: "assistant", text: "Xin chào! 🌿 Tôi là trợ lý AI nông nghiệp sầu riêng. Hỏi tôi bất cứ điều gì về cây sầu riêng nhé!" },
  ]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [unread,  setUnread]  = useState(0);

  const panelAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const btnPulse  = useRef(new Animated.Value(1)).current;

  // Pulse animation for unread indicator
  useEffect(() => {
    if (unread > 0 && !open) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(btnPulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(btnPulse, { toValue: 1,    duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      btnPulse.stopAnimation();
      Animated.timing(btnPulse, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
  }, [unread, open]);

  const togglePanel = () => {
    const toValue = open ? 0 : 1;
    setOpen(!open);
    if (!open) setUnread(0);
    Animated.spring(panelAnim, {
      toValue, useNativeDriver: true,
      tension: 100, friction: 12,
    }).start();
    if (!open) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 200);
  };

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");

    const userMsg: Msg = { role: "user", text: q };
    const next = [...msgs, userMsg];
    setMsgs(next);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      const data = await chatApi.chat(
        [
          { role: "system", content: SYSTEM_PROMPT },
          ...next.map(m => ({ role: m.role, content: m.text })),
        ],
        { max_tokens: 400, temperature: 0.7 }
      );
      const reply = data.choices?.[0]?.message?.content?.trim() || "Xin lỗi, thử lại sau.";
      setMsgs(prev => [...prev, { role: "assistant", text: reply }]);
      if (!open) setUnread(u => u + 1);
    } catch (e: any) {
      setMsgs(prev => [...prev, { role: "assistant", text: `⚠️ ${friendlyError(e)}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const panelTranslateY = panelAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [PANEL_H + 20, 0],
  });
  const panelOpacity = panelAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Chat panel */}
      <Animated.View
        style={[
          styles.panel,
          { height: PANEL_H, width: PANEL_W },
          { transform: [{ translateY: panelTranslateY }], opacity: panelOpacity },
        ]}
        pointerEvents={open ? "auto" : "none"}
      >
        {/* Panel header */}
        <View style={styles.panelHeader}>
          <View style={styles.panelHeaderLeft}>
            <View style={styles.onlineDot} />
            <View>
              <Text style={styles.panelTitle}>AI Nông nghiệp</Text>
              <Text style={styles.panelSub}>GPT-4o mini · Trực tuyến</Text>
            </View>
          </View>
          <TouchableOpacity onPress={togglePanel} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.msgList}
          contentContainerStyle={styles.msgListContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {msgs.map((m, i) => (
            <View key={i} style={[styles.bubble, m.role === "user" ? styles.bubbleUser : styles.bubbleAI]}>
              {m.role === "assistant" && <Text style={styles.aiLabel}>🤖</Text>}
              {m.role === "assistant" ? (
                <MarkdownText
                  text={m.text}
                  style={[styles.bubbleText, styles.bubbleTextAI]}
                />
              ) : (
                <Text style={[styles.bubbleText, styles.bubbleTextUser]}>{m.text}</Text>
              )}
            </View>
          ))}
          {loading && (
            <View style={[styles.bubble, styles.bubbleAI]}>
              <Text style={styles.aiLabel}>🤖</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>Đang trả lời...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick questions */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickRow}
          keyboardShouldPersistTaps="handled"
        >
          {["Bệnh đốm tảo?","Cách phòng cháy lá?","Thời điểm bón phân?","Lịch phun thuốc?","Thu hoạch khi nào?"].map(q => (
            <TouchableOpacity key={q} style={styles.quickChip} onPress={() => setInput(q)}>
              <Text style={styles.quickChipText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.inputWrap}
        >
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Hỏi về sầu riêng..."
            placeholderTextColor="#aaa"
            multiline
            maxLength={300}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={send}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnOff]}
            onPress={send}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Animated.View>

      {/* Floating button */}
      <Animated.View style={{ transform: [{ scale: btnPulse }] }}>
        <TouchableOpacity
          style={[styles.fab, open && styles.fabOpen]}
          onPress={togglePanel}
          activeOpacity={0.85}
        >
          <Text style={styles.fabIcon}>{open ? "✕" : "🤖"}</Text>
          {unread > 0 && !open && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    bottom: 70, // above tab bar
    right: 16,
    zIndex: 9999,
    alignItems: "flex-end",
  },

  // Panel
  panel: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 20,
    borderWidth: 1,
    borderColor: "#e8ede8",
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  panelHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  onlineDot: {
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: "#69f0ae",
    shadowColor: "#69f0ae", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 4,
  },
  panelTitle:   { color: "#fff", fontWeight: "700", fontSize: 14 },
  panelSub:     { color: "rgba(255,255,255,0.65)", fontSize: 10, marginTop: 1 },
  closeBtn:     { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center" },
  closeBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  msgList:        { flex: 1 },
  msgListContent: { padding: 12, gap: 6 },

  bubble: { borderRadius: 14, padding: 10, marginBottom: 4, maxWidth: "85%" },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: Colors.primary },
  bubbleAI:   { alignSelf: "flex-start", backgroundColor: "#f5f8f5", borderWidth: 1, borderColor: "#e4ece4", flexDirection: "row", gap: 6, alignItems: "flex-start" },
  aiLabel:    { fontSize: 14 },
  bubbleText:     { fontSize: 13, lineHeight: 19 },
  bubbleTextUser: { color: "#fff" },
  bubbleTextAI:   { color: Colors.text, flex: 1 },

  quickRow:      { maxHeight: 38, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: "#f0f0f0" },
  quickChip: {
    backgroundColor: Colors.primaryLt,
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5,
    marginRight: 6, marginVertical: 5,
    borderWidth: 1, borderColor: "#c8e6c9",
  },
  quickChipText: { fontSize: 11, color: Colors.primary, fontWeight: "600" },

  inputWrap: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: "#f0f0f0",
  },
  textInput: {
    flex: 1, backgroundColor: "#f5f8f5",
    borderRadius: 18, paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 9 : 7,
    fontSize: 13, color: Colors.text, maxHeight: 80,
    borderWidth: 1, borderColor: "#dde8dd",
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: "center", alignItems: "center",
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 6, elevation: 4,
  },
  sendBtnOff: { backgroundColor: "#ccc", shadowOpacity: 0 },
  sendIcon:   { color: "#fff", fontSize: 17, fontWeight: "700", lineHeight: 20 },

  // FAB
  fab: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: Colors.primary,
    justifyContent: "center", alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 12,
    elevation: 12,
  },
  fabOpen:  { backgroundColor: "#e53935" },
  fabIcon:  { fontSize: 24 },
  badge: {
    position: "absolute", top: -2, right: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#f44336",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: "#fff",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
