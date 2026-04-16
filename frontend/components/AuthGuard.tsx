import React, { useState, ReactNode } from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { Colors } from "../constants/Colors";

/**
 * Bọc màn hình cần đăng nhập.
 * Mỗi lần tab được focus → kiểm tra lại token.
 * Nếu chưa đăng nhập → hiển thị màn hình yêu cầu đăng nhập.
 */
export default function AuthGuard({ children }: { children: ReactNode }) {
  const router   = useRouter();
  const [status, setStatus] = useState<"checking" | "authed" | "guest">("checking");

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      AsyncStorage.getItem("access_token").then(token => {
        if (active) setStatus(token ? "authed" : "guest");
      });
      return () => { active = false; };
    }, [])
  );

  if (status === "checking") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (status === "guest") {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.lockIcon}>🔐</Text>
          <Text style={styles.title}>Cần đăng nhập</Text>
          <Text style={styles.titleEN}>Login Required</Text>
          <Text style={styles.sub}>
            Vui lòng đăng nhập để sử dụng tính năng này.{"\n"}
            Please sign in to access this feature.
          </Text>

          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.loginBtnText}>🔑 Đăng nhập · Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.regBtn}
            onPress={() => router.push("/register")}
          >
            <Text style={styles.regBtnText}>
              Chưa có tài khoản?{" "}
              <Text style={{ color: Colors.primary, fontWeight: "700" }}>Đăng ký ngay</Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.freeNote}>
            <Text style={styles.freeNoteText}>
              💡 Tính năng{" "}
              <Text style={{ fontWeight: "700" }}>Chụp ảnh & Chẩn đoán</Text>
              {" "}có thể dùng không cần đăng nhập
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Đã đăng nhập — render nội dung bình thường
  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  lockIcon:  { fontSize: 56, marginBottom: 16 },
  title:     { fontSize: 22, fontWeight: "800", color: Colors.text, marginBottom: 4 },
  titleEN:   { fontSize: 14, color: Colors.textMuted, marginBottom: 16 },
  sub: {
    fontSize: 13, color: Colors.textMuted, textAlign: "center",
    lineHeight: 20, marginBottom: 28,
  },
  loginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14, padding: 15,
    alignItems: "center", width: "100%",
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  loginBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  regBtn:    { paddingVertical: 10, width: "100%", alignItems: "center", marginBottom: 20 },
  regBtnText:{ fontSize: 13, color: Colors.textMuted },
  freeNote: {
    backgroundColor: Colors.primaryLt,
    borderRadius: 12, padding: 12,
    width: "100%", borderWidth: 1, borderColor: "#c8e6c9",
  },
  freeNoteText: { fontSize: 12, color: Colors.secondary, textAlign: "center", lineHeight: 18 },
});
