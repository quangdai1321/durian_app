import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, TextInput, KeyboardAvoidingView,
  Modal, Alert, FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { diseaseApi, chatApi } from "../../services/api";
import { Colors } from "../../constants/Colors";
import AuthGuard from "../../components/AuthGuard";

// ── expo-notifications (chỉ mobile, không có trên web) ────────────
let Notifications: any = null;
if (Platform.OS !== "web") {
  try { Notifications = require("expo-notifications"); } catch {}
}

// ── DateTimePicker (chỉ mobile) ──────────────────────────────────
let DateTimePicker: any = null;
if (Platform.OS !== "web") {
  try { DateTimePicker = require("@react-native-community/datetimepicker").default; } catch {}
}

// ── Cấu hình handler thông báo ──────────────────────────────────
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// ════════════════════════════════════════════════════════════════
//  REMINDER TYPES
// ════════════════════════════════════════════════════════════════
const TASK_TYPES = [
  { key: "phun_thuoc",  label: "Phun thuốc",        icon: "🌿" },
  { key: "bon_phan",    label: "Bón phân",           icon: "🌱" },
  { key: "tuoi_nuoc",  label: "Tưới nước",          icon: "💧" },
  { key: "lam_bong",   label: "Làm bông",           icon: "🌸" },
  { key: "don_la",     label: "Dọn lá",             icon: "🍃" },
  { key: "cat_tia",    label: "Cắt tỉa",            icon: "✂️" },
  { key: "kiem_tra",   label: "Kiểm tra sâu bệnh",  icon: "🔍" },
  { key: "thu_hoach",  label: "Thu hoạch",          icon: "🌾" },
  { key: "khac",       label: "Khác",               icon: "📝" },
];

const REPEAT_OPTIONS = [
  { key: "none",    label: "Không lặp" },
  { key: "daily",   label: "Mỗi ngày" },
  { key: "weekly",  label: "Mỗi tuần" },
  { key: "monthly", label: "Mỗi tháng" },
];

const REMIND_BEFORE = [
  { key: "0",    label: "Đúng giờ" },
  { key: "30",   label: "Trước 30 phút" },
  { key: "60",   label: "Trước 1 giờ" },
  { key: "1440", label: "Trước 1 ngày" },
];

type Reminder = {
  id: string;
  taskKey: string;
  taskLabel: string;
  taskIcon: string;
  customNote: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM
  repeat: string;
  remindBefore: string;
  notifId?: string;
  createdAt: string;
  done: boolean;
};

const STORAGE_KEY = "care_reminders";

function pad2(n: number) { return String(n).padStart(2, "0"); }

function formatDateVN(dateStr: string) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function getDateStr(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getCurrentTime() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ════════════════════════════════════════════════════════════════
//  REMINDER MODAL
// ════════════════════════════════════════════════════════════════
function ReminderModal({
  visible, onClose,
}: { visible: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"create" | "list">("create");

  // Form state
  const [taskKey,      setTaskKey]      = useState("phun_thuoc");
  const [customNote,   setCustomNote]   = useState("");
  const [date,         setDate]         = useState(getDateStr(0));
  const [time,         setTime]         = useState(() => {
    const d = new Date(); d.setMinutes(d.getMinutes() + 60);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  });
  const [repeat,       setRepeat]       = useState("none");
  const [remindBefore, setRemindBefore] = useState("30");
  const [saving,       setSaving]       = useState(false);
  const [formError,    setFormError]    = useState("");

  // Inline confirm states — không dùng window.confirm hay Alert (bị block trên web)
  const [confirmSave,     setConfirmSave]     = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // DateTimePicker state (mobile only)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Derive JS Date object from date + time strings
  const pickerDate = (() => {
    try {
      const [y, mo, d] = date.split("-").map(Number);
      const [h, mi]    = time.split(":").map(Number);
      return new Date(y, mo - 1, d, h, mi);
    } catch { return new Date(); }
  })();

  // List
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const loadReminders = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      setReminders(raw ? JSON.parse(raw) : []);
    } catch {}
  }, []);

  useEffect(() => { if (visible) { loadReminders(); setTab("create"); } }, [visible]);

  const selectedTask = TASK_TYPES.find(t => t.key === taskKey)!;

  // ── request notification permission ─────────────────────────
  async function requestPermission() {
    if (!Notifications) return true;
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  }

  // ── schedule local notification ──────────────────────────────
  async function scheduleNotification(r: Reminder): Promise<string | undefined> {
    if (!Notifications) return undefined;
    const [y, mo, d] = r.date.split("-").map(Number);
    const [h, mi]    = r.time.split(":").map(Number);
    const fireDate   = new Date(y, mo - 1, d, h, mi, 0);
    const offsetMs   = parseInt(r.remindBefore) * 60 * 1000;
    const triggerMs  = fireDate.getTime() - offsetMs - Date.now();
    if (triggerMs <= 0) return undefined;
    const triggerObj: any = r.repeat === "none"
      ? { seconds: Math.floor(triggerMs / 1000) }
      : r.repeat === "daily"   ? { hour: h, minute: mi, repeats: true }
      : r.repeat === "weekly"  ? { weekday: fireDate.getDay() + 1, hour: h, minute: mi, repeats: true }
      : { day: d, hour: h, minute: mi, repeats: true };
    try {
      return await Notifications.scheduleNotificationAsync({
        content: {
          title: `${r.taskIcon} ${r.taskLabel}`,
          body: r.customNote
            ? `📌 ${r.customNote}\n📅 ${formatDateVN(r.date)} ${r.time}`
            : `📅 ${formatDateVN(r.date)} lúc ${r.time}`,
          sound: true,
        },
        trigger: triggerObj,
      });
    } catch { return undefined; }
  }

  // ── validate → show inline confirm ──────────────────────────
  function handleSavePress() {
    setFormError("");
    if (!date || !time) { setFormError("Vui lòng chọn ngày và giờ."); return; }
    if (!/^\d{2}:\d{2}$/.test(time)) { setFormError("Giờ không hợp lệ. Dùng định dạng HH:MM (vd: 07:30)"); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setFormError("Ngày không hợp lệ. Dùng YYYY-MM-DD (vd: 2025-06-20)"); return; }
    setConfirmSave(true); // Hiện inline confirm — không dùng dialog
  }

  // ── thực sự lưu sau khi confirm ──────────────────────────────
  async function doSave() {
    setConfirmSave(false);
    setSaving(true);
    await requestPermission();

    const reminder: Reminder = {
      id: Date.now().toString(),
      taskKey,
      taskLabel: selectedTask.label,
      taskIcon:  selectedTask.icon,
      customNote,
      date,
      time,
      repeat,
      remindBefore,
      createdAt: new Date().toISOString(),
      done: false,
    };

    const notifId = await scheduleNotification(reminder);
    if (notifId) reminder.notifId = notifId;

    try {
      const raw  = await AsyncStorage.getItem(STORAGE_KEY);
      const list: Reminder[] = raw ? JSON.parse(raw) : [];
      list.unshift(reminder);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      setReminders(list);
    } catch (e) {
      console.warn("AsyncStorage save error:", e);
    }

    setSaving(false);
    setCustomNote("");
    setDate(getDateStr(0));
    setRepeat("none");
    setFormError("");
    setTab("list"); // Chuyển sang tab list sau khi lưu thành công
  }

  // ── xoá reminder ─────────────────────────────────────────────
  async function doDelete(id: string) {
    setConfirmDeleteId(null);
    const item = reminders.find(r => r.id === id);
    if (item?.notifId && Notifications) {
      try { await Notifications.cancelScheduledNotificationAsync(item.notifId); } catch {}
    }
    const next = reminders.filter(r => r.id !== id);
    setReminders(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn("AsyncStorage delete error:", e);
    }
  }

  // ── đánh dấu hoàn thành ──────────────────────────────────────
  async function handleToggleDone(id: string) {
    const next = reminders.map(r => r.id === id ? { ...r, done: !r.done } : r);
    setReminders(next);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  const DATE_QUICK = [
    { label: "Hôm nay",  offset: 0 },
    { label: "Ngày mai", offset: 1 },
    { label: "+3 ngày",  offset: 3 },
    { label: "+7 ngày",  offset: 7 },
    { label: "+14 ngày", offset: 14 },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={ms.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Modal header */}
        <View style={ms.modalHeader}>
          <View style={ms.mhLeft}>
            <Text style={ms.mhTitle}>📅 Nhắc lịch chăm sóc</Text>
            <Text style={ms.mhSub}>Plant Care Scheduler</Text>
          </View>
          <TouchableOpacity style={ms.closeBtn} onPress={onClose}>
            <Text style={ms.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={ms.tabBar}>
          <TouchableOpacity
            style={[ms.tabBtn, tab === "create" && ms.tabBtnActive]}
            onPress={() => { setTab("create"); setConfirmSave(false); }}
          >
            <Text style={[ms.tabBtnText, tab === "create" && ms.tabBtnTextActive]}>➕ Tạo lịch</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[ms.tabBtn, tab === "list" && ms.tabBtnActive]}
            onPress={() => { setTab("list"); loadReminders(); }}
          >
            <Text style={[ms.tabBtnText, tab === "list" && ms.tabBtnTextActive]}>
              📋 Lịch đã đặt {reminders.length > 0 ? `(${reminders.length})` : ""}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── TAB: TẠO LỊCH ── */}
        {tab === "create" && (
          <ScrollView style={ms.formScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Task type grid */}
            <Text style={ms.fieldLabel}>Loại công việc</Text>
            <View style={ms.taskGrid}>
              {TASK_TYPES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[ms.taskChip, taskKey === t.key && ms.taskChipActive]}
                  onPress={() => setTaskKey(t.key)}
                >
                  <Text style={ms.taskChipIcon}>{t.icon}</Text>
                  <Text style={[ms.taskChipLabel, taskKey === t.key && ms.taskChipLabelActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Ghi chú */}
            <Text style={ms.fieldLabel}>
              {taskKey === "khac" ? "Nội dung công việc *" : "Ghi chú thêm (tuỳ chọn)"}
            </Text>
            <TextInput
              style={ms.noteInput}
              value={customNote}
              onChangeText={setCustomNote}
              placeholder={taskKey === "khac" ? "Nhập nội dung công việc..." : "Ví dụ: Khu vực vườn A, liều lượng..."}
              placeholderTextColor="#aaa"
              multiline maxLength={200}
            />

            {/* ── Ngày thực hiện ── */}
            <Text style={ms.fieldLabel}>Ngày thực hiện</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ms.quickDateRow}>
              {DATE_QUICK.map(q => {
                const d = getDateStr(q.offset);
                return (
                  <TouchableOpacity
                    key={q.offset}
                    style={[ms.quickDateBtn, date === d && ms.quickDateBtnActive]}
                    onPress={() => { setDate(d); setShowDatePicker(false); }}
                  >
                    <Text style={[ms.quickDateBtnText, date === d && ms.quickDateBtnTextActive]}>{q.label}</Text>
                    <Text style={[ms.quickDateSub, date === d && { color: "#fff" }]}>{formatDateVN(d)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Hiển thị ngày đã chọn + nút mở picker (mobile) */}
            <TouchableOpacity
              style={ms.pickerTrigger}
              onPress={() => {
                if (Platform.OS !== "web") { setShowTimePicker(false); setShowDatePicker(v => !v); }
              }}
              activeOpacity={Platform.OS === "web" ? 1 : 0.7}
            >
              <Text style={ms.pickerTriggerIcon}>📅</Text>
              <Text style={ms.pickerTriggerValue}>{formatDateVN(date) || date}</Text>
              {Platform.OS !== "web"
                ? <Text style={ms.pickerTriggerHint}>Nhấn để chọn</Text>
                : <Text style={ms.pickerTriggerHint}>Dùng các nút trên hoặc nhập thủ công</Text>
              }
            </TouchableOpacity>

            {/* Mobile DatePicker */}
            {showDatePicker && DateTimePicker && Platform.OS !== "web" && (
              <DateTimePicker
                value={pickerDate} mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={new Date()}
                onChange={(_: any, sel?: Date) => {
                  if (Platform.OS === "android") setShowDatePicker(false);
                  if (sel) setDate(`${sel.getFullYear()}-${pad2(sel.getMonth()+1)}-${pad2(sel.getDate())}`);
                }}
                style={ms.nativePicker}
              />
            )}
            {Platform.OS === "ios" && showDatePicker && (
              <TouchableOpacity style={ms.pickerDoneBtn} onPress={() => setShowDatePicker(false)}>
                <Text style={ms.pickerDoneBtnText}>Xong ✓</Text>
              </TouchableOpacity>
            )}

            {/* Web: manual text input date */}
            {Platform.OS === "web" && (
              <TextInput
                style={ms.dateInput}
                value={date}
                onChangeText={v => setDate(v.replace(/[^\d-]/g, "").slice(0, 10))}
                placeholder="YYYY-MM-DD  (vd: 2026-06-20)"
                placeholderTextColor="#aaa"
                maxLength={10}
              />
            )}

            {/* ── Giờ thực hiện ── */}
            <Text style={ms.fieldLabel}>Giờ thực hiện</Text>
            <View style={ms.timeRow}>
              {["06:00","07:30","09:00","14:00","16:00","18:00"].map(t => (
                <TouchableOpacity
                  key={t}
                  style={[ms.timeChip, time === t && ms.timeChipActive]}
                  onPress={() => { setTime(t); setShowTimePicker(false); }}
                >
                  <Text style={[ms.timeChipText, time === t && ms.timeChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Hiển thị giờ đã chọn + nút mở picker (mobile) */}
            <TouchableOpacity
              style={ms.pickerTrigger}
              onPress={() => {
                if (Platform.OS !== "web") { setShowDatePicker(false); setShowTimePicker(v => !v); }
              }}
              activeOpacity={Platform.OS === "web" ? 1 : 0.7}
            >
              <Text style={ms.pickerTriggerIcon}>🕐</Text>
              <Text style={ms.pickerTriggerValue}>{time}</Text>
              {Platform.OS !== "web"
                ? <Text style={ms.pickerTriggerHint}>Nhấn để chọn</Text>
                : <Text style={ms.pickerTriggerHint}>Dùng các nút trên hoặc nhập thủ công</Text>
              }
            </TouchableOpacity>

            {/* Mobile TimePicker */}
            {showTimePicker && DateTimePicker && Platform.OS !== "web" && (
              <DateTimePicker
                value={pickerDate} mode="time" is24Hour
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(_: any, sel?: Date) => {
                  if (Platform.OS === "android") setShowTimePicker(false);
                  if (sel) setTime(`${pad2(sel.getHours())}:${pad2(sel.getMinutes())}`);
                }}
                style={ms.nativePicker}
              />
            )}
            {Platform.OS === "ios" && showTimePicker && (
              <TouchableOpacity style={ms.pickerDoneBtn} onPress={() => setShowTimePicker(false)}>
                <Text style={ms.pickerDoneBtnText}>Xong ✓</Text>
              </TouchableOpacity>
            )}

            {/* Web: manual text input time */}
            {Platform.OS === "web" && (
              <TextInput
                style={ms.dateInput}
                value={time}
                onChangeText={v => setTime(v.replace(/[^\d:]/g, "").slice(0, 5))}
                placeholder="HH:MM  (vd: 07:30)"
                placeholderTextColor="#aaa"
                maxLength={5}
              />
            )}

            {/* Lặp lại */}
            <Text style={ms.fieldLabel}>Lặp lại</Text>
            <View style={ms.repeatRow}>
              {REPEAT_OPTIONS.map(r => (
                <TouchableOpacity
                  key={r.key}
                  style={[ms.repeatChip, repeat === r.key && ms.repeatChipActive]}
                  onPress={() => setRepeat(r.key)}
                >
                  <Text style={[ms.repeatChipText, repeat === r.key && ms.repeatChipTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Nhắc trước */}
            <Text style={ms.fieldLabel}>Nhắc trước</Text>
            <View style={ms.repeatRow}>
              {REMIND_BEFORE.map(r => (
                <TouchableOpacity
                  key={r.key}
                  style={[ms.repeatChip, remindBefore === r.key && ms.repeatChipActive]}
                  onPress={() => setRemindBefore(r.key)}
                >
                  <Text style={[ms.repeatChipText, remindBefore === r.key && ms.repeatChipTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Lỗi form */}
            {formError ? (
              <View style={ms.formErrorBox}>
                <Text style={ms.formErrorText}>⚠️ {formError}</Text>
              </View>
            ) : null}

            {/* ── Inline confirm card (thay thế cho dialog) ── */}
            {confirmSave ? (
              <View style={ms.confirmCard}>
                <Text style={ms.confirmTitle}>Xác nhận lưu lịch nhắc?</Text>
                <View style={ms.confirmPreviewRow}>
                  <Text style={{ fontSize: 28 }}>{selectedTask.icon}</Text>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={ms.confirmTaskName}>{selectedTask.label}</Text>
                    {customNote ? <Text style={ms.confirmNote}>{customNote}</Text> : null}
                    <Text style={ms.confirmDate}>📅 {formatDateVN(date)} lúc {time}</Text>
                    <Text style={ms.confirmRepeat}>
                      🔁 {REPEAT_OPTIONS.find(r => r.key === repeat)?.label}
                      {"  "}🔔 {REMIND_BEFORE.find(r => r.key === remindBefore)?.label}
                    </Text>
                  </View>
                </View>
                <View style={ms.confirmBtnRow}>
                  <TouchableOpacity style={ms.confirmCancelBtn} onPress={() => setConfirmSave(false)}>
                    <Text style={ms.confirmCancelText}>← Sửa lại</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[ms.confirmOkBtn, saving && ms.saveBtnDisabled]}
                    onPress={doSave}
                    disabled={saving}
                  >
                    {saving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={ms.confirmOkText}>✅ Lưu ngay</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Nút Lưu bình thường */
              <TouchableOpacity
                style={[ms.saveBtn, saving && ms.saveBtnDisabled]}
                onPress={handleSavePress}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={ms.saveBtnText}>✅ Lưu lịch nhắc</Text>
                }
              </TouchableOpacity>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ── TAB: LỊCH ĐÃ ĐẶT ── */}
        {tab === "list" && (
          <View style={{ flex: 1 }}>
            {reminders.length === 0 ? (
              <View style={ms.emptyBox}>
                <Text style={ms.emptyIcon}>📅</Text>
                <Text style={ms.emptyText}>Chưa có lịch nhắc nào</Text>
                <Text style={ms.emptySubText}>Tạo lịch mới để bắt đầu theo dõi chăm sóc cây</Text>
                <TouchableOpacity style={ms.emptyBtn} onPress={() => setTab("create")}>
                  <Text style={ms.emptyBtnText}>➕ Tạo lịch ngay</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={reminders}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                ListHeaderComponent={
                  <Text style={ms.listHeader}>
                    {reminders.filter(r => !r.done).length} chưa hoàn thành  ·  {reminders.filter(r => r.done).length} đã xong
                  </Text>
                }
                renderItem={({ item }) => (
                  <View style={[ms.reminderCard, item.done && ms.reminderCardDone]}>
                    <View style={ms.reminderLeft}>
                      <Text style={ms.reminderIcon}>{item.taskIcon}</Text>
                    </View>
                    <View style={ms.reminderBody}>
                      <Text style={[ms.reminderTitle, item.done && ms.strikeThroughText]}>
                        {item.taskLabel}
                      </Text>
                      {item.customNote ? <Text style={ms.reminderNote} numberOfLines={2}>{item.customNote}</Text> : null}
                      <Text style={ms.reminderDate}>📅 {formatDateVN(item.date)} lúc {item.time}</Text>
                      <View style={ms.reminderBadgeRow}>
                        <View style={ms.reminderBadge}>
                          <Text style={ms.reminderBadgeText}>{REPEAT_OPTIONS.find(r => r.key === item.repeat)?.label}</Text>
                        </View>
                        <View style={[ms.reminderBadge, { backgroundColor: "#e3f2fd" }]}>
                          <Text style={[ms.reminderBadgeText, { color: Colors.info }]}>
                            {REMIND_BEFORE.find(r => r.key === item.remindBefore)?.label}
                          </Text>
                        </View>
                        {item.notifId && (
                          <View style={[ms.reminderBadge, { backgroundColor: "#e8f5e9" }]}>
                            <Text style={[ms.reminderBadgeText, { color: Colors.success }]}>🔔 Đã lên lịch</Text>
                          </View>
                        )}
                      </View>

                      {/* Inline delete confirm */}
                      {confirmDeleteId === item.id && (
                        <View style={ms.inlineDeleteConfirm}>
                          <Text style={ms.inlineDeleteText}>Xác nhận xoá lịch này?</Text>
                          <View style={ms.inlineDeleteBtns}>
                            <TouchableOpacity style={ms.inlineDeleteCancel} onPress={() => setConfirmDeleteId(null)}>
                              <Text style={ms.inlineDeleteCancelText}>Huỷ</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={ms.inlineDeleteOk} onPress={() => doDelete(item.id)}>
                              <Text style={ms.inlineDeleteOkText}>🗑 Xoá</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                    <View style={ms.reminderActions}>
                      <TouchableOpacity
                        style={[ms.doneBtn, item.done && ms.doneBtnActive]}
                        onPress={() => handleToggleDone(item.id)}
                      >
                        <Text style={[ms.doneBtnText, item.done && ms.doneBtnTextActive]}>
                          {item.done ? "↩" : "✓"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[ms.delBtn, confirmDeleteId === item.id && { backgroundColor: "#ffcdd2" }]}
                        onPress={() => setConfirmDeleteId(confirmDeleteId === item.id ? null : item.id)}
                      >
                        <Text style={ms.delBtnText}>🗑</Text>
                      </TouchableOpacity>
                            ]);
                          }
                        }}
                      >
                        <Text style={ms.delBtnText}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════
//  MARKDOWN TEXT
// ════════════════════════════════════════════════════════════════
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
                p.bold   && { fontWeight: "700" },
                p.italic && { fontStyle: "italic" },
                p.code   && { fontFamily: "monospace", backgroundColor: "#f0f0f0", borderRadius: 3, fontSize: 11 },
              ]}>{p.text}</Text>
            ))}
          </Text>
        );
      })}
    </View>
  );
}

// ════════════════════════════════════════════════════════════════
//  CONSTANTS
// ════════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ════════════════════════════════════════════════════════════════
export default function TreatmentScreen() {
  const router = useRouter();
  const [disease,  setDisease]  = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [allList,  setAllList]  = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [showReminder, setShowReminder] = useState(false);

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
    <AuthGuard>
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        {/* Spacer left — cân bằng */}
        <View style={styles.headerRight} />

        {/* Title — center */}
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>💊 Hướng xử lý bệnh</Text>
          <Text style={styles.headerSub}>Treatment Guide</Text>
        </View>

        {/* 📅 Nhắc lịch — góc phải */}
        <TouchableOpacity style={styles.reminderBtn} onPress={() => setShowReminder(true)}>
          <Text style={styles.reminderBtnIcon}>📅</Text>
          <Text style={styles.reminderBtnLabel}>Nhắc lịch</Text>
        </TouchableOpacity>
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
        {disease && (
          <>
            {/* Hero card — tên bệnh hàng ngang để tiết kiệm diện tích */}
            <View style={styles.heroCard}>
              <View style={styles.heroLeft}>
                {/* Hàng ngang: Tên VN · Tên EN · Tên khoa học */}
                <View style={styles.heroNameRow}>
                  <Text style={styles.diseaseName}>{disease.name_vi}</Text>
                  {disease.name_en && (
                    <>
                      <Text style={styles.heroSep}> · </Text>
                      <Text style={styles.diseaseName2}>{disease.name_en}</Text>
                    </>
                  )}
                  {disease.scientific && (
                    <>
                      <Text style={styles.heroSep}> · </Text>
                      <Text style={styles.sciName}>{disease.scientific}</Text>
                    </>
                  )}
                </View>
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

        {/* ── AI Chat Box ── */}
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

      {/* Reminder Modal */}
      <ReminderModal visible={showReminder} onClose={() => setShowReminder(false)} />
    </KeyboardAvoidingView>
    </AuthGuard>
  );
}

// ════════════════════════════════════════════════════════════════
//  STYLES — MAIN SCREEN
// ════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.white },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
  header: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === "ios" ? 54 : 32,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  reminderBtn: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 68,
  },
  reminderBtnIcon:  { fontSize: 20 },
  reminderBtnLabel: { color: "#fff", fontSize: 10, fontWeight: "700", marginTop: 2 },
  headerCenter:  { flex: 1, alignItems: "center" },
  headerTitle:   { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerSub:     { color: "rgba(255,255,255,.7)", fontSize: 11, marginTop: 2 },
  headerRight:   { minWidth: 68 },

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
  // Tên bệnh hàng ngang
  heroNameRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 0 },
  heroSep:     { fontSize: 14, color: Colors.border, fontWeight: "400" },
  diseaseName: { fontSize: 17, fontWeight: "800", color: Colors.primary },
  diseaseName2:{ fontSize: 13, color: Colors.secondary, fontWeight: "500" },
  sciName:     { fontSize: 12, color: Colors.accent, fontStyle: "italic" },
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

// ════════════════════════════════════════════════════════════════
//  STYLES — REMINDER MODAL
// ════════════════════════════════════════════════════════════════
const ms = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },

  modalHeader: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === "ios" ? 20 : 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mhLeft:    { flex: 1 },
  mhTitle:   { color: "#fff", fontSize: 18, fontWeight: "700" },
  mhSub:     { color: "rgba(255,255,255,.7)", fontSize: 12, marginTop: 2 },
  closeBtn:  {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
  },
  closeBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  tabBar: {
    flexDirection: "row",
    backgroundColor: Colors.bg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tabBtn: {
    flex: 1, paddingVertical: 12, alignItems: "center",
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabBtnActive:     { borderBottomColor: Colors.primary },
  tabBtnText:       { fontSize: 13, fontWeight: "600", color: Colors.textMuted },
  tabBtnTextActive: { color: Colors.primary },

  // Form
  formScroll: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  fieldLabel: {
    fontSize: 13, fontWeight: "700", color: Colors.text,
    marginBottom: 10, marginTop: 14,
  },

  // Task type grid
  taskGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
  },
  taskChip: {
    flexBasis: "30%", flexGrow: 1,
    alignItems: "center", paddingVertical: 10,
    backgroundColor: Colors.bg, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  taskChipActive: {
    backgroundColor: Colors.primaryLt,
    borderColor: Colors.primary,
  },
  taskChipIcon:  { fontSize: 22, marginBottom: 4 },
  taskChipLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: "600", textAlign: "center" },
  taskChipLabelActive: { color: Colors.primary },

  // Note
  noteInput: {
    backgroundColor: Colors.bg, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 13, color: Colors.text, minHeight: 60,
    textAlignVertical: "top",
  },

  // Date/time picker trigger button
  pickerTrigger: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.primaryLt,
    borderRadius: 12, borderWidth: 1.5, borderColor: "#a5d6a7",
    paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 4,
  },
  pickerTriggerIcon:  { fontSize: 20 },
  pickerTriggerValue: { flex: 1, fontSize: 16, fontWeight: "700", color: Colors.primary },
  pickerTriggerHint:  { fontSize: 11, color: Colors.textMuted },
  // Web: TextInput behaves like <input type="date/time"> — remove default border/bg
  webDateInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: "transparent",
    padding: 0,
  } as any,

  // Native DateTimePicker (iOS spinner style)
  nativePicker: {
    backgroundColor: "#fff",
    width: "100%",
  },

  // iOS "Xong" button after spinner
  pickerDoneBtn: {
    alignSelf: "flex-end", marginBottom: 8,
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  pickerDoneBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Date quick select
  quickDateRow: { marginBottom: 8 },
  quickDateBtn: {
    alignItems: "center", paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.bg, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border,
    marginRight: 8,
  },
  quickDateBtnActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  quickDateBtnText:      { fontSize: 12, fontWeight: "700", color: Colors.text },
  quickDateBtnTextActive:{ color: "#fff" },
  quickDateSub:          { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  dateInput: {
    backgroundColor: Colors.bg, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: Colors.text, marginTop: 4,
    fontWeight: "600",
  },

  // Time quick chips
  timeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  timeChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.bg, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  timeChipActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timeChipText:      { fontSize: 13, fontWeight: "700", color: Colors.text },
  timeChipTextActive:{ color: "#fff" },

  // Repeat & remind before chips
  repeatRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  repeatChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.bg, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  repeatChipActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  repeatChipText:      { fontSize: 12, fontWeight: "600", color: Colors.textMuted },
  repeatChipTextActive:{ color: "#fff" },

  // Preview card
  previewCard: {
    marginTop: 18, backgroundColor: Colors.primaryLt,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#c8e6c9",
  },
  previewTitle: { fontSize: 11, fontWeight: "700", color: Colors.primary, marginBottom: 10, textTransform: "uppercase" },
  previewRow:   { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  previewIcon:  { fontSize: 32 },
  previewTaskName: { fontSize: 15, fontWeight: "800", color: Colors.primary },
  previewNote:     { fontSize: 12, color: Colors.text, marginTop: 2 },
  previewDate:     { fontSize: 12, color: Colors.secondary, marginTop: 4, fontWeight: "600" },
  previewRepeat:   { fontSize: 11, color: Colors.textMuted, marginTop: 3 },

  // Save button
  saveBtn: {
    marginTop: 20, backgroundColor: Colors.primary,
    borderRadius: 14, padding: 16, alignItems: "center",
  },
  saveBtnDisabled: { backgroundColor: "#aaa" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // List
  listHeader: {
    fontSize: 13, color: Colors.textMuted, fontWeight: "600",
    marginBottom: 12,
  },
  emptyBox: {
    flex: 1, justifyContent: "center", alignItems: "center",
    paddingTop: 60, paddingHorizontal: 30,
  },
  emptyIcon:    { fontSize: 56, marginBottom: 16 },
  emptyText:    { fontSize: 18, fontWeight: "700", color: Colors.text, marginBottom: 8 },
  emptySubText: { fontSize: 13, color: Colors.textMuted, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  emptyBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Reminder card
  reminderCard: {
    backgroundColor: "#fff", borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, marginBottom: 12,
    flexDirection: "row", gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  reminderCardDone: { opacity: 0.55, backgroundColor: Colors.bg },
  reminderLeft:  { justifyContent: "center" },
  reminderIcon:  { fontSize: 32 },
  reminderBody:  { flex: 1 },
  reminderTitle: { fontSize: 15, fontWeight: "700", color: Colors.text, marginBottom: 2 },
  strikeThroughText: { textDecorationLine: "line-through", color: Colors.textMuted },
  reminderNote:  { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  reminderDate:  { fontSize: 12, fontWeight: "600", color: Colors.primary, marginBottom: 6 },
  reminderBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reminderBadge: {
    backgroundColor: Colors.primaryLt, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  reminderBadgeText: { fontSize: 10, fontWeight: "600", color: Colors.secondary },

  reminderActions: { justifyContent: "center", gap: 8 },
  doneBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.bg, borderWidth: 1.5, borderColor: Colors.border,
    justifyContent: "center", alignItems: "center",
  },
  doneBtnActive:     { backgroundColor: Colors.success, borderColor: Colors.success },
  doneBtnText:       { fontSize: 16, color: Colors.textMuted, fontWeight: "700" },
  doneBtnTextActive: { color: "#fff" },
  delBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#fff0f0", borderWidth: 1.5, borderColor: "#ffcdd2",
    justifyContent: "center", alignItems: "center",
  },
  delBtnText: { fontSize: 16 },
});
