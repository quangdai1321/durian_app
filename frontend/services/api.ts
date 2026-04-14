import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = "http://localhost:8000/api"; // Change to your server IP

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem("access_token");
}

async function request<T>(
  method: string,
  path: string,
  body?: object,
  isFormData = false
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!isFormData ? { "Content-Type": "application/json" } : {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    // Preserve structured detail (e.g. { code, message, hint })
    const error: any = new Error(
      typeof err.detail === "string" ? err.detail : (err.detail?.message || "Request failed")
    );
    error.detail = err.detail; // attach original detail object
    throw error;
  }
  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────
export const authApi = {
  register: (data: {
    username: string; email: string; password: string;
    full_name?: string; phone?: string; province?: string;
  }) => request("POST", "/auth/register", data),

  login: async (username: string, password: string) => {
    const data: any = await request("POST", "/auth/login", { username, password });
    await AsyncStorage.setItem("access_token", data.access_token);
    await AsyncStorage.setItem("user", JSON.stringify(data.user));
    return data;
  },

  me: () => request("GET", "/auth/me"),

  updateProfile: (data: { full_name?: string; phone?: string; province?: string }) =>
    request("PATCH", "/auth/me", data),

  uploadAvatar: async (imageUri: string) => {
    const form = new FormData();
    if (typeof window !== "undefined" && imageUri.startsWith("data:")) {
      const [header, b64] = imageUri.split(",");
      const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
      const bytes = atob(b64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      form.append("file", new Blob([arr], { type: mime }), "avatar.jpg");
    } else {
      form.append("file", { uri: imageUri, name: "avatar.jpg", type: "image/jpeg" } as any);
    }
    return request("POST", "/auth/me/avatar", form, true);
  },

  logout: async () => {
    await AsyncStorage.multiRemove(["access_token", "user"]);
  },
};

// ── Diagnosis ────────────────────────────────────────────────
export const diagnosisApi = {
  diagnose: async (
    imageUri: string,
    opts: { latitude?: number; longitude?: number; province?: string; notes?: string } = {}
  ) => {
    const form = new FormData();
    if (typeof window !== "undefined" && imageUri.startsWith("data:")) {
      // Web: convert data URI to Blob
      const [header, b64] = imageUri.split(",");
      const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
      const bytes = atob(b64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: mime });
      form.append("file", blob, "leaf.jpg");
    } else {
      form.append("file", { uri: imageUri, name: "leaf.jpg", type: "image/jpeg" } as any);
    }
    if (opts.latitude)  form.append("latitude",  String(opts.latitude));
    if (opts.longitude) form.append("longitude", String(opts.longitude));
    if (opts.province)  form.append("province",  opts.province);
    if (opts.notes)     form.append("notes",      opts.notes);
    return request("POST", "/diagnoses", form, true);
  },

  list: (skip = 0, limit = 20) =>
    request("GET", `/diagnoses?skip=${skip}&limit=${limit}`),

  get: (id: string) =>
    request("GET", `/diagnoses/${id}`),

  feedback: (id: string, data: { actual_class?: string; rating: number; comment?: string }) =>
    request("POST", `/diagnoses/${id}/feedback`, data),
};

// ── Diseases ─────────────────────────────────────────────────
export const diseaseApi = {
  list: () => request("GET", "/diseases"),
  get:  (code: string) => request("GET", `/diseases/${code}`),
};

// ── Yield Stats ──────────────────────────────────────────────
export const yieldStatsApi = {
  /** Lấy danh sách bản ghi sản lượng từ server */
  get: (): Promise<{ records: any[] }> =>
    request("GET", "/auth/me/yield-stats"),

  /** Lưu toàn bộ danh sách lên server (replace-all) */
  set: (records: any[]): Promise<{ records: any[] }> =>
    request("PUT", "/auth/me/yield-stats", { records }),
};

// ── AI Chat (proxy qua backend — OpenAI key không lộ ở frontend) ──
export const chatApi = {
  /**
   * Gửi tin nhắn đến AI.
   * messages: [{ role: "system"|"user"|"assistant", content: string }]
   */
  chat: (
    messages: { role: string; content: string }[],
    options?: { max_tokens?: number; temperature?: number }
  ): Promise<{ choices: { message: { content: string } }[] }> =>
    request("POST", "/ai/chat", {
      messages,
      max_tokens:  options?.max_tokens  ?? 400,
      temperature: options?.temperature ?? 0.7,
    }),
};
