import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, RefreshControl, Platform, ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { diagnosisApi } from "../../services/api";
import { Colors } from "../../constants/Colors";

const BASE_URL = "http://localhost:8000";

const LABEL_VI: Record<string, string> = {
  Leaf_Algal:          "Đốm tảo",
  Leaf_Blight:         "Cháy lá",
  Leaf_Colletotrichum: "Colletotrichum",
  Leaf_Healthy:        "Khỏe mạnh",
  Leaf_Phomopsis:      "Phomopsis",
  Leaf_Rhizoctonia:    "Rhizoctonia",
};

export default function HistoryScreen() {
  const router = useRouter();
  const [items,      setItems]      = useState<any[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page,       setPage]       = useState(0);

  const LIMIT = 10;

  const fetch = async (reset = false) => {
    const skip = reset ? 0 : page * LIMIT;
    try {
      const data: any = await diagnosisApi.list(skip, LIMIT);
      setTotal(data.total);
      setItems(reset ? data.items : prev => [...prev, ...data.items]);
      if (!reset) setPage(p => p + 1);
    } catch {
      // Not logged in or backend down — fall back to local history
      try {
        const raw = await AsyncStorage.getItem("local_history");
        const localHistory: any[] = raw ? JSON.parse(raw) : [];
        // Chỉ lấy 10 lần gần nhất
        const recent = localHistory.slice(0, LIMIT);
        setTotal(localHistory.length);
        setItems(recent);
      } catch {}
    }
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => {
    setPage(0);
    setLoading(true);
    fetch(true);
  }, []));

  const onRefresh = () => {
    setRefreshing(true);
    setPage(0);
    fetch(true);
  };

  const openDiagnosis = async (item: any) => {
    await AsyncStorage.setItem("last_diagnosis", JSON.stringify(item));
    router.push("/(tabs)/result");
  };

  const renderItem = ({ item }: { item: any }) => {
    const cls    = item.predicted_class ?? "Unknown";
    const nameVi = LABEL_VI[cls] ?? cls;
    const conf   = ((item.confidence ?? 0) * 100).toFixed(1);
    const badge  = Colors.diseaseBadge[cls as keyof typeof Colors.diseaseBadge]
                ?? { bg: "#f5f5f5", text: "#555" };
    const date   = new Date(item.created_at).toLocaleDateString("vi-VN", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });

    return (
      <TouchableOpacity style={styles.item} onPress={() => openDiagnosis(item)}>
        {item.image_url ? (
          <Image source={{ uri: `${BASE_URL}${item.image_url}` }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, { backgroundColor: badge.bg, justifyContent: "center", alignItems: "center" }]}>
            <Text style={{ fontSize: 24 }}>🌿</Text>
          </View>
        )}
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{nameVi}</Text>
          <Text style={styles.itemDate}>{date}</Text>
          <Text style={styles.itemConf}>Độ tin cậy: {conf}%</Text>
        </View>
        <View style={styles.itemRight}>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>{cls.replace("Leaf_","")}</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📋 Lịch sử chẩn đoán</Text>
        <Text style={styles.headerSub}>10 lần chẩn đoán gần nhất · Tổng: {total}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🌱</Text>
          <Text style={styles.emptyText}>Chưa có lịch sử chẩn đoán</Text>
          <TouchableOpacity style={styles.newBtn} onPress={() => router.push("/(tabs)/camera")}>
            <Text style={styles.newBtnText}>📷 Chẩn đoán đầu tiên</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          onEndReached={() => items.length < total && fetch()}
          onEndReachedThreshold={0.3}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListFooterComponent={items.length < total ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ padding: 16 }} />
          ) : null}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => router.push("/(tabs)/camera")}>
        <Text style={styles.fabText}>📷</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.white },
  center:      { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === "ios" ? 54 : 32,
    paddingBottom: 14, paddingHorizontal: 20,
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerSub:   { color: "rgba(255,255,255,.7)", fontSize: 12, marginTop: 3 },
  item: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white,
  },
  thumb:       { width: 56, height: 56, borderRadius: 10, marginRight: 12 },
  itemInfo:    { flex: 1 },
  itemName:    { fontSize: 15, fontWeight: "700", color: Colors.text },
  itemDate:    { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  itemConf:    { fontSize: 12, color: Colors.secondary, marginTop: 2 },
  itemRight:   { alignItems: "flex-end", gap: 6 },
  badge:       { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:   { fontSize: 10, fontWeight: "700" },
  arrow:       { fontSize: 20, color: Colors.textMuted },
  sep:         { height: 1, backgroundColor: Colors.border, marginLeft: 84 },
  emptyText:   { fontSize: 16, color: Colors.textMuted, marginBottom: 20, textAlign: "center" },
  newBtn:      { backgroundColor: Colors.primary, borderRadius: 12, padding: 14, paddingHorizontal: 28 },
  newBtnText:  { color: "#fff", fontWeight: "700", fontSize: 15 },
  fab: {
    position: "absolute", bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6,
  },
  fabText: { fontSize: 24 },
});
