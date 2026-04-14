import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../hooks/useAuth";
import { Colors } from "../constants/Colors";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleLogin = async () => {
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Vui lòng nhập đầy đủ thông tin");
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.replace("/(tabs)/camera");
    } catch (e: any) {
      setError(e.message || "Sai tên đăng nhập hoặc mật khẩu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <Text style={styles.logoEmoji}>🌿</Text>
          </View>
          <Text style={styles.appName}>Nhận diện bệnh lá sầu riêng</Text>
          <Text style={styles.appSub}>Durian Leaf Disease Detection · YOLOv26n-CLS</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Tên đăng nhập / Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="username"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.label}>Mật khẩu / Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={Colors.textMuted}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Đăng nhập · Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.orText}>hoặc · or</Text>
            <View style={styles.line} />
          </View>

          <TouchableOpacity onPress={() => router.push("/register")}>
            <Text style={styles.registerLink}>
              Chưa có tài khoản? <Text style={styles.registerLinkBold}>Đăng ký · Register</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>HUTECH 2025 · v1.0.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.white },
  scroll:       { flexGrow: 1 },
  hero: {
    backgroundColor: Colors.primary,
    alignItems: "center",
    paddingTop: 80, paddingBottom: 36, paddingHorizontal: 24,
  },
  logoWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.white,
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
  },
  logoEmoji:  { fontSize: 42 },
  appName:    { color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center", lineHeight: 24 },
  appSub:     { color: "rgba(255,255,255,.7)", fontSize: 12, marginTop: 6, textAlign: "center" },
  form:       { padding: 24, flex: 1 },
  label:      { fontSize: 13, color: Colors.textMuted, marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 13, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg,
  },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    padding: 15, alignItems: "center", marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:    { color: "#fff", fontSize: 16, fontWeight: "700" },
  divider:    { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  line:       { flex: 1, height: 1, backgroundColor: Colors.border },
  orText:     { marginHorizontal: 12, color: Colors.textMuted, fontSize: 13 },
  registerLink:     { textAlign: "center", fontSize: 13, color: Colors.textMuted },
  registerLinkBold: { color: Colors.primary, fontWeight: "600" },
  version:    { textAlign: "center", fontSize: 11, color: Colors.textMuted, padding: 16 },
  errorText:  { color: "#e53e3e", fontSize: 13, marginTop: 12, textAlign: "center" },
});
