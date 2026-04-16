import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, RefreshControl, Modal,
  TextInput, KeyboardAvoidingView,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { newsApi } from "../../services/api";
import AuthGuard from "../../components/AuthGuard";

interface NewsItem {
  title:   string;
  link:    string;
  pubDate: string;
  source:  string;
  summary: string;
}
interface PriceItem {
  variety: string;
  price:   number;
  unit:    string;
  link:    string;
  source:  string;
  pubDate: string;
}

// Module-level cache
const _cache: { items: NewsItem[]; prices: PriceItem[]; priceDate: string; ts: number } = {
  items: [], prices: [], priceDate: "", ts: 0,
};
const CACHE_TTL_MS = 5 * 60 * 1000;

// ── Helpers ──────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const h = Math.floor((Date.now() - d.getTime()) / 3600000);
    if (h < 1) return "Vừa xong";
    if (h < 24) return `${h} giờ trước`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days} ngày trước`;
    return d.toLocaleDateString("vi-VN");
  } catch { return dateStr; }
}

function openExternal(url: string) {
  if (Platform.OS === "web") window.open(url, "_blank");
}

// ── Article Modal ─────────────────────────────────────────────
function ArticleModal({ item, onClose }: { item: NewsItem | null; onClose: () => void }) {
  const [content,  setContent]  = useState("");
  const [artTitle, setArtTitle] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const isGoogleNewsLink = (url: string) =>
    url.includes("news.google.com") || url.includes("google.com/sorry");

  useEffect(() => {
    if (!item) return;
    setContent(""); setArtTitle(""); setError("");

    // Google News links → không thể fetch từ server (bot block)
    // Hiện summary + nút mở browser, không cần loading
    if (isGoogleNewsLink(item.link)) {
      setArtTitle(item.title);
      setContent(item.summary || "");
      setError("preview");
      setLoading(false);
      return;
    }

    setLoading(true);
    newsApi.article(item.link)
      .then((d: any) => {
        if (d.blocked) {
          setArtTitle(item.title);
          setContent(item.summary || "");
          setError("preview");
          return;
        }
        const title = d.title || item.title || "";
        const raw   = d.content || "";
        const isUseless = raw.trim() === "" || raw.length < 80;
        if (isUseless) {
          setArtTitle(item.title);
          setContent(item.summary || "");
          setError("preview");
        } else {
          setArtTitle(title);
          setContent(raw);
        }
      })
      .catch(() => {
        setArtTitle(item.title);
        setContent(item.summary || "");
        setError("preview");
      })
      .finally(() => setLoading(false));
  }, [item]);

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <View style={am.overlay}>
        <View style={am.sheet}>
          {/* Header */}
          <View style={am.header}>
            <View style={am.headerMeta}>
              {item?.source ? <Text style={am.source}>{item.source}</Text> : null}
              <Text style={am.time}>{timeAgo(item?.pubDate || "")}</Text>
            </View>
            <View style={am.headerActions}>
              <TouchableOpacity style={am.extBtn} onPress={() => item && openExternal(item.link)}>
                <Text style={am.extBtnText}>🌐 Trang gốc</Text>
              </TouchableOpacity>
              <TouchableOpacity style={am.closeBtn} onPress={onClose}>
                <Text style={am.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          {loading ? (
            <View style={am.center}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={am.loadText}>Đang tải bài viết...</Text>
            </View>
          ) : error && error !== "preview" ? (
            <View style={am.center}>
              <Text style={am.errorText}>{error}</Text>
              <TouchableOpacity style={am.openBtn} onPress={() => item && openExternal(item.link)}>
                <Text style={am.openBtnIcon}>🌐</Text>
                <Text style={am.openBtnText}>Mở trên trình duyệt</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={am.body} showsVerticalScrollIndicator={false}>
              <Text style={am.artTitle}>{artTitle || item?.title}</Text>
              <View style={am.divider} />
              {error === "preview" && (
                <View style={am.previewBanner}>
                  <Text style={am.previewBannerText}>
                    📋 Tóm tắt · Nhấn nút bên dưới để đọc bài đầy đủ trên trang báo.
                  </Text>
                </View>
              )}
              {content ? (
                <Text style={am.artContent}>{content}</Text>
              ) : (
                <Text style={am.noContent}>Không có nội dung xem trước.</Text>
              )}

              {/* CTA button */}
              <TouchableOpacity style={am.openBtn} onPress={() => item && openExternal(item.link)} activeOpacity={0.85}>
                <Text style={am.openBtnIcon}>🌐</Text>
                <View>
                  <Text style={am.openBtnText}>Đọc bài đầy đủ trên trang gốc</Text>
                  {item?.source ? <Text style={am.openBtnSub}>{item.source}</Text> : null}
                </View>
                <Text style={am.openBtnArrow}>›</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Price Modal ───────────────────────────────────────────────
const PRICE_TABLE = [
  { name: "Sầu riêng Ri6 (Đẹp lựa)",      use: "Cơm vàng béo ngậy",         range: "55.000đ – 65.000đ/kg",  region: "Tiền Giang, Vĩnh Long",          tag: "Nội địa",   tagColor: "#2e7d32" },
  { name: "Sầu riêng Ri6 (Hàng xô)",       use: "Tiêu thụ nội địa / chế biến",range: "25.000đ – 30.000đ/kg",  region: "Gia Lai, Đắk Lắk, Cần Thơ",      tag: "Nội địa",   tagColor: "#2e7d32" },
  { name: "Sầu riêng Thái Monthong (Đẹp)", use: "Cơm dày, xuất khẩu chính ngạch", range: "85.000đ – 95.000đ/kg", region: "Cai Lậy, Đồng Tháp",           tag: "Xuất khẩu", tagColor: "#1565c0" },
  { name: "Sầu riêng Thái VIP",            use: "Tiêu chuẩn xuất khẩu loại A",range: "130.000đ – 160.000đ/kg", region: "Tiền Giang, Đắk Lắk",          tag: "Cao cấp",   tagColor: "#e65100" },
  { name: "Sầu riêng Musang King (Loại A)",use: "Vị đắng ngọt đặc trưng",     range: "103.000đ – 130.000đ/kg", region: "Tây Nguyên",                   tag: "Cao cấp",   tagColor: "#e65100" },
  { name: "Sầu riêng Chuồng Bò (Loại A)", use: "Cơm nhão, vị béo nồng",      range: "63.000đ – 72.000đ/kg",  region: "Miền Tây, Đông Nam Bộ",          tag: "Nội địa",   tagColor: "#2e7d32" },
  { name: "Sầu riêng Sáu Hữu (Loại A)",   use: "Cơm dẻo, thơm nồng, hạt lép", range: "~80.000đ/kg",          region: "Tiền Giang",                     tag: "Nội địa",   tagColor: "#2e7d32" },
  { name: "Durian Monthong (Thái Lan)",    use: "Xuất khẩu Trung Quốc, EU",   range: "3 – 5 USD/kg",           region: "Thị trường quốc tế",            tag: "Quốc tế",   tagColor: "#6a1b9a" },
  { name: "Musang King (Malaysia)",        use: "Thương hiệu cao cấp toàn cầu", range: "20 – 50 USD/kg",       region: "Malaysia, Singapore, HK",        tag: "Quốc tế",   tagColor: "#6a1b9a" },
];

function PriceModal({ visible, onClose, prices, priceDate }: {
  visible: boolean; onClose: () => void; prices: PriceItem[]; priceDate: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pm.overlay}>
        <View style={pm.sheet}>

          {/* ── Header ── */}
          <View style={pm.header}>
            <View>
              <Text style={pm.title}>💰 Bảng giá sầu riêng</Text>
              <Text style={pm.sub}>Cập nhật: {timeAgo(priceDate)}</Text>
            </View>
            <TouchableOpacity style={pm.closeBtn} onPress={onClose}>
              <Text style={pm.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={pm.scroll} showsVerticalScrollIndicator={false}>

            {/* ── Live prices: horizontal scroll ── */}
            {prices.length > 0 && (
              <View style={pm.liveBox}>
                <Text style={pm.liveTitle}>📡 Giá thực tế hôm nay · Nhấn để xem nguồn</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 2 }}>
                  <View style={pm.liveRow}>
                    {prices.map((p, i) => {
                      const isRef = p.source === "Tham khảo";
                      return (
                        <TouchableOpacity key={i}
                          style={[pm.chip, isRef && pm.chipRef]}
                          activeOpacity={0.75}
                          onPress={() => !isRef && p.link && openExternal(p.link)}>
                          {isRef && <Text style={pm.chipRefLabel}>THAM KHẢO</Text>}
                          <Text style={pm.chipVariety}>{p.variety}</Text>
                          <Text style={[pm.chipPrice, isRef && { color: "#ffd54f99" }]}>
                            {p.price.toLocaleString("vi-VN")}đ/kg
                          </Text>
                          {!isRef && p.source
                            ? <Text style={pm.chipSource} numberOfLines={1}>📰 {p.source}</Text>
                            : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* ── Reference table: card list ── */}
            <Text style={pm.tableTitle}>📋 Bảng tham khảo chi tiết</Text>
            {PRICE_TABLE.map((r, i) => (
              <View key={i} style={pm.card}>
                {/* Top row: tag + name */}
                <View style={pm.cardTop}>
                  <View style={[pm.tag, { backgroundColor: r.tagColor + "22" }]}>
                    <Text style={[pm.tagText, { color: r.tagColor }]}>{r.tag}</Text>
                  </View>
                  <Text style={pm.cardName} numberOfLines={2}>{r.name}</Text>
                </View>
                {/* Bottom row: info + price */}
                <View style={pm.cardBottom}>
                  <View style={{ flex: 1 }}>
                    <Text style={pm.cardUse} numberOfLines={1}>{r.use}</Text>
                    <Text style={pm.cardRegion}>📍 {r.region}</Text>
                  </View>
                  <View style={pm.cardPriceWrap}>
                    <Text style={[pm.cardPrice, { color: r.tagColor }]}>{r.range}</Text>
                  </View>
                </View>
              </View>
            ))}

            <View style={pm.note}>
              <Text style={pm.noteText}>⚠️ Giá chỉ mang tính tham khảo, thay đổi theo mùa vụ và thị trường.</Text>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────
export default function NewsScreen() {
  const hasCached = _cache.ts > 0;
  const [items,       setItems]      = useState<NewsItem[]>(_cache.items);
  const [loading,     setLoading]    = useState(!hasCached);
  const [refreshing,  setRefreshing] = useState(false);
  const [error,       setError]      = useState("");
  const [prices,      setPrices]     = useState<PriceItem[]>(_cache.prices);
  const [priceDate,   setPriceDate]  = useState(_cache.priceDate);
  const [showPrices,  setShowPrices] = useState(false);
  const [activeItem,  setActiveItem] = useState<NewsItem | null>(null);
  const [query,       setQuery]      = useState("");
  const [searching,   setSearching]  = useState(false);
  const [searchItems, setSearchItems]= useState<NewsItem[]>([]);
  const [searchError, setSearchError]= useState("");

  const fetchNews = useCallback(async (isRefresh = false) => {
    const stale = Date.now() - _cache.ts > CACHE_TTL_MS;
    if (!isRefresh && !stale) return;
    if (isRefresh) setRefreshing(true);
    else if (!hasCached) setLoading(true);
    setError("");
    try {
      const [nd, pd] = await Promise.all([
        newsApi.list(),
        newsApi.prices().catch(() => null),
      ]) as any[];
      if (!nd) throw new Error("Không thể tải tin tức");
      _cache.items = nd.items || [];
      _cache.prices = pd?.prices || [];
      _cache.priceDate = pd?.updated || "";
      _cache.ts = Date.now();
      setItems(_cache.items);
      if (_cache.prices.length) { setPrices(_cache.prices); setPriceDate(_cache.priceDate); }
    } catch (e: any) {
      if (!hasCached) setError(e.message || "Lỗi kết nối");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchNews(); }, []);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError("");
    setSearchItems([]);
    try {
      const d: any = await newsApi.search(q);
      setSearchItems(d.items || []);
      if (!d.items?.length) setSearchError("Không tìm thấy kết quả");
    } catch {
      setSearchError("Lỗi tìm kiếm");
    } finally { setSearching(false); }
  };

  const clearSearch = () => { setQuery(""); setSearchItems([]); setSearchError(""); };
  const displayItems = searchItems.length ? searchItems : items;
  const isSearchMode = query.trim().length > 0;

  return (
    <AuthGuard>
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerTitle}>📰 Tin tức Sầu riêng</Text>
            <Text style={s.headerSub}>Cập nhật liên tục từ trong nước</Text>
          </View>
          <TouchableOpacity style={s.priceBox} onPress={() => setShowPrices(true)} activeOpacity={0.8}>
            <Text style={s.priceBoxTitle}>💰 Giá hôm nay ›</Text>
            {prices.length > 0 ? prices.slice(0, 3).map((p, i) => (
              <View key={i} style={s.priceRow}>
                <Text style={s.priceVariety}>{p.variety}</Text>
                <Text style={[s.priceValue, p.source === "Tham khảo" && { color: "#ffd54f" }]}>
                  {p.price.toLocaleString("vi-VN")}đ{p.source === "Tham khảo" ? "*" : ""}
                </Text>
              </View>
            )) : <Text style={s.priceVariety}>Nhấn để xem bảng giá</Text>}
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={s.searchRow}>
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm kiếm tin tức sầu riêng..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoCapitalize="none"
          />
          {isSearchMode ? (
            <TouchableOpacity style={s.searchClearBtn} onPress={clearSearch}>
              <Text style={s.searchClearText}>✕</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={s.searchBtn} onPress={handleSearch} disabled={searching}>
            {searching
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.searchBtnText}>🔍</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Modals */}
      <PriceModal visible={showPrices} onClose={() => setShowPrices(false)} prices={prices} priceDate={priceDate} />
      <ArticleModal item={activeItem} onClose={() => setActiveItem(null)} />

      {/* Content */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={s.loadText}>Đang tải tin tức...</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => fetchNews()}>
            <Text style={s.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={s.list} showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchNews(true)}
              tintColor={Colors.primary} colors={[Colors.primary]} />
          }
        >
          {isSearchMode && searchItems.length > 0 && (
            <Text style={s.countText}>🔍 {searchItems.length} kết quả cho "{query}"</Text>
          )}
          {!isSearchMode && (
            <Text style={s.countText}>{items.length} bài viết · Kéo xuống để làm mới</Text>
          )}
          {searchError ? (
            <Text style={s.searchErrorText}>{searchError}</Text>
          ) : null}

          {displayItems.map((item, i) => (
            <TouchableOpacity key={i} style={s.card} onPress={() => setActiveItem(item)} activeOpacity={0.75}>
              <View style={s.cardTop}>
                {item.source
                  ? <View style={s.badge}><Text style={s.badgeText}>{item.source}</Text></View>
                  : null}
                <Text style={s.timeText}>{timeAgo(item.pubDate)}</Text>
              </View>
              <Text style={s.title} numberOfLines={3}>{item.title}</Text>
              {item.summary
                ? <Text style={s.summary} numberOfLines={2}>{item.summary}</Text>
                : null}
              <Text style={s.readMore}>📖 Đọc bài →</Text>
            </TouchableOpacity>
          ))}

          {!loading && displayItems.length === 0 && !searchError && (
            <View style={s.center}><Text style={s.emptyText}>Không có tin tức</Text></View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
    </AuthGuard>
  );
}

// ── Article Modal Styles ─────────────────────────────────────
const am = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "92%", flex: 1 },
  header:       { backgroundColor: Colors.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  headerMeta:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  source:       { color: "#ffd54f", fontSize: 12, fontWeight: "700" },
  time:         { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  headerActions:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  extBtn:       { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  extBtnText:   { color: "#fff", fontSize: 12, fontWeight: "600" },
  closeBtn:     { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 18, width: 32, height: 32, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  closeBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  center:       { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  loadText:     { marginTop: 12, color: Colors.textMuted, fontSize: 14 },
  errorText:    { color: "#e53e3e", fontSize: 14, textAlign: "center", marginBottom: 16 },
  // ── Open-in-browser CTA button ─────────────────────────────
  openBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 14, padding: 14, paddingHorizontal: 18,
    marginTop: 20, marginHorizontal: 2,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  openBtnIcon:  { fontSize: 20 },
  openBtnText:  { flex: 1, color: "#fff", fontWeight: "700", fontSize: 14 },
  openBtnSub:   { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 1 },
  openBtnArrow: { color: "rgba(255,255,255,0.8)", fontSize: 22, fontWeight: "300" },
  body:         { flex: 1, padding: 18 },
  artTitle:     { fontSize: 18, fontWeight: "800", color: Colors.text, lineHeight: 26, marginBottom: 12 },
  divider:      { height: 1, backgroundColor: Colors.border, marginBottom: 14 },
  artContent:   { fontSize: 14, color: Colors.text, lineHeight: 22 },
  extBtnBottom: { backgroundColor: Colors.primaryLt, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 20 },
  previewBanner: { backgroundColor: "#fff8e1", borderRadius: 8, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: "#ffe082" },
  previewBannerText: { fontSize: 12, color: "#bf360c", lineHeight: 18 },
  noContent: { fontSize: 13, color: Colors.textMuted, fontStyle: "italic", textAlign: "center", paddingVertical: 20 },
});

// ── Price Modal Styles ───────────────────────────────────────
const pm = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: "#f4f7f4", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "94%", paddingBottom: Platform.OS === "ios" ? 36 : 16 },

  // Header
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: Colors.primary, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingVertical: 16 },
  title:        { color: "#fff", fontSize: 19, fontWeight: "800" },
  sub:          { color: "rgba(255,255,255,.75)", fontSize: 12, marginTop: 2 },
  closeBtn:     { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  closeBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },

  // Scroll
  scroll:       { paddingHorizontal: 14 },

  // Live price chips — horizontal scroll
  liveBox:      { backgroundColor: "#e8f5e9", borderRadius: 14, padding: 12, marginTop: 14, marginBottom: 4 },
  liveTitle:    { fontSize: 12, fontWeight: "700", color: Colors.primary, marginBottom: 10, letterSpacing: 0.3 },
  liveRow:      { flexDirection: "row", gap: 10, paddingBottom: 4 },
  chip:         { backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, width: 148, borderWidth: 1, borderColor: "rgba(255,213,79,0.35)" },
  chipRef:      { opacity: 0.75, borderStyle: "dashed" },
  chipRefLabel: { fontSize: 9, color: "#ffd54f99", fontWeight: "700", letterSpacing: 0.5, marginBottom: 3 },
  chipVariety:  { color: "rgba(255,255,255,0.88)", fontSize: 13, fontWeight: "600" },
  chipPrice:    { color: "#ffd54f", fontSize: 20, fontWeight: "900", marginTop: 3 },
  chipSource:   { color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 6 },

  // Reference table — card list
  tableTitle:   { fontSize: 15, fontWeight: "800", color: Colors.text, marginTop: 18, marginBottom: 10 },
  card:         { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  cardTop:      { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  tag:          { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2 },
  tagText:      { fontSize: 11, fontWeight: "800" },
  cardName:     { fontSize: 15, fontWeight: "700", color: Colors.text, flex: 1, lineHeight: 21 },
  cardBottom:   { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  cardUse:      { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  cardRegion:   { fontSize: 12, color: Colors.accent, fontWeight: "600" },
  cardPriceWrap:{ alignItems: "flex-end", minWidth: 110 },
  cardPrice:    { fontSize: 15, fontWeight: "800", textAlign: "right", lineHeight: 20 },

  // Note
  note:         { backgroundColor: "#fff8e1", borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1, borderColor: "#ffe082" },
  noteText:     { fontSize: 12, color: "#bf360c", lineHeight: 19 },
});

// ── Screen Styles ────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  header: { backgroundColor: Colors.primary, paddingTop: Platform.OS === "ios" ? 54 : 32, paddingBottom: 14, paddingHorizontal: 16 },
  headerRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerSub:   { color: "rgba(255,255,255,.7)", fontSize: 12, marginTop: 3 },
  priceBox:    { backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minWidth: 140, borderWidth: 1, borderColor: "rgba(255,213,79,0.4)" },
  priceBoxTitle: { color: "#ffd54f", fontSize: 11, fontWeight: "700", marginBottom: 5 },
  priceRow:    { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  priceVariety:{ color: "rgba(255,255,255,0.85)", fontSize: 11 },
  priceValue:  { color: "#ffd54f", fontSize: 12, fontWeight: "700", marginLeft: 8 },

  searchRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput:  { flex: 1, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, color: "#fff", fontSize: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  searchClearBtn: { position: "absolute", right: 52, padding: 8 },
  searchClearText: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
  searchBtn:    { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  searchBtnText:{ fontSize: 18 },

  center:   { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadText: { marginTop: 12, color: Colors.textMuted, fontSize: 14 },
  errorText:{ color: "#e53e3e", fontSize: 14, textAlign: "center", marginBottom: 16 },
  retryBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryText:{ color: "#fff", fontWeight: "700" },
  list:     { flex: 1 },
  countText:{ fontSize: 12, color: Colors.textMuted, textAlign: "center", paddingVertical: 10 },
  searchErrorText: { fontSize: 13, color: Colors.textMuted, textAlign: "center", paddingVertical: 20 },

  card: { backgroundColor: "#fff", marginHorizontal: 14, marginBottom: 12, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardTop:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  badge:    { backgroundColor: Colors.primaryLt, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:{ fontSize: 11, color: Colors.primary, fontWeight: "600" },
  timeText: { fontSize: 11, color: Colors.textMuted },
  title:    { fontSize: 15, fontWeight: "700", color: Colors.text, lineHeight: 22, marginBottom: 6 },
  summary:  { fontSize: 13, color: Colors.textMuted, lineHeight: 19, marginBottom: 8 },
  readMore: { fontSize: 12, color: Colors.primary, fontWeight: "600" },
  emptyText:{ color: Colors.textMuted, fontSize: 14 },
});
