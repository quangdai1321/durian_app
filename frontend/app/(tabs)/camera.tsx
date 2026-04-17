import React, { useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, Image, ScrollView,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { diagnosisApi } from "../../services/api";
import { Colors } from "../../constants/Colors";
import WeatherBanner from "../../components/WeatherBanner";

type Mode = "choose" | "camera" | "loading";

// On web: returns the File object directly (not dataURI)
function pickFileWeb(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type   = "file";
    input.accept = "image/*";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

function fileToDataURI(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve((e.target as any).result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Resize ảnh về max 800×800 trước khi upload — giảm thời gian xử lý ~70% */
function resizeImageWeb(file: File, maxSize = 800): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width > height) { height = Math.round(height * maxSize / width); width = maxSize; }
        else                { width = Math.round(width * maxSize / height);  height = maxSize; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = async () => { resolve(await fileToDataURI(file)); }; // fallback
    img.src = url;
  });
}

export default function CameraScreen() {
  const router    = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing,  setFacing]  = useState<CameraType>("back");
  const [mode,    setMode]    = useState<Mode>("choose");
  const [preview, setPreview] = useState<string | null>(null);
  const [errMsg,  setErrMsg]  = useState("");
  const [errType, setErrType] = useState<"generic"|"not_leaf">("generic");

  // Reset to choose screen whenever this tab gets focused
  useFocusEffect(useCallback(() => {
    setMode("choose");
    setErrMsg("");
    setErrType("generic");
    setPreview(null);
  }, []));

  const diagnose = async (uri: string) => {
    setPreview(uri);
    setMode("loading");
    setErrMsg("");
    try {
      let lat: number | undefined, lng: number | undefined;
      try {
        const locPerm = await Location.requestForegroundPermissionsAsync();
        if (locPerm.granted) {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          lat = loc.coords.latitude; lng = loc.coords.longitude;
        }
      } catch {}
      const result: any = await diagnosisApi.diagnose(uri, { latitude: lat, longitude: lng });
      // Nếu backend không trả về image_data (DB chưa có cột / record cũ),
      // dùng URI local của camera làm fallback để result screen luôn có ảnh
      if (!result.image_data) {
        result.image_data = uri;
      }
      await AsyncStorage.setItem("last_diagnosis", JSON.stringify(result));
      // Append to local history — KHÔNG lưu image_data (base64 ~80KB/record)
      // tránh tràn localStorage quota trên mobile web (iOS Safari ~5MB)
      const raw = await AsyncStorage.getItem("local_history");
      const localHistory: any[] = raw ? JSON.parse(raw) : [];
      const { image_data: _drop, ...resultWithoutImg } = result;  // strip base64
      localHistory.unshift(resultWithoutImg);
      if (localHistory.length > 30) localHistory.pop(); // cap at 30
      try {
        await AsyncStorage.setItem("local_history", JSON.stringify(localHistory));
      } catch { /* quota exceeded — history không critical, bỏ qua */ }
      router.push("/(tabs)/result");
    } catch (e: any) {
      // Check NOT_DURIAN_LEAF error từ backend
      let detail = e?.detail || e?.response?.detail;
      if (typeof detail === "object" && detail?.code === "NOT_DURIAN_LEAF") {
        setErrType("not_leaf");
        setErrMsg(detail.hint || "Hãy chụp lại ảnh lá sầu riêng.");
      } else {
        setErrType("generic");
        const msg = typeof e === "string" ? e : (e?.message || (typeof detail === "string" ? detail : null) || "Không thể kết nối máy chủ");
        setErrMsg(msg);
      }
      setMode("choose");
      setPreview(null);
    }
  };

  const pickImage = async () => {
    if (Platform.OS === "web") {
      const file = await pickFileWeb();
      if (!file) return;
      // Resize về max 800×800 trước khi upload → giảm thời gian xử lý
      const dataUri = await resizeImageWeb(file);
      await diagnose(dataUri);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { setErrMsg("Can quyen truy cap thu vien anh"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]) await diagnose(res.assets[0].uri);
  };

  const capture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (photo) await diagnose(photo.uri);
    } catch (e: any) { setErrMsg(e.message || "Loi chup anh"); }
  };

  // Loading screen
  if (mode === "loading") {
    return (
      <View style={s.loadingRoot}>
        {preview && <Image source={{ uri: preview }} style={StyleSheet.absoluteFillObject} blurRadius={2} />}
        <View style={s.loadingOverlay}>
          <View style={s.loadingCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={s.loadingTitle}>Đang phân tích lá...</Text>
            <Text style={s.loadingModel}>YOLOv26n-CLS AI Model</Text>
            {["Tiền xử lý ảnh", "Trích xuất đặc trưng", "Phân loại bệnh"].map((t, i) => (
              <View key={i} style={s.loadingStep}>
                <View style={s.loadingDot} />
                <Text style={s.loadingStepText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // Camera mode
  if (mode === "camera") {
    // On web, permission may be null briefly — show loader
    if (!permission) return (
      <View style={[s.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 12, color: Colors.textMuted }}>Đang kết nối camera...</Text>
        <TouchableOpacity style={[s.permBack, { marginTop: 20 }]} onPress={() => setMode("choose")}>
          <Text style={s.permBackText}>← Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
    if (!permission.granted) {
      return (
        <View style={s.permRoot}>
          <Text style={s.permTitle}>Cần quyền Camera</Text>
          <Text style={s.permSub}>Cho phép truy cập camera để chụp ảnh lá sầu riêng</Text>
          <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
            <Text style={s.permBtnText}>Cấp quyền · Allow</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.permBack} onPress={() => setMode("choose")}>
            <Text style={s.permBackText}>← Quay lại</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={s.root}>
        <TouchableOpacity style={s.camBack} onPress={() => setMode("choose")}>
          <Text style={s.camBackText}>← Quay lại</Text>
        </TouchableOpacity>
        <CameraView style={s.camera} facing={facing} ref={cameraRef}>
          <View style={s.overlay}>
            <View style={s.scanFrame}>
              <View style={[s.corner, s.tl]} />
              <View style={[s.corner, s.tr]} />
              <View style={[s.corner, s.bl]} />
              <View style={[s.corner, s.br]} />
            </View>
            <Text style={s.scanLabel}>Đặt lá vào khung · Place leaf in frame</Text>
          </View>
        </CameraView>
        <View style={s.controls}>
          <TouchableOpacity style={s.sideBtn} onPress={pickImage}>
            <Text style={s.sideBtnLabel}>🖼️ Thư viện</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.captureBtn} onPress={capture} activeOpacity={0.8}>
            <View style={s.captureBtnInner} />
          </TouchableOpacity>
          <TouchableOpacity style={s.sideBtn} onPress={() => setFacing(f => f === "back" ? "front" : "back")}>
            <Text style={s.sideBtnLabel}>🔄 Lật</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Choose screen (default)
  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>🌿 Chẩn đoán bệnh lá sầu riêng</Text>
        <Text style={s.headerSub}>Chọn cách lấy ảnh để phân tích</Text>
      </View>

      {/* ── Weather banner — tap to go to Treatment tab ── */}
      <WeatherBanner />

      <ScrollView contentContainerStyle={s.chooseBody} showsVerticalScrollIndicator={false}>
        <View style={s.heroBox}>
          <Text style={s.heroTitle}>🔬 AI nhận diện bệnh lá sầu riêng</Text>
          <Text style={s.heroSub}>Chụp hoặc tải ảnh lá để nhận kết quả phân tích bệnh tức thì từ mô hình YOLOv26n-CLS.</Text>
        </View>

        <TouchableOpacity style={[s.optionCard, { borderColor: Colors.primary }]} onPress={() => setMode("camera")} activeOpacity={0.85}>
          <View style={[s.optionIcon, { backgroundColor: Colors.primary }]}>
            <Text style={s.optionIconText}>📷</Text>
          </View>
          <View style={s.optionText}>
            <Text style={s.optionTitle}>Chụp ảnh trực tiếp</Text>
            <Text style={s.optionDesc}>{Platform.OS === "web" ? "Dùng webcam hoặc camera thiết bị để chụp lá ngay tức thì." : "Dùng camera điện thoại để chụp lá ngay. Đảm bảo ánh sáng tốt và lá rõ nét."}</Text>
            <View style={s.optionTag}><Text style={s.optionTagText}>Nhanh nhất</Text></View>
          </View>
          <Text style={s.optionArrow}>{">"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.optionCard, { borderColor: Colors.info }]} onPress={pickImage} activeOpacity={0.85}>
          <View style={[s.optionIcon, { backgroundColor: Colors.info }]}>
            <Text style={s.optionIconText}>📂</Text>
          </View>
          <View style={s.optionText}>
            <Text style={s.optionTitle}>{Platform.OS === "web" ? "Tải ảnh từ máy tính / thiết bị" : "Chọn từ thư viện ảnh"}</Text>
            <Text style={s.optionDesc}>{Platform.OS === "web" ? "Upload file ảnh JPG, PNG, HEIC từ máy tính, điện thoại hoặc ổ đĩa ngoài." : "Chọn ảnh đã chụp sẵn trong bộ nhớ. Hỗ trợ JPG, PNG, HEIC."}</Text>
          </View>
          <Text style={s.optionArrow}>{">"}</Text>
        </TouchableOpacity>

        {errMsg ? (
          errType === "not_leaf" ? (
            <View style={s.notLeafBox}>
              <Text style={s.notLeafEmoji}>🍃</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.notLeafTitle}>Không phải lá sầu riêng</Text>
                <Text style={s.notLeafDesc}>AI xác nhận ảnh này không phải lá sầu riêng.</Text>
                <Text style={s.notLeafHint}>💡 {errMsg}</Text>
              </View>
            </View>
          ) : (
            <View style={s.errorBox}>
              <Text style={s.errorText}>⚠️ {errMsg}</Text>
            </View>
          )
        ) : null}

        <View style={s.tipsCard}>
          <Text style={s.tipsTitle}>💡 Mẹo để có kết quả tốt nhất</Text>
          {["Chụp gần lá, rõ nét toàn bộ mặt lá", "Ưu tiên ánh sáng tự nhiên, tránh bóng đổ", "Chỉ 1 lá trên ảnh, không bị che khuất", "Nên chụp cả mặt trên lẫn mặt dưới của lá"].map((tip, i) => (
            <View key={i} style={s.tipRow}>
              <Text style={s.tipNum}>{String(i + 1)}</Text>
              <Text style={s.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.primary, paddingTop: Platform.OS === "ios" ? 54 : 32, paddingBottom: 14, paddingHorizontal: 20 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerSub:   { color: "rgba(255,255,255,.7)", fontSize: 12, marginTop: 3 },
  chooseBody: { padding: 16 },
  heroBox: { backgroundColor: Colors.primaryLt, borderRadius: 18, padding: 24, alignItems: "center", marginBottom: 20, borderWidth: 1, borderColor: "#c8e6c9" },
  heroTitle: { fontSize: 17, fontWeight: "800", color: Colors.primary, marginBottom: 8, textAlign: "center" },
  heroSub: { fontSize: 13, color: Colors.textMuted, lineHeight: 20, textAlign: "center" },
  optionCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  optionIcon: { width: 60, height: 60, borderRadius: 16, justifyContent: "center", alignItems: "center", marginRight: 16 },
  optionIconText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: "700", color: Colors.text, marginBottom: 4 },
  optionDesc: { fontSize: 12, color: Colors.textMuted, lineHeight: 18, marginBottom: 6 },
  optionTag: { backgroundColor: Colors.primaryLt, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" },
  optionTagText: { fontSize: 10, fontWeight: "700", color: Colors.primary },
  optionArrow: { fontSize: 22, color: Colors.textMuted, marginLeft: 8 },
  errorBox:  { backgroundColor: "#ffebee", borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#ffcdd2" },
  errorText: { color: "#c62828", fontSize: 13 },
  notLeafBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "#fff8e1", borderRadius: 16, padding: 16,
    marginBottom: 14, borderWidth: 1.5, borderColor: "#ffb300",
  },
  notLeafEmoji: { fontSize: 36 },
  notLeafTitle: { fontSize: 15, fontWeight: "800", color: "#e65100", marginBottom: 4 },
  notLeafDesc:  { fontSize: 13, color: "#bf360c", marginBottom: 6 },
  notLeafHint:  { fontSize: 12, color: "#f57f17", lineHeight: 18 },
  tipsCard: { backgroundColor: "#fff", borderRadius: 18, padding: 18, borderWidth: 1, borderColor: Colors.border },
  tipsTitle: { fontSize: 14, fontWeight: "700", color: Colors.primary, marginBottom: 14 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  tipNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primaryLt, textAlign: "center", lineHeight: 22, fontSize: 11, fontWeight: "700", color: Colors.primary, marginRight: 10, overflow: "hidden" },
  tipText: { fontSize: 13, color: Colors.textMuted, flex: 1, lineHeight: 20 },
  permRoot: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0d1a0d", padding: 32 },
  permTitle: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 8 },
  permSub: { color: "rgba(255,255,255,.6)", fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 28 },
  permBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, marginBottom: 14 },
  permBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  permBack: { padding: 10 },
  permBackText: { color: "rgba(255,255,255,.6)", fontSize: 14 },
  camera: { flex: 1 },
  camBack: { position: "absolute", top: Platform.OS === "ios" ? 52 : 28, left: 16, zIndex: 10, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  camBackText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.25)" },
  scanFrame: { width: 240, height: 300, position: "relative" },
  corner: { position: "absolute", width: 24, height: 24, borderColor: Colors.accent },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 5 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 5 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 5 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 5 },
  scanLabel: { color: "rgba(255,255,255,.85)", fontSize: 13, marginTop: 20, backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "#0a120a", paddingVertical: 18, paddingHorizontal: 30, paddingBottom: Platform.OS === "ios" ? 36 : 18 },
  sideBtn: { alignItems: "center", width: 70 },
  sideBtnLabel: { color: "rgba(255,255,255,.7)", fontSize: 11, textAlign: "center" },
  captureBtn: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: "rgba(255,255,255,0.5)", backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  captureBtnInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: Colors.white },
  loadingRoot: { flex: 1, backgroundColor: "#0d1a0d", justifyContent: "center", alignItems: "center" },
  loadingOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.55)" },
  loadingCard: { backgroundColor: "#fff", borderRadius: 20, padding: 32, alignItems: "center", margin: 32, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 20, elevation: 12, minWidth: 260 },
  loadingTitle: { fontSize: 18, fontWeight: "700", color: Colors.primary, marginTop: 16, marginBottom: 4 },
  loadingModel: { fontSize: 12, color: Colors.textMuted, marginBottom: 20 },
  loadingStep: { flexDirection: "row", alignItems: "center", marginBottom: 8, alignSelf: "stretch" },
  loadingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent, marginRight: 10 },
  loadingStepText: { fontSize: 13, color: Colors.textMuted },
});
