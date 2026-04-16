import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../hooks/useAuth";
import { Colors } from "../constants/Colors";

/** 34 đơn vị hành chính cấp tỉnh Việt Nam (sau sáp nhập 2025) */
const PROVINCES = [
  // Miền Bắc
  "Hà Nội", "Hải Phòng", "Quảng Ninh",
  "Bắc Giang", "Thái Nguyên", "Tuyên Quang",
  "Lào Cai", "Yên Bái", "Sơn La", "Lạng Sơn",
  "Hưng Yên",
  // Miền Trung
  "Thanh Hóa", "Nghệ An", "Hà Tĩnh",
  "Huế", "Đà Nẵng",
  "Bình Định", "Khánh Hòa",
  // Tây Nguyên
  "Gia Lai", "Đắk Lắk", "Lâm Đồng",
  // Đông Nam Bộ
  "Bình Phước", "Tây Ninh", "Bình Dương",
  "Đồng Nai", "Bà Rịa - Vũng Tàu", "Hồ Chí Minh",
  // Đồng bằng sông Cửu Long
  "Long An", "Tiền Giang", "An Giang",
  "Cần Thơ", "Kiên Giang", "Sóc Trăng", "Bạc Liêu",
];

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  [key: string]: any;
}

function Field({ label, value, onChangeText, ...props }: FieldProps) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={Colors.textMuted}
        {...props}
      />
    </View>
  );
}

export default function RegisterScreen() {
  const router   = useRouter();
  const { register } = useAuth();

  const [username,  setUsername]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [full_name, setFullName]  = useState("");
  const [phone,     setPhone]     = useState("");
  const [province,  setProvince]  = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const handleRegister = async () => {
    setError("");
    if (!username || !email || !password) {
      setError("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }
    if (password !== confirm) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }
    setLoading(true);
    try {
      await register({
        username:  username.trim(),
        email:     email.trim(),
        password,
        full_name: full_name || undefined,
        phone:     phone     || undefined,
        province:  province  || undefined,
      });
      router.replace("/(tabs)/camera");
    } catch (e: any) {
      setError(e.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex:1, backgroundColor: Colors.white }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Quay lại</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Tạo tài khoản · Register</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.sectionLabel}>Thông tin bắt buộc</Text>
          <Field label="Tên đăng nhập *" value={username} onChangeText={setUsername}
            autoCapitalize="none" placeholder="username" />
          <Field label="Email *" value={email} onChangeText={setEmail}
            keyboardType="email-address" autoCapitalize="none" placeholder="email@example.com" />
          <Field label="Mật khẩu *" value={password} onChangeText={setPassword}
            secureTextEntry placeholder="••••••" />
          <Field label="Xác nhận mật khẩu *" value={confirm} onChangeText={setConfirm}
            secureTextEntry placeholder="••••••" />

          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Thông tin thêm (tuỳ chọn)</Text>
          <Field label="Họ và tên" value={full_name} onChangeText={setFullName}
            placeholder="Nguyễn Văn A" />
          <Field label="Số điện thoại" value={phone} onChangeText={setPhone}
            keyboardType="phone-pad" placeholder="0xxxxxxxxx" />

          <Text style={styles.label}>Tỉnh/Thành</Text>
          <View style={styles.provinceGrid}>
            {PROVINCES.map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.provinceChip, province === p && styles.provinceChipActive]}
                onPress={() => setProvince(province === p ? "" : p)}
              >
                <Text style={[styles.provinceText, province === p && styles.provinceTextActive]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.6 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Đăng ký · Register</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace("/login")} style={{ marginTop: 16 }}>
            <Text style={styles.loginLink}>
              Đã có tài khoản?{" "}
              <Text style={{ color: Colors.primary, fontWeight: "600" }}>Đăng nhập</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:       { flexGrow: 1 },
  header:       { backgroundColor: Colors.primary, padding: 20, paddingTop: 56 },
  backBtn:      { marginBottom: 8 },
  backText:     { color: "rgba(255,255,255,.8)", fontSize: 14 },
  title:        { color: "#fff", fontSize: 22, fontWeight: "700" },
  form:         { padding: 20 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  label:        { fontSize: 13, color: Colors.textMuted, marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    padding: 13, fontSize: 15, color: Colors.text, backgroundColor: Colors.bg,
  },
  provinceGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  provinceChip:      { borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.bg },
  provinceChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  provinceText:      { fontSize: 12, color: Colors.textMuted },
  provinceTextActive: { color: "#fff", fontWeight: "600" },
  btn:     { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: "center", marginTop: 28 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  loginLink:  { textAlign: "center", fontSize: 13, color: Colors.textMuted },
  errorText:  { color: "#e53e3e", fontSize: 13, marginTop: 12, textAlign: "center" },
});
