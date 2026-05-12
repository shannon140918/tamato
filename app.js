const BASE_STORAGE_KEY = "daily-focus-app-v1";
const AUTH_USERS_KEY = "daily-focus-users-v1";
const AUTH_SESSION_KEY = "daily-focus-session-v1";
const AI_CONFIG_KEY = "daily-focus-ai-config-v1";
const BACKEND_STATE_URL = "/api/state";
const ACCOUNT_STATE_API_PREFIX = "/api/accounts";
const JAVA_AUTH_BASE_URL = "http://127.0.0.1:8787";
const DEFAULT_AI_MODEL = "qwen3-vl-plus";
const DEFAULT_AI_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_AI_API_MODE = "chat";
const MODES = {
  focus: { label: "专注挑战", minutesKey: "focusMinutes", next: "short" },
  short: { label: "短休息", minutesKey: "shortMinutes", next: "focus" },
  long: { label: "长休息", minutesKey: "longMinutes", next: "focus" },
};
const GOAL_REWARDS = {
  daily: 1,
  weekly: 3,
  monthly: 8,
};
const GOAL_LABELS = {
  weekly: "每周目标",
  monthly: "每月目标",
};
const DEFAULT_MISTAKE_TIP_PAGES = [
  {
    subject: "语文",
    tips: ["审题先圈关键词，别漏掉“为什么”“怎样”。", "阅读题先回到原文找依据，再组织答案。", "作文开头点题，结尾再扣题。"],
  },
  {
    subject: "数学",
    tips: ["计算前看清单位，写完检查符号和小数点。", "应用题先画数量关系，再列式。", "几何题先标已知条件，别凭感觉作答。"],
  },
  {
    subject: "英语",
    tips: ["单词拼写注意大小写和复数形式。", "做阅读先看题目，再回文章定位答案。", "写句子先检查主语、动词和时态。"],
  },
];

const todayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const $ = (selector) => document.querySelector(selector);
let currentUser = loadCurrentUser();
const state = loadState();
let timer = null;
let mode = "focus";
let remainingSeconds = state.settings.focusMinutes * 60;
let totalSeconds = remainingSeconds;
let isRunning = false;
let toastTimer = null;
let backendSaveTimer = null;
let deleteAccountConfirmTimer = null;
let pendingDeleteAccountPhone = "";
let cropDrag = null;
let selectedPlanDate = todayKey();
let calendarCursor = new Date();
let mistakeTipIndex = 0;
let activeMistakeTodoId = "";

const elements = {
  authScreen: $("#authScreen"),
  loginTab: $("#loginTab"),
  registerTab: $("#registerTab"),
  authForm: $("#authForm"),
  authPhone: $("#authPhone"),
  authPassword: $("#authPassword"),
  authSubmit: $("#authSubmit"),
  authMessage: $("#authMessage"),
  profileAvatarBtn: $("#profileAvatarBtn"),
  profileModal: $("#profileModal"),
  closeProfileModal: $("#closeProfileModal"),
  profilePhone: $("#profilePhone"),
  profileStatus: $("#profileStatus"),
  profileTodoCount: $("#profileTodoCount"),
  profileStars: $("#profileStars"),
  profileReminderCount: $("#profileReminderCount"),
  profilePlanCount: $("#profilePlanCount"),
  profileGoalCount: $("#profileGoalCount"),
  profileScholarship: $("#profileScholarship"),
  profileDataFile: $("#profileDataFile"),
  profileLogoutBtn: $("#profileLogoutBtn"),
  accountBtn: $("#accountBtn"),
  deleteAccountBtn: $("#deleteAccountBtn"),
  accountPhone: $("#accountPhone"),
  weekday: $("#weekday"),
  todayDate: $("#todayDate"),
  aiSettingsBtn: $("#aiSettingsBtn"),
  aiStatusText: $("#aiStatusText"),
  dateJumpBtn: $("#dateJumpBtn"),
  starJumpBtn: $("#starJumpBtn"),
  workspace: $(".workspace"),
  calendarPage: $("#calendarPage"),
  wishPage: $("#wishPage"),
  timerModeLabel: $("#timerModeLabel"),
  pomodoroCount: $("#pomodoroCount"),
  timeDisplay: $("#timeDisplay"),
  timerStatus: $("#timerStatus"),
  focusStars: $("#focusStars"),
  focusMessage: $("#focusMessage"),
  progressRing: $("#progressRing"),
  startPauseBtn: $("#startPauseBtn"),
  resetBtn: $("#resetBtn"),
  skipBtn: $("#skipBtn"),
  focusMinutes: $("#focusMinutes"),
  shortMinutes: $("#shortMinutes"),
  longMinutes: $("#longMinutes"),
  mistakeTips: $("#mistakeTips"),
  mistakeSubject: $("#mistakeSubject"),
  mistakePage: $("#mistakePage"),
  mistakeTipList: $("#mistakeTipList"),
  todoForm: $("#todoForm"),
  todoInput: $("#todoInput"),
  todoMinutes: $("#todoMinutes"),
  todoList: $("#todoList"),
  todoSummary: $("#todoSummary"),
  emptyTodos: $("#emptyTodos"),
  openPlanFromGoal: $("#openPlanFromGoal"),
  homeGoalList: $("#homeGoalList"),
  emptyHomeGoals: $("#emptyHomeGoals"),
  homeWishCard: $("#homeWishCard"),
  homeWishName: $("#homeWishName"),
  emptyHomeWish: $("#emptyHomeWish"),
  reminderForm: $("#reminderForm"),
  reminderText: $("#reminderText"),
  reminderTime: $("#reminderTime"),
  reminderList: $("#reminderList"),
  emptyReminders: $("#emptyReminders"),
  goalSummary: $("#goalSummary"),
  goalList: $("#goalList"),
  rewardList: $("#rewardList"),
  emptyGoals: $("#emptyGoals"),
  emptyRewards: $("#emptyRewards"),
  scholarshipBalance: $("#scholarshipBalance"),
  wishForm: $("#wishForm"),
  wishTitle: $("#wishTitle"),
  wishCost: $("#wishCost"),
  wishList: $("#wishList"),
  emptyWishes: $("#emptyWishes"),
  scholarshipForm: $("#scholarshipForm"),
  scholarshipRate: $("#scholarshipRate"),
  scholarshipStars: $("#scholarshipStars"),
  scholarshipList: $("#scholarshipList"),
  emptyScholarship: $("#emptyScholarship"),
  calendarMonth: $("#calendarMonth"),
  calendarGrid: $("#calendarGrid"),
  prevMonthBtn: $("#prevMonthBtn"),
  nextMonthBtn: $("#nextMonthBtn"),
  selectedPlanDate: $("#selectedPlanDate"),
  studyForm: $("#studyForm"),
  studyTitle: $("#studyTitle"),
  studyMinutes: $("#studyMinutes"),
  studyNote: $("#studyNote"),
  studyPlanList: $("#studyPlanList"),
  emptyStudyPlans: $("#emptyStudyPlans"),
  notifyBtn: $("#notifyBtn"),
  toast: $("#toast"),
  alarmSound: $("#alarmSound"),
  aiConfigModal: $("#aiConfigModal"),
  closeAiConfig: $("#closeAiConfig"),
  aiApiKeyInput: $("#aiApiKeyInput"),
  aiModelInput: $("#aiModelInput"),
  aiBaseUrlInput: $("#aiBaseUrlInput"),
  aiApiModeInput: $("#aiApiModeInput"),
  saveAiConfig: $("#saveAiConfig"),
  clearAiConfig: $("#clearAiConfig"),
  mistakeResultModal: $("#mistakeResultModal"),
  closeMistakeResult: $("#closeMistakeResult"),
  mistakeResultTitle: $("#mistakeResultTitle"),
  mistakeResultImage: $("#mistakeResultImage"),
  mistakeImageTools: $("#mistakeImageTools"),
  rotateMistakeLeft: $("#rotateMistakeLeft"),
  rotateMistakeRight: $("#rotateMistakeRight"),
  enhanceMistakeImage: $("#enhanceMistakeImage"),
  restoreMistakeImage: $("#restoreMistakeImage"),
  mistakeImageEditor: $("#mistakeImageEditor"),
  mistakeBrightness: $("#mistakeBrightness"),
  mistakeContrast: $("#mistakeContrast"),
  mistakeSharpness: $("#mistakeSharpness"),
  applyMistakeEdit: $("#applyMistakeEdit"),
  mistakeCropRatio: $("#mistakeCropRatio"),
  cropMistakeImage: $("#cropMistakeImage"),
  mistakeImagePreviewModal: $("#mistakeImagePreviewModal"),
  mistakeCropStage: $("#mistakeCropStage"),
  mistakeCropBox: $("#mistakeCropBox"),
  previewCropRatio: $("#previewCropRatio"),
  applyPreviewCrop: $("#applyPreviewCrop"),
  resetPreviewCrop: $("#resetPreviewCrop"),
  mistakeImagePreview: $("#mistakeImagePreview"),
  closeMistakeImagePreview: $("#closeMistakeImagePreview"),
  mistakeRecognizedText: $("#mistakeRecognizedText"),
  mistakeSummaryText: $("#mistakeSummaryText"),
  mistakeSimilarList: $("#mistakeSimilarList"),
  reanalyzeMistake: $("#reanalyzeMistake"),
  retakeMistakePhoto: $("#retakeMistakePhoto"),
};

function reportStartupError(error) {
  console.error(error);
  const message = error instanceof Error ? error.message : String(error);
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;border:1px solid #fecaca;border-radius:16px;background:#fff1f2;color:#991b1b;padding:14px 16px;font-weight:800;line-height:1.5;box-shadow:0 12px 32px rgba(17,24,39,.16);";
  box.textContent = `页面启动失败：${message}`;
  document.body.append(box);
}

function createDefaultState() {
  return {
    date: todayKey(),
    todos: [],
    reminders: [],
    studyPlans: [],
    goals: [],
    rewards: [],
    wishes: [],
    scholarship: {
      balance: 0,
      rate: 10,
      records: [],
    },
    activeTodoId: "",
    completedPomodoros: 0,
    focusStars: 0,
    settings: {
      focusMinutes: 25,
      shortMinutes: 5,
      longMinutes: 15,
    },
    mistakeTips: DEFAULT_MISTAKE_TIP_PAGES.map((page) => ({
      subject: page.subject,
      tips: [...page.tips],
    })),
  };
}

function readAuthUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(AUTH_USERS_KEY));
    return users && typeof users === "object" ? users : {};
  } catch {
    return {};
  }
}

function saveAuthUsers(users) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function loadCurrentUser() {
  try {
    const saved = localStorage.getItem(AUTH_SESSION_KEY);
    if (!saved) return null;
    if (saved.trim().startsWith("{")) {
      const session = JSON.parse(saved);
      const phone = normalizePhone(session.phone);
      const token = String(session.token || "").trim();
      return phone && token ? { phone, token } : null;
    }
    return null;
  } catch {
    return null;
  }
}

function getStateStorageKey() {
  return currentUser ? `${BASE_STORAGE_KEY}:${currentUser.phone}` : BASE_STORAGE_KEY;
}

function canUseLocalBackend() {
  return location.protocol.startsWith("http") && /^(127\.0\.0\.1|localhost)$/i.test(location.hostname);
}

function getBackendStateUrl() {
  if (currentUser) return `${JAVA_AUTH_BASE_URL}${ACCOUNT_STATE_API_PREFIX}/${encodeURIComponent(currentUser.phone)}/state`;
  return BACKEND_STATE_URL;
}

function getAuthHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (currentUser?.token) headers.Authorization = `Bearer ${currentUser.token}`;
  return headers;
}

async function requestJavaApi(path, options = {}) {
  const url = `${JAVA_AUTH_BASE_URL}${path}`;
  const method = options.method || "GET";
  const requestBody = options.body ? JSON.parse(options.body) : null;
  const requestLog = {
    url,
    method,
    headers: options.headers || {},
    body: requestBody,
  };
  console.log("[Java接口请求]", JSON.stringify(requestLog, null, 2));

  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  const responseLog = {
    url,
    method,
    status: response.status,
    ok: response.ok,
    body: payload,
  };
  console.log("[Java接口返回]", JSON.stringify(responseLog, null, 2));

  if (!response.ok) {
    throw new Error(payload?.error?.message || `接口请求失败：${response.status}`);
  }
  return payload;
}

function setAuthMode(mode) {
  const isRegister = mode === "register";
  elements.loginTab.classList.toggle("active", !isRegister);
  elements.registerTab.classList.toggle("active", isRegister);
  elements.authSubmit.textContent = isRegister ? "注册并登录" : "登录";
  elements.authForm.dataset.mode = isRegister ? "register" : "login";
  elements.authPassword.autocomplete = isRegister ? "new-password" : "current-password";
  elements.authMessage.textContent = "";
}

function showAuthMessage(message) {
  elements.authMessage.textContent = message;
}

function loadSignedInState() {
  const nextState = loadState();
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, nextState);
}

function finishAuth(authPayload) {
  currentUser = {
    phone: authPayload.phone,
    token: authPayload.token,
  };
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(currentUser));
  loadSignedInState();
  elements.authPhone.value = "";
  elements.authPassword.value = "";
  renderAuthState();
  syncSettingsInputs();
  renderAll();
  loadBackendState();
  showToast("已登录。");
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  try {
    const mode = elements.authForm.dataset.mode || "login";
    const phone = normalizePhone(elements.authPhone.value);
    const password = elements.authPassword.value;

    if (!/^1\d{10}$/.test(phone)) {
      showAuthMessage("请输入有效的11位手机号。");
      return;
    }
    if (password.length < 6) {
      showAuthMessage("密码至少需要6位。");
      return;
    }

    const authPayload = await requestJavaApi(mode === "register" ? "/api/auth/register" : "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });

    if (mode === "register") {
      const users = readAuthUsers();
      users[phone] = {
        phone,
        password,
        createdAt: new Date().toISOString(),
      };
      saveAuthUsers(users);
    }

    finishAuth(authPayload);
  } catch (error) {
    console.error(error);
    showAuthMessage(error instanceof Error ? error.message : "登录注册接口请求失败。");
  }
}

function logout() {
  resetDeleteAccountConfirm();
  closeProfileModal();
  localStorage.removeItem(AUTH_SESSION_KEY);
  currentUser = null;
  loadSignedInState();
  setAuthMode("login");
  renderAuthState();
  syncSettingsInputs();
  renderAll();
}

function resetDeleteAccountConfirm() {
  clearTimeout(deleteAccountConfirmTimer);
  deleteAccountConfirmTimer = null;
  pendingDeleteAccountPhone = "";
  if (!elements?.deleteAccountBtn) return;
  elements.deleteAccountBtn.classList.remove("confirming");
  elements.deleteAccountBtn.querySelector("strong").textContent = "注销";
  elements.deleteAccountBtn.querySelector("small").textContent = "删除本地数据";
}

function deleteCurrentAccount() {
  if (!currentUser) {
    showToast("请先登录账号。");
    return;
  }

  const phone = currentUser.phone;
  if (pendingDeleteAccountPhone !== phone) {
    pendingDeleteAccountPhone = phone;
    elements.deleteAccountBtn.classList.add("confirming");
    elements.deleteAccountBtn.querySelector("strong").textContent = "确认注销";
    elements.deleteAccountBtn.querySelector("small").textContent = "再次点击";
    showToast(`再次点击“确认注销”将删除账号 ${phone}。`);
    clearTimeout(deleteAccountConfirmTimer);
    deleteAccountConfirmTimer = setTimeout(resetDeleteAccountConfirm, 6000);
    return;
  }

  resetDeleteAccountConfirm();
  deleteBackendAccountState(phone)
    .then(() => {
      const users = readAuthUsers();
      delete users[phone];
      saveAuthUsers(users);
      localStorage.removeItem(AUTH_SESSION_KEY);
      localStorage.removeItem(`${BASE_STORAGE_KEY}:${phone}`);
      currentUser = null;
      loadSignedInState();
      setAuthMode("login");
      renderAuthState();
      syncSettingsInputs();
      renderAll();
      showAuthMessage("账号已注销，请重新注册或登录。");
    })
    .catch((error) => {
      console.error(error);
      showToast(error instanceof Error ? error.message : "注销接口请求失败。");
    });
}

function renderAuthState() {
  const isSignedIn = Boolean(currentUser);
  elements.authScreen.hidden = isSignedIn;
  document.body.classList.toggle("auth-locked", !isSignedIn);
  elements.accountPhone.textContent = isSignedIn ? currentUser.phone : "未登录";
  elements.deleteAccountBtn.disabled = !isSignedIn;
  elements.profileAvatarBtn.disabled = !isSignedIn;
  renderProfileInfo();
}

function openProfileModal() {
  if (!currentUser) {
    showToast("请先登录账号。");
    return;
  }
  renderProfileInfo();
  elements.profileModal.hidden = false;
}

function closeProfileModal() {
  if (elements.profileModal) elements.profileModal.hidden = true;
}

function renderProfileInfo() {
  if (!elements.profilePhone) return;
  const isSignedIn = Boolean(currentUser);
  const todoTotal = state.todos.length;
  const todoDone = state.todos.filter((todo) => todo.done).length;
  const todayPlans = state.studyPlans.filter((plan) => plan.date === todayKey()).length;
  const dataFile = isSignedIn
    ? `data/java-accounts/${currentUser.phone}.json`
    : "未生成";

  elements.profilePhone.textContent = isSignedIn ? currentUser.phone : "未登录";
  elements.profileStatus.textContent = isSignedIn ? "Java 接口登录中" : "请先登录账号";
  elements.profileTodoCount.textContent = `${todoDone}/${todoTotal}`;
  elements.profileStars.textContent = String(Number(state.focusStars || 0));
  elements.profileReminderCount.textContent = String(state.reminders.length);
  elements.profilePlanCount.textContent = String(todayPlans);
  elements.profileGoalCount.textContent = String(state.goals.length);
  elements.profileScholarship.textContent = Number(state.scholarship?.balance || 0).toFixed(2);
  elements.profileDataFile.textContent = dataFile;
}

function normalizeLoadedState(saved) {
  const fallback = createDefaultState();
  if (!saved || typeof saved !== "object") return fallback;

  if (saved.date !== todayKey()) {
    return {
      ...fallback,
      reminders: saved.reminders || [],
      studyPlans: saved.studyPlans || [],
      goals: saved.goals || [],
      rewards: saved.rewards || [],
      wishes: saved.wishes || [],
      scholarship: {
        ...fallback.scholarship,
        ...(saved.scholarship || {}),
        records: saved.scholarship?.records || [],
      },
      focusStars: Number(saved.focusStars || 0),
      settings: { ...fallback.settings, ...saved.settings },
      mistakeTips: normalizeMistakeTips(saved.mistakeTips),
    };
  }

  return {
    ...fallback,
    ...saved,
    settings: { ...fallback.settings, ...saved.settings },
    scholarship: {
      ...fallback.scholarship,
      ...(saved.scholarship || {}),
      records: saved.scholarship?.records || [],
    },
    mistakeTips: normalizeMistakeTips(saved.mistakeTips),
  };
}

function loadState() {
  try {
    return normalizeLoadedState(JSON.parse(localStorage.getItem(getStateStorageKey())));
  } catch {
    return createDefaultState();
  }
}

function normalizeMistakeTips(savedTips) {
  return DEFAULT_MISTAKE_TIP_PAGES.map((defaultPage, pageIndex) => {
    const savedPage = Array.isArray(savedTips) ? savedTips[pageIndex] : null;
    return {
      subject: defaultPage.subject,
      tips: defaultPage.tips.map((defaultTip, tipIndex) => {
        const savedTip = savedPage?.tips?.[tipIndex];
        return typeof savedTip === "string" && savedTip.trim() ? savedTip : defaultTip;
      }),
    };
  });
}

function saveState() {
  try {
    localStorage.setItem(getStateStorageKey(), JSON.stringify(state));
  } catch (error) {
    const isQuotaError =
      error?.name === "QuotaExceededError" ||
      error?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      String(error?.message || "").toLowerCase().includes("quota");
    if (!isQuotaError) throw error;

    state.todos.forEach((todo) => {
      if (todo.mistake?.image) {
        todo.mistake.image = "";
        todo.mistake.imageCleared = true;
      }
    });
    localStorage.setItem(getStateStorageKey(), JSON.stringify(state));
    showToast("本地存储空间已满，已清理错题照片缓存，任务已保存。");
  }
  queueBackendSave();
}

function queueBackendSave(delay = 250) {
  if (!canUseLocalBackend()) return;
  clearTimeout(backendSaveTimer);
  backendSaveTimer = setTimeout(async () => {
    try {
      if (currentUser) {
        await requestJavaApi(`${ACCOUNT_STATE_API_PREFIX}/${encodeURIComponent(currentUser.phone)}/state`, {
          method: "PUT",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ state }),
        });
      } else {
        await fetch(getBackendStateUrl(), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state }),
        });
      }
    } catch (error) {
      console.warn("后端状态同步失败", error);
    }
  }, delay);
}

async function loadBackendState() {
  if (!canUseLocalBackend()) return;
  try {
    let payload;
    if (currentUser) {
      payload = await requestJavaApi(`${ACCOUNT_STATE_API_PREFIX}/${encodeURIComponent(currentUser.phone)}/state`, {
        headers: getAuthHeaders(),
      });
    } else {
      const response = await fetch(getBackendStateUrl(), { cache: "no-store" });
      if (!response.ok) return;
      payload = await response.json();
    }
    if (!payload?.state) {
      queueBackendSave();
      return;
    }

    const backendState = normalizeLoadedState(payload.state);
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, backendState);
    localStorage.setItem(getStateStorageKey(), JSON.stringify(state));
    syncSettingsInputs();
    renderAll();
  } catch (error) {
    console.warn("读取后端状态失败", error);
  }
}

async function deleteBackendAccountState(phone) {
  if (!canUseLocalBackend()) return;
  await requestJavaApi(`${ACCOUNT_STATE_API_PREFIX}/${encodeURIComponent(phone)}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
}

function loadAiConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(AI_CONFIG_KEY)) || {};
    if (!saved.apiKey && saved.baseUrl === "https://api.openai.com/v1" && saved.model === "gpt-4o-mini") {
      return {
        ...saved,
        apiKey: "",
        model: DEFAULT_AI_MODEL,
        baseUrl: DEFAULT_AI_BASE_URL,
        apiMode: DEFAULT_AI_API_MODE,
      };
    }
    if (
      /dashscope\.aliyuncs\.com\/compatible-mode/i.test(String(saved.baseUrl || "")) &&
      saved.model === "qwen3.6-plus"
    ) {
      return {
        ...saved,
        model: DEFAULT_AI_MODEL,
        baseUrl: DEFAULT_AI_BASE_URL,
        apiMode: DEFAULT_AI_API_MODE,
      };
    }
    return {
      apiKey: "",
      model: DEFAULT_AI_MODEL,
      baseUrl: DEFAULT_AI_BASE_URL,
      apiMode: DEFAULT_AI_API_MODE,
      ...saved,
    };
  } catch {
    return { apiKey: "", model: DEFAULT_AI_MODEL, baseUrl: DEFAULT_AI_BASE_URL, apiMode: DEFAULT_AI_API_MODE };
  }
}

function saveAiConfig(config) {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
}

function normalizeApiKey(value) {
  const text = String(value || "").trim();
  return text.match(/sk-[A-Za-z0-9_-]+/)?.[0] || text.replace(/[^\x20-\x7E]/g, "").trim();
}

function normalizeBaseUrl(value) {
  const text = String(value || DEFAULT_AI_BASE_URL).trim().replace(/\/+$/, "");
  if (!text) return DEFAULT_AI_BASE_URL;
  return text.replace(/\/responses$/, "").replace(/\/chat\/completions$/, "");
}

function normalizeApiMode(value, baseUrl) {
  if (/dashscope\.aliyuncs\.com\/compatible-mode/i.test(String(baseUrl || ""))) return "chat";
  if (value === "chat" || value === "responses") return value;
  return /deepseek|chat\/completions/i.test(String(baseUrl || "")) ? "chat" : "responses";
}

function getAiConfig() {
  const config = loadAiConfig();
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  return {
    apiKey: normalizeApiKey(config.apiKey),
    model: String(config.model || DEFAULT_AI_MODEL).trim() || DEFAULT_AI_MODEL,
    baseUrl,
    apiMode: normalizeApiMode(config.apiMode, baseUrl),
  };
}

function renderAiStatus() {
  const config = getAiConfig();
  elements.aiStatusText.textContent = config.apiKey ? "已开启" : "未配置";
}

function openAiConfigModal() {
  const config = getAiConfig();
  elements.aiApiKeyInput.value = config.apiKey;
  elements.aiModelInput.value = config.model;
  elements.aiBaseUrlInput.value = config.baseUrl;
  elements.aiApiModeInput.value = config.apiMode;
  elements.aiConfigModal.hidden = false;
  elements.aiApiKeyInput.focus();
}

function closeAiConfigModal() {
  elements.aiConfigModal.hidden = true;
}

function setDateHeader() {
  const now = new Date();
  elements.weekday.textContent = new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(now);
  elements.todayDate.textContent = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
  }).format(now);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ensureTodoMistake(todo) {
  if (!todo.mistake) {
    todo.mistake = {
      image: "",
      originalImage: "",
      recognizedText: "",
      summary: "",
      similarQuestions: [],
    };
  }
  if (todo.mistake.image && !todo.mistake.originalImage) todo.mistake.originalImage = todo.mistake.image;
  if (!Array.isArray(todo.mistake.similarQuestions)) todo.mistake.similarQuestions = [];
  return todo.mistake;
}

function guessMistakeSubject(todo) {
  const text = `${todo.text} ${todo.mistake?.recognizedText || ""}`;
  if (/英语|英文|单词|阅读|作文|grammar|word/i.test(text)) return "英语";
  if (/数学|计算|方程|几何|应用题|小数|分数|加|减|乘|除/.test(text)) return "数学";
  return "语文";
}

async function callMistakeModel(todo, action) {
  const mistake = ensureTodoMistake(todo);
  const config = getAiConfig();
  if (!config.apiKey) return null;
  if (!config.apiKey.startsWith("sk-")) {
    throw new Error("API Key 格式不正确，请确认只填写 sk- 开头的密钥。");
  }

  const prompt =
    action === "similar"
      ? "请根据这道错题生成3道同类型练习题。"
      : "请识别图片中的错题内容，整理错误原因、正确思路，并生成3道同类型练习题。";
  const textPrompt = `${prompt}
任务名称：${todo.text}
可能科目：${guessMistakeSubject(todo)}
已有识别文本：${mistake.recognizedText || "无"}

请只返回JSON，不要返回Markdown。格式：
{"recognizedText":"题目文字","summary":"错因和正确思路，适合小学生理解","similarQuestions":["同类题1","同类题2","同类题3"]}`;
  const strictTextPrompt =
    action === "similar"
      ? `请只根据下面这道错题，生成3道同类型练习题。
错题原文：
${mistake.recognizedText || "无"}

只返回JSON，不要返回Markdown，不要解释。格式：
{"recognizedText":"","summary":"","similarQuestions":["同类练习题1","同类练习题2","同类练习题3"]}`
      : `你是错题图片OCR助手。你的唯一任务是从图片中提取“错题本身”，不要解题，不要讲知识点，不要生成同类题，不要写鼓励语。

请严格只提取图片中可见的错题内容，包括：
1. 题干原文
2. 选项或小问
3. 学生写错的答案、圈画、叉号、批改痕迹
4. 如果能看出正确答案，也只作为“批改痕迹”写出

如果图片里有多道题，只返回被批改、打叉、圈出或明显错误的那一道；如果无法确定，只返回最清晰的一道题。
如果图片不是错题或无法识别题目，recognizedText 填“未识别到清晰错题”。

任务名称：${todo.text}
可能科目：${guessMistakeSubject(todo)}

只返回JSON，不要返回Markdown，不要解释。格式：
{"recognizedText":"只写图片中的错题原文和错误作答/批改痕迹","summary":"","similarQuestions":[]}`;

  const finalTextPrompt =
    action === "similar"
      ? `请根据下面这道错题，生成3道同类型练习题。题型、考点、难度要接近，但不要照抄原题。

错题：
${mistake.recognizedText || "无"}

只返回JSON，不要返回Markdown。格式：
{"recognizedText":"","summary":"","similarQuestions":["同类型题1","同类型题2","同类型题3"]}`
      : `你是小学生错题整理助手。请只处理图片中“真正的错题”，不要识别整张图片里的所有题。

判断错题的优先级：
1. 有红叉、打叉、圈出、批改、扣分、错号的题；
2. 有学生作答且明显被老师标记错误的题；
3. 如果有多道错题，只选择最清晰、标记最明显的一道；
4. 不要返回没有错误标记的普通题目。

请输出三部分：
1. recognizedText：只写这道错题的题干、选项/小问、学生错误作答、批改痕迹。不要写其他题。
2. summary：整理这道错题的错因、正确思路和易错点，语言适合小学生理解。
3. similarQuestions：生成3道同类型练习题，考点相同，题目不同。

如果图片里没有能确定的错题，recognizedText 写“未识别到明确错题”，summary 写原因，similarQuestions 返回空数组。

任务名称：${todo.text}
可能科目：${guessMistakeSubject(todo)}

只返回JSON，不要返回Markdown。格式：
{"recognizedText":"只写一道被批改/打叉/圈出的错题内容","summary":"错因、正确思路、易错点","similarQuestions":["同类型题1","同类型题2","同类型题3"]}`;

  const content = [
    {
      type: "input_text",
      text: finalTextPrompt,
    },
  ];
  if (mistake.image) {
    content.push({
      type: "input_image",
      image_url: mistake.image,
    });
  }

  const isDashScope = /dashscope\.aliyuncs\.com\/compatible-mode/i.test(config.baseUrl);
  const canUseLocalProxy =
    isDashScope && location.protocol.startsWith("http") && /^(127\.0\.0\.1|localhost)$/i.test(location.hostname);
  const url = canUseLocalProxy
    ? "/api/dashscope/chat/completions"
    : config.apiMode === "chat"
      ? `${config.baseUrl}/chat/completions`
      : `${config.baseUrl}/responses`;
  const isDeepSeek = /api\.deepseek\.com/i.test(config.baseUrl);
  if (config.apiMode === "chat" && isDeepSeek && mistake.image) {
    throw new Error("DeepSeek 官方 Chat 接口是文本接口，不支持直接识别错题图片；请换支持视觉的接口，或使用 OpenAI Responses。");
  }
  const chatContent = content.map((part) => {
    if (part.type === "input_text") return { type: "text", text: part.text };
    return { type: "image_url", image_url: { url: part.image_url } };
  });
  const body =
    config.apiMode === "chat"
      ? {
          model: config.model,
          messages: [
            {
              role: "system",
              content: "你是错题整理助手。必须只选择图片里被批改、打叉、圈出或明显错误的一道错题；不要返回整张图的所有题。必须返回合法JSON。",
            },
            {
              role: "user",
              content: isDeepSeek ? finalTextPrompt : chatContent,
            },
          ],
          max_tokens: 1200,
          temperature: 0,
          response_format: { type: "json_object" },
        }
      : {
          model: config.model,
          input: [
            {
              role: "user",
              content,
            },
          ],
          max_output_tokens: 1200,
        };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...(canUseLocalProxy ? { "X-DashScope-Base-Url": config.baseUrl } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `AI请求失败：${response.status}`;
    try {
      const errorData = await response.json();
      message = errorData?.error?.message || message;
    } catch {
      try {
        message = (await response.text()) || message;
      } catch {
        // Keep the status message.
      }
    }
    throw new Error(message);
  }
  const data = await response.json();
  const text =
    data.output_text ||
    data.choices?.[0]?.message?.content ||
    (data.output || [])
      .flatMap((item) => item.content || [])
      .map((part) => part.text || part.output_text || "")
      .join("");
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0] || text;
  try {
    const parsed = JSON.parse(jsonText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
    return {
      recognizedText: String(parsed.recognizedText || "").trim(),
      summary: String(parsed.summary || "").trim(),
      similarQuestions: Array.isArray(parsed.similarQuestions) ? parsed.similarQuestions : [],
    };
  } catch {
    throw new Error("AI返回内容不是有效JSON，请重新识别一次。");
  }
}

async function organizeMistake(todo) {
  const mistake = ensureTodoMistake(todo);
  try {
    const aiResult = await callMistakeModel(todo, "organize");
    if (aiResult?.recognizedText) mistake.recognizedText = aiResult.recognizedText;
    if (aiResult?.summary) mistake.summary = aiResult.summary;
  } catch {
    showToast("AI 整理暂时不可用，已使用本地整理。");
  }

  if (!mistake.recognizedText.trim()) {
    mistake.recognizedText = "请在这里补充或修改识别出的错题内容。";
  }
  if (!mistake.summary.trim()) {
    const subject = guessMistakeSubject(todo);
    mistake.summary = `${subject}错题整理：先确认题目条件，再标出出错步骤，最后写下正确思路。`;
  }
  saveState();
  renderTodos();
}

async function generateSimilarMistakes(todo) {
  const mistake = ensureTodoMistake(todo);
  try {
    const aiResult = await callMistakeModel(todo, "similar");
    if (Array.isArray(aiResult?.similarQuestions)) {
      mistake.similarQuestions = aiResult.similarQuestions.slice(0, 3);
    }
  } catch {
    showToast("AI 同类题暂时不可用，已生成本地练习题。");
  }

  if (!mistake.similarQuestions.length) {
    const subject = guessMistakeSubject(todo);
    const templates = {
      语文: ["找出句子中的关键词，并说明它表达了什么。", "阅读短文后，用一句话概括主要内容。", "根据题目要求写一个扣题的结尾。"],
      数学: ["改编一道同条件应用题，并写出数量关系。", "完成一题同类型计算题，检查单位和符号。", "画图标出已知条件，再列式解答。"],
      英语: ["用同一个语法点写 2 个正确句子。", "找出句子中的时态，并改写一个同类句。", "根据短文信息回答一个细节题。"],
    };
    mistake.similarQuestions = templates[subject];
  }
  saveState();
  renderTodos();
}

function getTodoById(id) {
  return state.todos.find((todo) => todo.id === id);
}

function openMistakeResult(todo) {
  const mistake = ensureTodoMistake(todo);
  activeMistakeTodoId = todo.id;
  elements.mistakeResultTitle.textContent = `${todo.text} · 错题整理`;
  elements.mistakeResultImage.hidden = !mistake.image;
  elements.mistakeImageTools.hidden = !mistake.image;
  elements.mistakeImageEditor.hidden = !mistake.image;
  if (mistake.image) elements.mistakeResultImage.src = mistake.image;
  elements.mistakeRecognizedText.value = mistake.recognizedText || "";
  elements.mistakeSummaryText.value = mistake.summary || "";
  elements.mistakeSimilarList.innerHTML = "";
  mistake.similarQuestions.forEach((question) => {
    const item = document.createElement("li");
    item.textContent = question;
    elements.mistakeSimilarList.append(item);
  });
  if (!mistake.similarQuestions.length) {
    const item = document.createElement("li");
    item.textContent = "识别后会自动生成同类型练习题。";
    elements.mistakeSimilarList.append(item);
  }
  elements.mistakeResultModal.hidden = false;
  expandMistakeTextareas();
}

function closeMistakeResultModal() {
  elements.mistakeResultModal.hidden = true;
}

function openMistakeImagePreview() {
  const src = elements.mistakeResultImage.src;
  if (!src || elements.mistakeResultImage.hidden) return;
  elements.mistakeImagePreview.src = src;
  elements.mistakeImagePreviewModal.hidden = false;
  resetPreviewCropBox();
}

function closeMistakeImagePreview() {
  elements.mistakeImagePreviewModal.hidden = true;
  elements.mistakeImagePreview.removeAttribute("src");
}

function resetPreviewCropBox() {
  const ratioValue = elements.previewCropRatio.value;
  const ratio = ratioValue === "free" ? null : Number(ratioValue);
  if (ratio) {
    const stageRect = elements.mistakeCropStage.getBoundingClientRect();
    let width = stageRect.width * 0.76;
    let height = width / ratio;
    if (height > stageRect.height * 0.76) {
      height = stageRect.height * 0.76;
      width = height * ratio;
    }
    Object.assign(elements.mistakeCropBox.style, {
      left: `${((stageRect.width - width) / 2 / stageRect.width) * 100}%`,
      top: `${((stageRect.height - height) / 2 / stageRect.height) * 100}%`,
      width: `${(width / stageRect.width) * 100}%`,
      height: `${(height / stageRect.height) * 100}%`,
    });
    return;
  }
  Object.assign(elements.mistakeCropBox.style, {
    left: "12%",
    top: "12%",
    width: "76%",
    height: "76%",
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片读取失败，请重新上传。"));
    image.src = src;
  });
}

function sharpenImageData(imageData, amount = 0.28) {
  const { data, width, height } = imageData;
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const center = copy[index + channel] * (1 + 4 * amount);
        const sides =
          copy[index - 4 + channel] +
          copy[index + 4 + channel] +
          copy[index - width * 4 + channel] +
          copy[index + width * 4 + channel];
        data[index + channel] = Math.max(0, Math.min(255, center - sides * amount));
      }
    }
  }
  return imageData;
}

async function transformMistakeImage({ rotate = 0, enhance = false, brightness = 1, contrast = 1, sharpness = 0.28 } = {}) {
  const todo = getTodoById(activeMistakeTodoId);
  if (!todo) return;
  const mistake = ensureTodoMistake(todo);
  if (!mistake.image) return;

  try {
    const image = await loadImageElement(mistake.image);
    const scale = enhance ? Math.min(2, Math.max(1.25, 1600 / Math.max(image.naturalWidth, image.naturalHeight))) : 1;
    const rotated = Math.abs(rotate) % 180 === 90;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((rotated ? image.naturalHeight : image.naturalWidth) * scale);
    canvas.height = Math.round((rotated ? image.naturalWidth : image.naturalHeight) * scale);
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const finalContrast = enhance ? Math.max(contrast, 1.14) : contrast;
    const finalBrightness = enhance ? Math.max(brightness, 1.04) : brightness;
    context.filter = `contrast(${finalContrast}) saturate(1.04) brightness(${finalBrightness})`;
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((rotate * Math.PI) / 180);
    context.drawImage(
      image,
      (-image.naturalWidth * scale) / 2,
      (-image.naturalHeight * scale) / 2,
      image.naturalWidth * scale,
      image.naturalHeight * scale
    );
    if (enhance || sharpness > 0) {
      context.putImageData(sharpenImageData(context.getImageData(0, 0, canvas.width, canvas.height), sharpness), 0, 0);
    }
    mistake.image = canvas.toDataURL("image/jpeg", enhance ? 0.92 : 0.9);
    if (!mistake.originalImage) mistake.originalImage = image.src;
    elements.mistakeResultImage.src = mistake.image;
    if (!elements.mistakeImagePreviewModal.hidden) elements.mistakeImagePreview.src = mistake.image;
    saveState();
    renderTodos();
    showToast(enhance ? "图片已智能高清处理。" : "图片已旋转。");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "图片处理失败。");
  }
}

function applyMistakeImageEdit() {
  transformMistakeImage({
    brightness: Number(elements.mistakeBrightness.value || 100) / 100,
    contrast: Number(elements.mistakeContrast.value || 100) / 100,
    sharpness: Number(elements.mistakeSharpness.value || 0) / 100,
  });
}

async function cropMistakeImage() {
  const todo = getTodoById(activeMistakeTodoId);
  if (!todo) return;
  const mistake = ensureTodoMistake(todo);
  if (!mistake.image) return;

  try {
    const image = await loadImageElement(mistake.image);
    const selectedRatio = elements.mistakeCropRatio.value;
    const targetRatio = selectedRatio === "free" ? image.naturalWidth / image.naturalHeight : Number(selectedRatio);
    const imageRatio = image.naturalWidth / image.naturalHeight;
    let cropWidth = image.naturalWidth;
    let cropHeight = image.naturalHeight;
    if (imageRatio > targetRatio) {
      cropWidth = Math.round(image.naturalHeight * targetRatio);
    } else {
      cropHeight = Math.round(image.naturalWidth / targetRatio);
    }
    const sourceX = Math.round((image.naturalWidth - cropWidth) / 2);
    const sourceY = Math.round((image.naturalHeight - cropHeight) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    mistake.image = canvas.toDataURL("image/jpeg", 0.92);
    if (!mistake.originalImage) mistake.originalImage = image.src;
    elements.mistakeResultImage.src = mistake.image;
    if (!elements.mistakeImagePreviewModal.hidden) elements.mistakeImagePreview.src = mistake.image;
    saveState();
    renderTodos();
    showToast("图片已裁剪。");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "图片裁剪失败。");
  }
}

function startPreviewCropDrag(event) {
  event.preventDefault();
  const stageRect = elements.mistakeCropStage.getBoundingClientRect();
  const boxRect = elements.mistakeCropBox.getBoundingClientRect();
  cropDrag = {
    pointerId: event.pointerId,
    mode: event.target.dataset.cropHandle || "move",
    startX: event.clientX,
    startY: event.clientY,
    left: boxRect.left - stageRect.left,
    top: boxRect.top - stageRect.top,
    width: boxRect.width,
    height: boxRect.height,
    stageWidth: stageRect.width,
    stageHeight: stageRect.height,
  };
  elements.mistakeCropBox.setPointerCapture(event.pointerId);
}

function movePreviewCropDrag(event) {
  if (!cropDrag) return;
  const minSize = 48;
  const deltaX = event.clientX - cropDrag.startX;
  const deltaY = event.clientY - cropDrag.startY;
  const ratioValue = elements.previewCropRatio.value;
  const lockedRatio = ratioValue === "free" ? null : Number(ratioValue);
  let left = cropDrag.left;
  let top = cropDrag.top;
  let width = cropDrag.width;
  let height = cropDrag.height;

  if (cropDrag.mode === "move") {
    left = cropDrag.left + deltaX;
    top = cropDrag.top + deltaY;
  } else {
    if (cropDrag.mode.includes("w")) {
      left = cropDrag.left + deltaX;
      width = cropDrag.width - deltaX;
    }
    if (cropDrag.mode.includes("e")) {
      width = cropDrag.width + deltaX;
    }
    if (cropDrag.mode.includes("n")) {
      top = cropDrag.top + deltaY;
      height = cropDrag.height - deltaY;
    }
    if (cropDrag.mode.includes("s")) {
      height = cropDrag.height + deltaY;
    }
    if (lockedRatio) {
      if (cropDrag.mode.includes("e") || cropDrag.mode.includes("w")) {
        height = width / lockedRatio;
        if (cropDrag.mode.includes("n")) top = cropDrag.top + cropDrag.height - height;
      } else {
        width = height * lockedRatio;
        if (cropDrag.mode.includes("w")) left = cropDrag.left + cropDrag.width - width;
      }
    }
  }

  if (width < minSize) {
    if (cropDrag.mode.includes("w")) left -= minSize - width;
    width = minSize;
  }
  if (height < minSize) {
    if (cropDrag.mode.includes("n")) top -= minSize - height;
    height = minSize;
  }
  left = Math.max(0, Math.min(cropDrag.stageWidth - width, left));
  top = Math.max(0, Math.min(cropDrag.stageHeight - height, top));
  width = Math.min(width, cropDrag.stageWidth - left);
  height = Math.min(height, cropDrag.stageHeight - top);

  elements.mistakeCropBox.style.left = `${(left / cropDrag.stageWidth) * 100}%`;
  elements.mistakeCropBox.style.top = `${(top / cropDrag.stageHeight) * 100}%`;
  elements.mistakeCropBox.style.width = `${(width / cropDrag.stageWidth) * 100}%`;
  elements.mistakeCropBox.style.height = `${(height / cropDrag.stageHeight) * 100}%`;
}

function endPreviewCropDrag(event) {
  if (!cropDrag) return;
  try {
    elements.mistakeCropBox.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture may already be released.
  }
  cropDrag = null;
}

async function applyPreviewCrop() {
  const todo = getTodoById(activeMistakeTodoId);
  if (!todo) return;
  const mistake = ensureTodoMistake(todo);
  if (!mistake.image) return;

  try {
    const image = await loadImageElement(mistake.image);
    const imageRect = elements.mistakeImagePreview.getBoundingClientRect();
    const boxRect = elements.mistakeCropBox.getBoundingClientRect();
    const clippedLeft = Math.max(boxRect.left, imageRect.left);
    const clippedTop = Math.max(boxRect.top, imageRect.top);
    const clippedRight = Math.min(boxRect.right, imageRect.right);
    const clippedBottom = Math.min(boxRect.bottom, imageRect.bottom);
    const clippedWidth = clippedRight - clippedLeft;
    const clippedHeight = clippedBottom - clippedTop;
    if (clippedWidth <= 1 || clippedHeight <= 1) return;
    const scaleX = image.naturalWidth / imageRect.width;
    const scaleY = image.naturalHeight / imageRect.height;
    const sourceX = Math.max(0, Math.round((clippedLeft - imageRect.left) * scaleX));
    const sourceY = Math.max(0, Math.round((clippedTop - imageRect.top) * scaleY));
    const cropWidth = Math.min(image.naturalWidth - sourceX, Math.round(clippedWidth * scaleX));
    const cropHeight = Math.min(image.naturalHeight - sourceY, Math.round(clippedHeight * scaleY));
    if (cropWidth <= 0 || cropHeight <= 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    mistake.image = canvas.toDataURL("image/jpeg", 0.92);
    if (!mistake.originalImage) mistake.originalImage = image.src;
    elements.mistakeImagePreview.onload = () => resetPreviewCropBox();
    elements.mistakeResultImage.src = mistake.image;
    elements.mistakeImagePreview.src = mistake.image;
    elements.mistakeResultImage.hidden = false;
    elements.mistakeImageTools.hidden = false;
    elements.mistakeImageEditor.hidden = false;
    saveState();
    renderTodos();
    showToast("已按自定义裁剪框裁剪。");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "图片裁剪失败。");
  }
}

function restoreMistakeImage() {
  const todo = getTodoById(activeMistakeTodoId);
  if (!todo) return;
  const mistake = ensureTodoMistake(todo);
  if (!mistake.originalImage) return;
  mistake.image = mistake.originalImage;
  elements.mistakeBrightness.value = 100;
  elements.mistakeContrast.value = 100;
  elements.mistakeSharpness.value = 28;
  elements.mistakeResultImage.src = mistake.image;
  if (!elements.mistakeImagePreviewModal.hidden) elements.mistakeImagePreview.src = mistake.image;
  saveState();
  renderTodos();
  showToast("已恢复原图。");
}

function expandMistakeTextareas() {
  [elements.mistakeRecognizedText, elements.mistakeSummaryText].forEach((textarea) => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  });
}

function saveMistakeResultEdits() {
  const todo = getTodoById(activeMistakeTodoId);
  if (!todo) return;
  const mistake = ensureTodoMistake(todo);
  mistake.recognizedText = elements.mistakeRecognizedText.value.trim();
  mistake.summary = elements.mistakeSummaryText.value.trim();
  expandMistakeTextareas();
  saveState();
  renderTodos();
}

async function analyzeMistakeWithAI(todo) {
  const mistake = ensureTodoMistake(todo);
  if (!mistake.image) {
    showToast("请先拍照或上传错题图片。");
    return;
  }
  if (!getAiConfig().apiKey) {
    openAiConfigModal();
    showToast("请先配置 API Key，再使用 AI 识别。");
    return;
  }

  mistake.isAnalyzing = true;
  saveState();
  renderTodos();
  showToast("AI正在识别错题，请稍等。");

  try {
    const result = await callMistakeModel(todo, "organize");
    mistake.recognizedText = result?.recognizedText || mistake.recognizedText;
    mistake.summary = result?.summary || mistake.summary;
    mistake.similarQuestions = Array.isArray(result?.similarQuestions)
      ? result.similarQuestions.slice(0, 3)
      : mistake.similarQuestions;
    if (!mistake.similarQuestions.length && mistake.recognizedText && !mistake.recognizedText.includes("未识别到")) {
      const similarResult = await callMistakeModel(todo, "similar");
      if (Array.isArray(similarResult?.similarQuestions)) {
        mistake.similarQuestions = similarResult.similarQuestions.slice(0, 3);
      }
    }
    showToast("AI错题识别完成。");
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "AI识别失败，请稍后再试。";
    showToast(`AI识别失败：${message}`);
  } finally {
    mistake.isAnalyzing = false;
    saveState();
    renderTodos();
    openMistakeResult(todo);
  }
}

function getTodoMinutes(todo) {
  return Math.max(1, Number(todo.estimatedMinutes || todo.minutes || state.settings.focusMinutes));
}

function splitIntoPomodoros(minutes) {
  const focusMinutes = Math.max(1, Number(state.settings.focusMinutes));
  const segments = [];
  let rest = Math.max(1, Number(minutes));

  while (rest > 0) {
    const segment = Math.min(focusMinutes, rest);
    segments.push(segment);
    rest -= segment;
  }

  return segments;
}

function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}小时${rest}分钟` : `${hours}小时`;
}

function makeDateKey(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateLabel(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(year, month - 1, day));
}

function formatShortDate(dateKey) {
  if (dateKey === todayKey()) return "今日";
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatRewardTime(timestamp = Date.now()) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function scrollToSection(selector) {
  const target = document.querySelector(selector);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openEmbeddedPage(page) {
  elements.workspace.classList.add("is-embedded-open");
  elements.calendarPage.hidden = page !== "calendar";
  elements.wishPage.hidden = page !== "wish";
  const target = page === "calendar" ? elements.calendarPage : elements.wishPage;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEmbeddedPage() {
  elements.workspace.classList.remove("is-embedded-open");
  elements.calendarPage.hidden = true;
  elements.wishPage.hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getWeekKey(date = new Date()) {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (current.getDay() + 6) % 7;
  current.setDate(current.getDate() - day);
  return todayKeyFromDate(current);
}

function todayKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function getGoalPeriodKey(type) {
  const now = new Date();
  if (type === "daily") return todayKey();
  if (type === "weekly") return getWeekKey(now);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getGoalLabel(goal) {
  if (goal.type === "daily") return `${formatShortDate(goal.periodKey)}目标`;
  return GOAL_LABELS[goal.type];
}

function getCurrentGoals() {
  return state.goals.filter((goal) => goal.periodKey === getGoalPeriodKey(goal.type));
}

function getActiveTodo() {
  return state.todos.find((todo) => todo.id === state.activeTodoId && !todo.done);
}

function getActiveTodoSegmentSeconds() {
  const todo = getActiveTodo();
  if (!todo) return null;

  const segments = splitIntoPomodoros(getTodoMinutes(todo));
  const index = Math.min(Number(todo.completedSegments || 0), segments.length - 1);
  return segments[index] ? segments[index] * 60 : null;
}

function syncSettingsInputs() {
  elements.focusMinutes.value = state.settings.focusMinutes;
  elements.shortMinutes.value = state.settings.shortMinutes;
  elements.longMinutes.value = state.settings.longMinutes;
}

function renderMistakeTips() {
  const page = state.mistakeTips[mistakeTipIndex];
  elements.mistakeSubject.textContent = page.subject;
  elements.mistakePage.textContent = `${mistakeTipIndex + 1}/${state.mistakeTips.length}`;
  elements.mistakeTipList.innerHTML = "";
  page.tips.forEach((tip, index) => {
    const item = document.createElement("li");
    const input = document.createElement("input");
    input.className = "mistake-tip-input";
    input.type = "text";
    input.value = tip;
    input.dataset.tipIndex = index;
    input.setAttribute("aria-label", `${page.subject}易错点 ${index + 1}`);
    item.append(input);
    elements.mistakeTipList.append(item);
  });
}

function showNextMistakeTips() {
  mistakeTipIndex = (mistakeTipIndex + 1) % state.mistakeTips.length;
  renderMistakeTips();
}

function getModeSeconds(selectedMode = mode) {
  if (selectedMode === "focus") {
    const taskSeconds = getActiveTodoSegmentSeconds();
    if (taskSeconds) return taskSeconds;
  }

  return state.settings[MODES[selectedMode].minutesKey] * 60;
}

function setMode(nextMode, keepRunning = false) {
  mode = nextMode;
  totalSeconds = getModeSeconds(mode);
  remainingSeconds = totalSeconds;
  isRunning = false;
  clearInterval(timer);
  timer = null;

  document.querySelectorAll(".mode-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });

  if (keepRunning) startTimer();
  renderTimer();
}

function renderTimer() {
  const circumference = 2 * Math.PI * 96;
  const elapsedRatio = totalSeconds ? 1 - remainingSeconds / totalSeconds : 0;
  elements.progressRing.style.strokeDasharray = `${circumference}`;
  elements.progressRing.style.strokeDashoffset = `${circumference * elapsedRatio}`;
  elements.timerModeLabel.textContent = MODES[mode].label;
  elements.timeDisplay.textContent = formatTime(remainingSeconds);
  const activeTodo = getActiveTodo();
  const statusPrefix = isRunning ? "进行中" : "已暂停";
  elements.timerStatus.textContent =
    activeTodo && mode === "focus" ? `${statusPrefix} · ${activeTodo.text}` : statusPrefix;
  elements.startPauseBtn.textContent = isRunning ? "暂停" : "开始";
  elements.pomodoroCount.textContent = state.completedPomodoros;
  elements.focusStars.textContent = state.focusStars;
  renderFocusMessage();
  renderHomeWish();
  document.title = `${formatTime(remainingSeconds)} · ${MODES[mode].label}`;
}

function addReward(label, stars) {
  state.focusStars += stars;
  state.rewards.unshift({
    id: createId(),
    label,
    stars,
    date: todayKey(),
    createdAt: Date.now(),
  });
}

function renderFocusMessage() {
  const activeTodo = getActiveTodo();
  if (activeTodo && mode === "focus") {
    const segments = splitIntoPomodoros(getTodoMinutes(activeTodo));
    const current = Math.min(Number(activeTodo.completedSegments || 0) + 1, segments.length);
    elements.focusMessage.textContent = `正在挑战第 ${current}/${segments.length} 段：${activeTodo.text}`;
    return;
  }

  const todayPlans = state.studyPlans.filter((plan) => plan.date === todayKey() && !plan.done).length;
  if (todayPlans > 0) {
    elements.focusMessage.textContent = `今天还有 ${todayPlans} 个计划可加入任务。`;
    return;
  }

  elements.focusMessage.textContent = "等待任务，准备开始专注。";
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  elements.alarmSound.play().then(() => elements.alarmSound.pause()).catch(() => {});
  timer = setInterval(() => {
    remainingSeconds -= 1;
    if (remainingSeconds <= 0) completeTimer();
    renderTimer();
  }, 1000);
  renderTimer();
}

function pauseTimer() {
  isRunning = false;
  clearInterval(timer);
  timer = null;
  renderTimer();
}

function completeTimer(countCompletion = true) {
  clearInterval(timer);
  timer = null;
  isRunning = false;
  remainingSeconds = 0;
  let taskMessage = "";

  if (mode === "focus" && countCompletion) {
    state.completedPomodoros += 1;
    state.focusStars += 1;
    taskMessage = completeActiveTodoSegment();
    saveState();
    renderTodos();
  }

  let message = "已切换到下一个计时。";
  if (countCompletion && mode === "focus") message = "完成一段专注，获得 1 颗学习星星。";
  if (countCompletion && mode !== "focus") message = "休息结束，准备回到学习。";
  if (taskMessage) message = taskMessage;

  const nextMode =
    countCompletion && mode === "focus" && state.completedPomodoros % 4 === 0
      ? "long"
      : MODES[mode].next;
  notify("每日专注", message);
  setMode(nextMode);
}

function completeActiveTodoSegment() {
  const todo = getActiveTodo();
  if (!todo) return "";

  const segments = splitIntoPomodoros(getTodoMinutes(todo));
  todo.completedSegments = Math.min(Number(todo.completedSegments || 0) + 1, segments.length);

  if (todo.completedSegments >= segments.length) {
    todo.done = true;
    state.activeTodoId = "";
    return `任务完成：${todo.text}`;
  }

  return `已完成 ${todo.completedSegments}/${segments.length} 个番茄时间段：${todo.text}`;
}

function startTodo(todo) {
  if (todo.done) return;
  state.activeTodoId = todo.id;
  saveState();
  renderTodos();
  setMode("focus", true);

  const segments = splitIntoPomodoros(getTodoMinutes(todo));
  const current = Math.min(Number(todo.completedSegments || 0) + 1, segments.length);
  showToast(`开始第 ${current}/${segments.length} 段：${todo.text}`);
}

function renderTodos() {
  elements.todoList.innerHTML = "";
  const doneCount = state.todos.filter((todo) => todo.done).length;
  elements.todoSummary.textContent = `${doneCount}/${state.todos.length}`;
  elements.emptyTodos.hidden = state.todos.length > 0;

  state.todos.forEach((todo) => {
    const item = document.createElement("li");
    item.className = `todo-item${todo.done ? " done" : ""}${state.activeTodoId === todo.id ? " active" : ""}`;
    const minutes = getTodoMinutes(todo);
    const segments = splitIntoPomodoros(minutes);
    const completedSegments = Math.min(Number(todo.completedSegments || 0), segments.length);
    const segmentText = segments
      .map((segment, index) => `${index < completedSegments ? "✓ " : ""}${segment}分钟`)
      .join(" / ");
    const mistake = ensureTodoMistake(todo);
    item.innerHTML = `
      <input type="checkbox" ${todo.done ? "checked" : ""} aria-label="完成待办" />
      <div class="todo-main">
        <span class="todo-text"></span>
        <span class="todo-meta"></span>
        <span class="todo-plan"></span>
      </div>
      <button class="ai-photo-chip" type="button" aria-label="AI拍照识别错题">
        <span class="ai-mark">AI</span>
        <span class="ai-photo-text">拍错题</span>
      </button>
      <input class="mistake-photo-input" type="file" accept="image/*" capture="environment" />
      <button class="start-todo-btn" type="button" aria-label="开始这项待办">开始</button>
      <button class="delete-btn" type="button" aria-label="删除待办">×</button>
    `;
    item.querySelector(".todo-text").textContent = todo.text;
    item.querySelector(".todo-meta").textContent =
      `预计 ${formatMinutes(minutes)}，${completedSegments}/${segments.length} 个番茄时间段`;
    item.querySelector(".todo-plan").textContent = segmentText;
    item.querySelector(".ai-photo-text").textContent = mistake.isAnalyzing
      ? "识别中"
      : mistake.summary
        ? "看错题"
        : mistake.image
          ? "已拍照"
          : "拍错题";
    item.querySelector("input").addEventListener("change", (event) => {
      todo.done = event.target.checked;
      todo.completedSegments = event.target.checked ? splitIntoPomodoros(getTodoMinutes(todo)).length : 0;
      if (todo.done && state.activeTodoId === todo.id) state.activeTodoId = "";
      saveState();
      renderTodos();
    });
    item.querySelector(".start-todo-btn").disabled = todo.done;
    item.querySelector(".start-todo-btn").textContent = todo.done ? "完成" : "开始";
    item.querySelector(".start-todo-btn").addEventListener("click", () => startTodo(todo));
    item.querySelector(".ai-photo-chip").addEventListener("click", () => {
      if (mistake.image && (mistake.summary || mistake.recognizedText || mistake.similarQuestions.length)) {
        openMistakeResult(todo);
        return;
      }
      item.querySelector(".mistake-photo-input").click();
    });
    item.querySelector(".mistake-photo-input").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        mistake.image = String(reader.result || "");
        mistake.originalImage = mistake.image;
        if (!mistake.recognizedText) {
          mistake.recognizedText = `已上传《${file.name}》，等待AI识别。`;
        }
        saveState();
        renderTodos();
        openMistakeResult(todo);
        showToast("请先编辑或高清处理图片，再开始AI识别。");
      });
      reader.readAsDataURL(file);
    });
    item.querySelector(".delete-btn").addEventListener("click", () => {
      state.todos = state.todos.filter((entry) => entry.id !== todo.id);
      if (state.activeTodoId === todo.id) state.activeTodoId = "";
      saveState();
      renderTodos();
    });
    elements.todoList.appendChild(item);
  });
}

function renderReminders() {
  elements.reminderList.innerHTML = "";
  elements.emptyReminders.hidden = state.reminders.length > 0;

  [...state.reminders]
    .sort((a, b) => a.time.localeCompare(b.time))
    .forEach((reminder) => {
      const item = document.createElement("li");
      item.className = "reminder-item";
      item.innerHTML = `
        <span class="reminder-time"></span>
        <span class="reminder-text"></span>
        <button class="delete-btn" type="button" aria-label="删除提醒">×</button>
      `;
      item.querySelector(".reminder-time").textContent = reminder.time;
      item.querySelector(".reminder-text").textContent = reminder.text;
      item.querySelector(".delete-btn").addEventListener("click", () => {
        state.reminders = state.reminders.filter((entry) => entry.id !== reminder.id);
        saveState();
        renderReminders();
      });
      elements.reminderList.appendChild(item);
    });
}

function renderGoals() {
  const goals = getCurrentGoals();
  const doneCount = goals.filter((goal) => goal.done).length;
  elements.goalSummary.textContent = `${doneCount}/${goals.length}`;
  elements.goalList.innerHTML = "";
  elements.emptyGoals.hidden = goals.length > 0;

  goals
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((goal) => {
      const item = document.createElement("li");
      item.className = `goal-item${goal.done ? " done" : ""}`;
      item.innerHTML = `
        <div class="goal-copy">
          <span class="goal-kind"></span>
          <strong class="goal-title"></strong>
        </div>
        <button class="complete-goal-btn" type="button"></button>
        <button class="delete-btn" type="button" aria-label="删除目标">×</button>
      `;
      item.querySelector(".goal-kind").textContent = `${getGoalLabel(goal)} · +${goal.reward} 星`;
      item.querySelector(".goal-title").textContent = goal.title;
      const completeBtn = item.querySelector(".complete-goal-btn");
      completeBtn.textContent = goal.done ? "已奖励" : "完成";
      completeBtn.disabled = goal.done;
      completeBtn.addEventListener("click", () => {
        completeGoal(goal);
      });
      item.querySelector(".delete-btn").addEventListener("click", () => {
        state.goals = state.goals.filter((entry) => entry.id !== goal.id);
        saveState();
        renderGoals();
        renderHomeGoals();
      });
      elements.goalList.appendChild(item);
    });
}

function completeGoal(goal) {
  goal.done = true;
  goal.doneAt = Date.now();
  addReward(`${getGoalLabel(goal)}：${goal.title}`, goal.reward);
  saveState();
  renderGoals();
  renderHomeGoals();
  renderRewards();
  renderTimer();
  showToast(`目标完成，获得 ${goal.reward} 颗学习星星。`);
}

function renderHomeGoals() {
  const goals = state.goals
    .filter((goal) => goal.type === "daily" && goal.periodKey === todayKey())
    .sort((a, b) => a.createdAt - b.createdAt);

  elements.homeGoalList.innerHTML = "";
  elements.emptyHomeGoals.hidden = goals.length > 0;

  goals.forEach((goal) => {
    const item = document.createElement("div");
    item.className = `home-goal-item${goal.done ? " done" : ""}`;
    item.innerHTML = `
      <div>
        <strong class="home-goal-title"></strong>
        <span class="home-goal-meta"></span>
      </div>
      <button class="home-goal-done" type="button"></button>
    `;
    item.querySelector(".home-goal-title").textContent = goal.title;
    item.querySelector(".home-goal-meta").textContent = goal.done
      ? "已完成，星星已到账"
      : `完成后获得 ${goal.reward} 颗学习星星`;
    const button = item.querySelector(".home-goal-done");
    button.textContent = goal.done ? "已完成" : "完成";
    button.disabled = goal.done;
    button.addEventListener("click", () => completeGoal(goal));
    elements.homeGoalList.appendChild(item);
  });
}

function renderRewards() {
  const rewards = state.rewards.slice(0, 8);
  elements.rewardList.innerHTML = "";
  elements.emptyRewards.hidden = rewards.length > 0;

  rewards.forEach((reward) => {
    const item = document.createElement("li");
    item.className = "reward-item";
    item.innerHTML = `
      <span class="reward-stars"></span>
      <span class="reward-main">
        <span class="reward-text"></span>
        <span class="reward-time"></span>
      </span>
    `;
    item.querySelector(".reward-stars").textContent =
      reward.stars >= 0 ? `+${reward.stars} 星` : `${reward.stars} 星`;
    item.querySelector(".reward-text").textContent = reward.label;
    item.querySelector(".reward-time").textContent = formatRewardTime(reward.createdAt);
    elements.rewardList.appendChild(item);
  });
}

function spendStars(amount) {
  if (state.focusStars < amount) return false;
  state.focusStars -= amount;
  return true;
}

function getBiggestAffordableWish() {
  return state.wishes
    .filter((wish) => !wish.done && Number(wish.cost) <= state.focusStars)
    .sort((a, b) => Number(b.cost) - Number(a.cost))[0];
}

function redeemWish(wish) {
  if (!spendStars(Number(wish.cost))) {
    showToast("星星还不够，继续完成目标和番茄钟吧。");
    return;
  }

  wish.done = true;
  wish.doneAt = Date.now();
  state.rewards.unshift({
    id: createId(),
    label: `实现愿望：${wish.title}`,
    stars: -Number(wish.cost),
    date: todayKey(),
    createdAt: Date.now(),
  });
  saveState();
  renderHomeWish();
  renderWishes();
  renderRewards();
  renderTimer();
  showToast(`愿望实现：${wish.title}`);
}

function renderHomeWish() {
  if (!elements.homeWishCard || !elements.homeWishName) return;
  const wish = getBiggestAffordableWish();
  elements.homeWishCard.hidden = !wish;
  if (!wish) return;

  elements.homeWishName.textContent = wish.title;
}

function renderWishes() {
  const wishes = state.wishes.slice().sort((a, b) => a.createdAt - b.createdAt);
  elements.wishList.innerHTML = "";
  elements.emptyWishes.hidden = wishes.length > 0;

  wishes.forEach((wish) => {
    const item = document.createElement("li");
    item.className = `wish-item${wish.done ? " done" : ""}`;
    item.innerHTML = `
      <div class="wish-copy">
        <strong class="wish-title"></strong>
        <span class="wish-cost"></span>
      </div>
      <button class="redeem-wish-btn" type="button"></button>
      <button class="delete-btn" type="button" aria-label="删除愿望">×</button>
    `;
    item.querySelector(".wish-title").textContent = wish.title;
    item.querySelector(".wish-cost").textContent = wish.done
      ? `已实现 · 花费 ${wish.cost} 颗星`
      : `需要 ${wish.cost} 颗星`;

    const redeemBtn = item.querySelector(".redeem-wish-btn");
    redeemBtn.textContent = wish.done ? "已实现" : "实现";
    redeemBtn.disabled = wish.done;
    redeemBtn.addEventListener("click", () => redeemWish(wish));
    item.querySelector(".delete-btn").addEventListener("click", () => {
      state.wishes = state.wishes.filter((entry) => entry.id !== wish.id);
      saveState();
      renderWishes();
      renderHomeWish();
    });
    elements.wishList.appendChild(item);
  });
}

function renderScholarship() {
  elements.scholarshipBalance.textContent = Number(state.scholarship.balance || 0).toFixed(2);
  elements.scholarshipRate.value = state.scholarship.rate;
  const records = (state.scholarship.records || []).slice(0, 8);
  elements.scholarshipList.innerHTML = "";
  elements.emptyScholarship.hidden = records.length > 0;

  records.forEach((record) => {
    const item = document.createElement("li");
    item.className = "scholarship-item";
    item.innerHTML = `
      <span class="scholarship-money"></span>
      <span class="scholarship-text"></span>
    `;
    item.querySelector(".scholarship-money").textContent = `+${Number(record.amount).toFixed(2)} 元`;
    item.querySelector(".scholarship-text").textContent = `${record.stars} 颗星兑换`;
    elements.scholarshipList.appendChild(item);
  });
}

function renderCalendar() {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
  }).format(firstDay);

  elements.calendarMonth.textContent = monthLabel;
  elements.calendarGrid.innerHTML = "";

  for (let i = 0; i < startOffset; i += 1) {
    const blank = document.createElement("span");
    blank.className = "calendar-blank";
    elements.calendarGrid.appendChild(blank);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = makeDateKey(year, month, day);
    const plans = state.studyPlans.filter((plan) => plan.date === date);
    const doneCount = plans.filter((plan) => plan.done).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "calendar-day",
      date === todayKey() ? "today" : "",
      date === selectedPlanDate ? "selected" : "",
      plans.length ? "has-plan" : "",
    ]
      .filter(Boolean)
      .join(" ");
    button.innerHTML = `
      <span>${day}</span>
      <small>${plans.length ? `${doneCount}/${plans.length}` : ""}</small>
    `;
    button.addEventListener("click", () => {
      selectedPlanDate = date;
      renderCalendar();
      renderStudyPlans();
    });
    elements.calendarGrid.appendChild(button);
  }
}

function renderStudyPlans() {
  const plans = state.studyPlans
    .filter((plan) => plan.date === selectedPlanDate)
    .sort((a, b) => a.createdAt - b.createdAt);

  elements.selectedPlanDate.textContent = formatDateLabel(selectedPlanDate);
  elements.studyPlanList.innerHTML = "";
  elements.emptyStudyPlans.hidden = plans.length > 0;

  plans.forEach((plan) => {
    const item = document.createElement("li");
    item.className = `study-plan-item${plan.done ? " done" : ""}`;
    item.innerHTML = `
      <input type="checkbox" ${plan.done ? "checked" : ""} aria-label="完成学习计划" />
      <div class="study-plan-main">
        <span class="study-plan-title"></span>
        <span class="study-plan-meta"></span>
        <span class="study-plan-note"></span>
      </div>
      <button class="plan-to-todo-btn" type="button">加入待办</button>
      <button class="delete-btn" type="button" aria-label="删除学习计划">×</button>
    `;
    item.querySelector(".study-plan-title").textContent = plan.title;
    item.querySelector(".study-plan-meta").textContent = `预计 ${formatMinutes(Number(plan.minutes))}`;
    item.querySelector(".study-plan-note").textContent = plan.note || "";
    item.querySelector("input").addEventListener("change", (event) => {
      plan.done = event.target.checked;
      saveState();
      renderCalendar();
      renderStudyPlans();
    });
    const todoBtn = item.querySelector(".plan-to-todo-btn");
    todoBtn.disabled = selectedPlanDate !== todayKey() || plan.done;
    todoBtn.textContent = selectedPlanDate === todayKey() ? "加入待办" : "非今日";
    todoBtn.addEventListener("click", () => addPlanToTodayTodo(plan));
    item.querySelector(".delete-btn").addEventListener("click", () => {
      state.studyPlans = state.studyPlans.filter((entry) => entry.id !== plan.id);
      saveState();
      renderCalendar();
      renderStudyPlans();
    });
    elements.studyPlanList.appendChild(item);
  });
}

function addPlanToTodayTodo(plan) {
  const exists = state.todos.some((todo) => todo.planId === plan.id);
  if (exists) {
    showToast("这条学习计划已经在今日待办里。");
    return;
  }

  const todo = {
    id: createId(),
    planId: plan.id,
    text: plan.title,
    estimatedMinutes: Number(plan.minutes),
    completedSegments: 0,
    done: false,
  };
  state.todos.push(todo);
  saveState();
  renderTodos();
  startTodo(todo);
}

function notify(title, body) {
  showToast(body);
  elements.alarmSound.currentTime = 0;
  elements.alarmSound.play().catch(() => {});

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 4200);
}

function checkReminders() {
  if (state.date !== todayKey()) {
    state.date = todayKey();
    state.todos = [];
    state.activeTodoId = "";
    state.reminders = state.reminders.map((reminder) => ({ ...reminder, lastFired: "" }));
    state.completedPomodoros = 0;
    saveState();
    setDateHeader();
    renderTodos();
    renderReminders();
    renderGoals();
    renderHomeGoals();
    renderRewards();
    renderHomeWish();
    renderWishes();
    renderScholarship();
    renderCalendar();
    renderStudyPlans();
    setMode("focus");
  }

  const now = new Date();
  const date = todayKey();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  state.reminders.forEach((reminder) => {
    if (reminder.time === currentTime && reminder.lastFired !== date) {
      reminder.lastFired = date;
      notify("定时提醒", reminder.text);
      saveState();
      renderReminders();
    }
  });
}

function renderAll() {
  setDateHeader();
  syncSettingsInputs();
  renderMistakeTips();
  renderAiStatus();
  setMode(mode);
  renderTodos();
  renderHomeGoals();
  renderReminders();
  renderGoals();
  renderRewards();
  renderWishes();
  renderHomeWish();
  renderScholarship();
  renderCalendar();
  renderStudyPlans();
  renderProfileInfo();
}

function bindEvents() {
  elements.loginTab.addEventListener("click", () => setAuthMode("login"));
  elements.registerTab.addEventListener("click", () => setAuthMode("register"));
  elements.authForm.addEventListener("submit", handleAuthSubmit);
  elements.profileAvatarBtn.addEventListener("click", openProfileModal);
  elements.closeProfileModal.addEventListener("click", closeProfileModal);
  elements.profileModal.addEventListener("click", (event) => {
    if (event.target === elements.profileModal) closeProfileModal();
  });
  elements.profileLogoutBtn.addEventListener("click", logout);
  elements.accountBtn.addEventListener("click", logout);
  elements.deleteAccountBtn.addEventListener("click", deleteCurrentAccount);

  elements.openPlanFromGoal.addEventListener("click", () => {
    selectedPlanDate = todayKey();
    calendarCursor = new Date();
    renderCalendar();
    renderStudyPlans();
    openEmbeddedPage("calendar");
  });

  elements.dateJumpBtn.addEventListener("click", () => {
    selectedPlanDate = todayKey();
    calendarCursor = new Date();
    renderCalendar();
    renderStudyPlans();
    openEmbeddedPage("calendar");
  });

  elements.starJumpBtn.addEventListener("click", () => {
    openEmbeddedPage("wish");
  });

  elements.aiSettingsBtn.addEventListener("click", openAiConfigModal);
  elements.closeAiConfig.addEventListener("click", closeAiConfigModal);
  elements.saveAiConfig.addEventListener("click", () => {
    const apiKey = normalizeApiKey(elements.aiApiKeyInput.value);
    const model = elements.aiModelInput.value.trim() || DEFAULT_AI_MODEL;
    const baseUrl = normalizeBaseUrl(elements.aiBaseUrlInput.value);
    const apiMode = normalizeApiMode(elements.aiApiModeInput.value, baseUrl);
    saveAiConfig({
      apiKey,
      model,
      baseUrl,
      apiMode,
    });
    elements.aiApiKeyInput.value = apiKey;
    elements.aiModelInput.value = model;
    elements.aiBaseUrlInput.value = baseUrl;
    elements.aiApiModeInput.value = apiMode;
    renderAiStatus();
    closeAiConfigModal();
    showToast("AI配置已保存。");
  });
  elements.clearAiConfig.addEventListener("click", () => {
    localStorage.removeItem(AI_CONFIG_KEY);
    elements.aiApiKeyInput.value = "";
    elements.aiModelInput.value = DEFAULT_AI_MODEL;
    elements.aiBaseUrlInput.value = DEFAULT_AI_BASE_URL;
    elements.aiApiModeInput.value = DEFAULT_AI_API_MODE;
    renderAiStatus();
    showToast("AI配置已清除。");
  });
  elements.aiConfigModal.addEventListener("click", (event) => {
    if (event.target === elements.aiConfigModal) closeAiConfigModal();
  });

  elements.closeMistakeResult.addEventListener("click", closeMistakeResultModal);
  elements.mistakeResultModal.addEventListener("click", (event) => {
    if (event.target === elements.mistakeResultModal) closeMistakeResultModal();
  });
  elements.mistakeResultImage.addEventListener("click", openMistakeImagePreview);
  elements.closeMistakeImagePreview.addEventListener("click", closeMistakeImagePreview);
  elements.mistakeImagePreviewModal.addEventListener("click", (event) => {
    if (event.target === elements.mistakeImagePreviewModal) closeMistakeImagePreview();
  });
  elements.mistakeCropBox.addEventListener("pointerdown", startPreviewCropDrag);
  elements.mistakeCropBox.addEventListener("pointermove", movePreviewCropDrag);
  elements.mistakeCropBox.addEventListener("pointerup", endPreviewCropDrag);
  elements.mistakeCropBox.addEventListener("pointercancel", endPreviewCropDrag);
  elements.applyPreviewCrop.addEventListener("click", applyPreviewCrop);
  elements.resetPreviewCrop.addEventListener("click", resetPreviewCropBox);
  elements.previewCropRatio.addEventListener("change", resetPreviewCropBox);
  elements.rotateMistakeLeft.addEventListener("click", () => transformMistakeImage({ rotate: -90 }));
  elements.rotateMistakeRight.addEventListener("click", () => transformMistakeImage({ rotate: 90 }));
  elements.enhanceMistakeImage.addEventListener("click", () => transformMistakeImage({ enhance: true }));
  elements.restoreMistakeImage.addEventListener("click", restoreMistakeImage);
  elements.applyMistakeEdit.addEventListener("click", applyMistakeImageEdit);
  elements.cropMistakeImage.addEventListener("click", cropMistakeImage);
  elements.mistakeRecognizedText.addEventListener("input", saveMistakeResultEdits);
  elements.mistakeSummaryText.addEventListener("input", saveMistakeResultEdits);
  elements.reanalyzeMistake.addEventListener("click", () => {
    const todo = getTodoById(activeMistakeTodoId);
    if (todo) analyzeMistakeWithAI(todo);
  });
  elements.retakeMistakePhoto.addEventListener("change", (event) => {
    const todo = getTodoById(activeMistakeTodoId);
    const file = event.target.files?.[0];
    if (!todo || !file) return;
    const mistake = ensureTodoMistake(todo);
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      mistake.image = String(reader.result || "");
      mistake.originalImage = mistake.image;
      mistake.recognizedText = `已上传《${file.name}》，等待AI识别。`;
      mistake.summary = "";
      mistake.similarQuestions = [];
      saveState();
      renderTodos();
      openMistakeResult(todo);
      showToast("请先编辑或高清处理图片，再开始AI识别。");
    });
    reader.readAsDataURL(file);
  });

  document.querySelectorAll("[data-close-page]").forEach((button) => {
    button.addEventListener("click", closeEmbeddedPage);
  });

  document.querySelectorAll(".mode-tab").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  elements.mistakeTips.addEventListener("click", (event) => {
    if (event.target.closest(".mistake-tip-input")) return;
    showNextMistakeTips();
  });
  elements.mistakeTips.addEventListener("keydown", (event) => {
    if (event.target.closest(".mistake-tip-input")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showNextMistakeTips();
    }
  });
  elements.mistakeTipList.addEventListener("input", (event) => {
    if (!event.target.classList.contains("mistake-tip-input")) return;
    const index = Number(event.target.dataset.tipIndex);
    state.mistakeTips[mistakeTipIndex].tips[index] = event.target.value.trim();
    saveState();
  });

  elements.startPauseBtn.addEventListener("click", () => {
    if (isRunning) pauseTimer();
    else startTimer();
  });

  elements.resetBtn.addEventListener("click", () => setMode(mode));
  elements.skipBtn.addEventListener("click", () => completeTimer(false));

  [elements.focusMinutes, elements.shortMinutes, elements.longMinutes].forEach((input) => {
    input.addEventListener("change", () => {
      const value = Math.max(1, Math.min(Number(input.max), Number(input.value) || 1));
      input.value = value;
      state.settings[input.id] = value;
      saveState();
      if (!isRunning && MODES[mode].minutesKey === input.id) setMode(mode);
    });
  });

  elements.todoForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = elements.todoInput.value.trim();
    const estimatedMinutes = Math.max(1, Number(elements.todoMinutes.value || state.settings.focusMinutes));
    if (!text) return;
    state.todos.push({ id: createId(), text, estimatedMinutes, completedSegments: 0, done: false });
    elements.todoInput.value = "";
    elements.todoMinutes.value = "";
    renderTodos();
    saveState();
  });

  elements.reminderForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = elements.reminderText.value.trim();
    const time = elements.reminderTime.value;
    if (!text || !time) {
      showToast("请填写提醒内容和时间。");
      return;
    }
    state.reminders.push({ id: createId(), text, time, lastFired: "" });
    elements.reminderText.value = "";
    elements.reminderTime.value = "";
    saveState();
    renderReminders();
  });

  document.querySelectorAll(".goal-card").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const type = form.dataset.goalType;
      const input = form.querySelector("input");
      const title = input.value.trim();
      if (!title) return;

      state.goals.push({
        id: createId(),
        type,
        title,
        reward: GOAL_REWARDS[type],
        periodKey: getGoalPeriodKey(type),
        done: false,
        createdAt: Date.now(),
      });
      input.value = "";
      saveState();
      renderGoals();
      renderHomeGoals();
    });
  });

  elements.wishForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = elements.wishTitle.value.trim();
    const cost = Math.max(1, Number(elements.wishCost.value || 1));
    if (!title) return;

    state.wishes.push({
      id: createId(),
      title,
      cost,
      done: false,
      createdAt: Date.now(),
    });
    elements.wishTitle.value = "";
    elements.wishCost.value = "";
    saveState();
    renderWishes();
    renderHomeWish();
  });

  elements.scholarshipForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const rate = Math.max(1, Number(elements.scholarshipRate.value || 10));
    const stars = Math.max(1, Number(elements.scholarshipStars.value || 0));
    if (!stars) return;
    state.scholarship.rate = rate;

    if (!spendStars(stars)) {
      showToast("星星还不够兑换奖学金。");
      saveState();
      renderScholarship();
      return;
    }

    const amount = stars / rate;
    state.scholarship.balance = Number(state.scholarship.balance || 0) + amount;
    state.scholarship.records.unshift({
      id: createId(),
      stars,
      amount,
      rate,
      date: todayKey(),
      createdAt: Date.now(),
    });
    state.rewards.unshift({
      id: createId(),
      label: `兑换奖学金 ${amount.toFixed(2)} 元`,
      stars: -stars,
      date: todayKey(),
      createdAt: Date.now(),
    });
    elements.scholarshipStars.value = "";
    saveState();
    renderScholarship();
    renderRewards();
    renderTimer();
    showToast(`已兑换奖学金 ${amount.toFixed(2)} 元。`);
  });

  elements.prevMonthBtn.addEventListener("click", () => {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
    renderCalendar();
  });

  elements.nextMonthBtn.addEventListener("click", () => {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
    renderCalendar();
  });

  elements.studyForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = elements.studyTitle.value.trim();
    const minutes = Math.max(5, Number(elements.studyMinutes.value || state.settings.focusMinutes));
    const note = elements.studyNote.value.trim();
    if (!title) return;

    state.studyPlans.push({
      id: createId(),
      date: selectedPlanDate,
      title,
      minutes,
      note,
      done: false,
      createdAt: Date.now(),
    });
    elements.studyTitle.value = "";
    elements.studyMinutes.value = "";
    elements.studyNote.value = "";
    saveState();
    renderCalendar();
    renderStudyPlans();
    renderTimer();
  });

  elements.notifyBtn.addEventListener("click", async () => {
    if (!("Notification" in window)) {
      showToast("当前浏览器不支持系统通知。");
      return;
    }

    const permission = await Notification.requestPermission();
    showToast(permission === "granted" ? "系统通知已开启。" : "系统通知未开启，将使用页面内提醒。");
  });
}

try {
  document.documentElement.dataset.appReady = "booting";
  setAuthMode("login");
  bindEvents();
  renderAuthState();
  renderAll();
  loadBackendState();
  setInterval(checkReminders, 1000);
  document.documentElement.dataset.appReady = "true";
} catch (error) {
  document.documentElement.dataset.appReady = "error";
  reportStartupError(error);
}
