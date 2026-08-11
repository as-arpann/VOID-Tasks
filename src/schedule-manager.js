// ==========================================================================
// PADHAII SCHEDULE MANAGER — Full Feature Module
// Handles: Subjects, Weekly Slots, Dashboard, Server Sync,
//          UsageStats (Phase 2), NotificationListener (Phase 3),
//          Smart Notifications (Phase 4)
// ==========================================================================

// ─── CONSTANTS & HELPERS ──────────────────────────────────────────────────

const SCHEDULE_KEY = 'padhaii_schedule_v1';
const SCHEDULE_SYNC_TIME_KEY = 'padhaii_schedule_last_sync';
const GEMINI_KEY_STORAGE = 'padhaii_gemini_api_key';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SUBJECT_COLORS = [
  '#8b7cf6', '#f87171', '#34d399', '#fbbf24', '#60a5fa',
  '#f472b6', '#a78bfa', '#fb923c', '#4ade80', '#38bdf8'
];
const ACTIVITY_TYPES = ['Class', 'Homework', 'Revision', 'Mock Test', 'DPP'];

function schId() {
  return 'sch' + Math.random().toString(36).substr(2, 9) + Date.now();
}

function schFormatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function schTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function schTodayDayName() {
  return DAY_FULL[new Date().getDay()];
}

function schActivityClass(type) {
  const map = {
    'Class': 'type-class',
    'Homework': 'type-homework',
    'Revision': 'type-revision',
    'Mock Test': 'type-mocktest',
    'DPP': 'type-dpp'
  };
  return map[type] || 'type-class';
}

function schShowToast(msg, duration = 2500) {
  let toast = document.getElementById('sch-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sch-toast';
    toast.className = 'sch-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ─── STATE ───────────────────────────────────────────────────────────────

let scheduleData = { subjects: [], slots: [] };
let schSelectedDay = DAY_FULL[new Date().getDay()];
let schUsageData = {}; // { packageName: minutesUsed }
let schUsagePermission = false;
let schNotifPermission = false;
let schAiLog = [];
let schEditingSubjectId = null;
let schEditingSlotId = null;
let schPrevUsageSnapshot = {};
let schNotifListenerActive = false;

// ─── PERSISTENCE ─────────────────────────────────────────────────────────

function schLoad() {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    if (raw) scheduleData = JSON.parse(raw);
    if (!scheduleData.subjects) scheduleData.subjects = [];
    if (!scheduleData.slots) scheduleData.slots = [];
  } catch (e) {
    scheduleData = { subjects: [], slots: [] };
  }
}

function schSave() {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(scheduleData));
}

// ─── SERVER SYNC ─────────────────────────────────────────────────────────

async function schSyncToServer() {
  const token = localStorage.getItem('authToken');
  const serverUrl = localStorage.getItem('serverUrl') || '';
  if (!token || !serverUrl) return;

  const lastSync = parseInt(localStorage.getItem(SCHEDULE_SYNC_TIME_KEY) || '0', 10);
  const base = serverUrl.replace(/\/$/, '');

  try {
    const res = await fetch(`${base}/api/schedule/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        subjects: scheduleData.subjects,
        slots: scheduleData.slots,
        deletedSubjectIds: [],
        deletedSlotIds: [],
        lastSyncTime: lastSync
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.subjects) {
        // Merge server data
        const subMap = new Map(scheduleData.subjects.map(s => [s.id, s]));
        data.subjects.forEach(ss => {
          const local = subMap.get(ss.id);
          if (!local || (ss.updatedTime || 0) > (local.updatedTime || 0)) subMap.set(ss.id, ss);
        });
        scheduleData.subjects = Array.from(subMap.values());

        const slotMap = new Map(scheduleData.slots.map(s => [s.id, s]));
        data.slots.forEach(ss => {
          const local = slotMap.get(ss.id);
          if (!local || (ss.updatedTime || 0) > (local.updatedTime || 0)) slotMap.set(ss.id, ss);
        });
        scheduleData.slots = Array.from(slotMap.values());

        schSave();
        localStorage.setItem(SCHEDULE_SYNC_TIME_KEY, String(Date.now()));
        schRenderAll();
      }
    }
  } catch (e) {
    console.warn('[Schedule] Sync failed:', e);
  }
}

// ─── CAPACITOR BRIDGE ────────────────────────────────────────────────────

let UsageStatsPlugin = null;
let NotificationListenerPlugin = null;
let LocalNotificationsPlugin = null;

async function schInitCapacitorPlugins() {
  try {
    const { registerPlugin, Capacitor } = await import('../node_modules/@capacitor/core/dist/index.js').catch(() => ({ registerPlugin: null, Capacitor: null }));
    
    if (!Capacitor || !Capacitor.isNativePlatform()) {
      console.log('[Schedule] Running in browser — native plugins disabled');
      return;
    }

    // Register custom plugins
    if (registerPlugin) {
      UsageStatsPlugin = registerPlugin('UsageStats');
      NotificationListenerPlugin = registerPlugin('NotificationListener');
    }

    // Official Capacitor plugins
    try {
      const { LocalNotifications } = await import('../node_modules/@capacitor/local-notifications/dist/index.js');
      LocalNotificationsPlugin = LocalNotifications;
      await schSetupLocalNotificationListeners();
    } catch (e) {
      console.warn('[Schedule] LocalNotifications not available:', e);
    }

    // Init usage stats
    if (UsageStatsPlugin) {
      await schCheckUsagePermission();
    }

    // Init notification listener
    if (NotificationListenerPlugin) {
      await schCheckNotifListenerPermission();
    }
  } catch (e) {
    console.warn('[Schedule] Capacitor init failed (browser mode):', e);
  }
}

// ─── USAGE STATS (PHASE 2) ────────────────────────────────────────────────

async function schCheckUsagePermission() {
  if (!UsageStatsPlugin) return;
  try {
    const { granted } = await UsageStatsPlugin.checkPermission();
    schUsagePermission = granted;
    if (granted) await schFetchUsageData();
    schRenderUsageCard();
  } catch (e) {
    console.warn('[UsageStats] checkPermission failed:', e);
  }
}

async function schRequestUsagePermission() {
  if (!UsageStatsPlugin) {
    schShowToast('⚠️ Native features only available in Android app');
    return;
  }
  try {
    await UsageStatsPlugin.requestPermission();
    // User returns from settings — check again
    setTimeout(async () => {
      await schCheckUsagePermission();
    }, 1000);
  } catch (e) {
    schShowToast('Could not open Usage Access settings');
  }
}

async function schFetchUsageData() {
  if (!UsageStatsPlugin || !schUsagePermission) return;
  const packages = scheduleData.subjects.map(s => s.packageName).filter(p => p && p.length > 3);
  if (packages.length === 0) return;

  try {
    const { usage } = await UsageStatsPlugin.getDailyUsage({ packages });
    schUsageData = usage || {};
    schRenderUsageCard();
  } catch (e) {
    console.warn('[UsageStats] getDailyUsage failed:', e);
  }
}

// ─── NOTIFICATION LISTENER (PHASE 3) ──────────────────────────────────────

async function schCheckNotifListenerPermission() {
  if (!NotificationListenerPlugin) return;
  try {
    const { granted } = await NotificationListenerPlugin.checkPermission();
    schNotifPermission = granted;
    if (granted) {
      const monPkgs = scheduleData.subjects.map(s => s.packageName).filter(Boolean);
      await NotificationListenerPlugin.setMonitoredPackages({ packages: monPkgs });
      await schSetupNotifListenerEvents();
    }
    schRenderNotifCard();
  } catch (e) {
    console.warn('[NotifListener] checkPermission failed:', e);
  }
}

async function schSetupNotifListenerEvents() {
  if (!NotificationListenerPlugin || schNotifListenerActive) return;
  schNotifListenerActive = true;

  NotificationListenerPlugin.addListener('notificationReceived', async (notif) => {
    console.log('[NotifListener] Received:', notif);
    await schClassifyNotification(notif);
  });
}

async function schClassifyNotification(notif) {
  const apiKey = localStorage.getItem(GEMINI_KEY_STORAGE) || '';
  if (!apiKey) {
    schAddAiLog('ignore', notif.title, 'No Gemini API key set');
    return;
  }

  const subject = scheduleData.subjects.find(s => s.packageName === notif.pkg);
  const subjectName = subject ? subject.name : notif.pkg;

  const prompt = `You are a smart notification classifier for a student study app.
Classify this notification from "${subjectName}" app into exactly one category:
- "class-cancel": Class, lecture, or session is cancelled, postponed, or rescheduled
- "test-update": Test, exam, quiz, or mock test date/time has changed or new info
- "ignore": Not relevant to schedule changes

Notification Title: "${notif.title}"
Notification Text: "${notif.text}"

Reply with ONLY the category word: class-cancel, test-update, or ignore`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 10, temperature: 0.1 }
        })
      }
    );

    if (!res.ok) throw new Error(`Gemini API ${res.status}`);
    const data = await res.json();
    const raw = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toLowerCase();
    const category = ['class-cancel', 'test-update', 'ignore'].find(c => raw.includes(c)) || 'ignore';

    schAddAiLog(category, notif.title, `→ ${subjectName}`);

    if (category === 'class-cancel') {
      // Find today's slot for this subject and mark cancelled
      const today = schTodayDayName();
      const affectedSlots = scheduleData.slots.filter(
        s => s.day === today && scheduleData.subjects.find(sub => sub.id === s.subjectId && sub.packageName === notif.pkg)
      );
      affectedSlots.forEach(s => {
        s.status = 'cancelled';
        s.updatedTime = Date.now();
      });
      schSave();
      schRenderAll();
      schShowToast(`🚫 ${subjectName} class marked as cancelled`, 4000);
      schSyncToServer();

    } else if (category === 'test-update') {
      schShowToast(`📢 Test update from ${subjectName} — check schedule`, 4000);
    }
  } catch (e) {
    console.warn('[Gemini] Classification failed:', e);
    schAddAiLog('ignore', notif.title, 'Gemini error');
  }
}

function schAddAiLog(category, title, detail) {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  schAiLog.unshift({ category, title: title.substring(0, 40), detail, timeStr });
  if (schAiLog.length > 20) schAiLog.pop();
  schRenderAiLog();
}

// ─── SMART NOTIFICATIONS (PHASE 4) ────────────────────────────────────────

async function schSetupLocalNotificationListeners() {
  if (!LocalNotificationsPlugin) return;

  await LocalNotificationsPlugin.requestPermissions();

  LocalNotificationsPlugin.addListener('localNotificationReceived', async (notification) => {
    const extra = notification.extra || {};
    if (extra.type === 'usage_check') {
      await schHandleUsageCheckNotification(extra);
    }
  });
}

async function schHandleUsageCheckNotification(extra) {
  const { slotId, pkg, subjectName, scheduledMinutes } = extra;
  if (!pkg || !UsageStatsPlugin || !schUsagePermission) {
    await schFireReminderNotification(slotId, subjectName);
    return;
  }

  const prev = schPrevUsageSnapshot[pkg] || 0;

  try {
    const { usage } = await UsageStatsPlugin.getDailyUsage({ packages: [pkg] });
    const current = (usage || {})[pkg] || 0;
    const delta = current - prev;

    if (delta >= 2) {
      // App was used for at least 2 mins in last ~10 min window — no reminder
      console.log(`[SmartNotif] ${subjectName} was used (${delta} min) — no reminder`);
      schUsageData[pkg] = current;
      schRenderUsageCard();
    } else {
      await schFireReminderNotification(slotId, subjectName);
    }
  } catch (e) {
    await schFireReminderNotification(slotId, subjectName);
  }
}

async function schFireReminderNotification(slotId, subjectName) {
  if (!LocalNotificationsPlugin) return;
  try {
    await LocalNotificationsPlugin.schedule({
      notifications: [{
        id: Math.floor(Math.random() * 100000),
        title: '📚 Class Reminder',
        body: `${subjectName} class started 15 min ago — did you attend?`,
        schedule: { at: new Date(Date.now() + 1000) },
        extra: { type: 'reminder', slotId }
      }]
    });
  } catch (e) {
    console.warn('[SmartNotif] Failed to fire reminder:', e);
  }
}

async function schScheduleClassCheck(slot, subject) {
  if (!LocalNotificationsPlugin) return;

  const today = new Date();
  const todayStr = schTodayStr();
  const todayDayName = schTodayDayName();

  if (slot.day !== todayDayName) return;

  const [startH, startM] = slot.startTime.split(':').map(Number);
  const classTime = new Date(today);
  classTime.setHours(startH, startM, 0, 0);

  if (classTime <= today) return; // Already past

  const checkTime = new Date(classTime.getTime() + 10 * 60 * 1000); // +10 min

  // Snapshot current usage before class starts
  if (UsageStatsPlugin && schUsagePermission && subject.packageName) {
    try {
      const { usage } = await UsageStatsPlugin.getDailyUsage({ packages: [subject.packageName] });
      schPrevUsageSnapshot[subject.packageName] = (usage || {})[subject.packageName] || 0;
    } catch (e) {}
  }

  try {
    await LocalNotificationsPlugin.schedule({
      notifications: [{
        id: Math.abs(slot.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 100000,
        title: '',
        body: '',
        schedule: { at: checkTime },
        extra: {
          type: 'usage_check',
          slotId: slot.id,
          pkg: subject.packageName,
          subjectName: subject.name,
          scheduledMinutes: schDurationMinutes(slot.startTime, slot.endTime)
        },
        silent: true
      }]
    });
    console.log(`[SmartNotif] Scheduled usage check for ${subject.name} at`, checkTime);
  } catch (e) {
    console.warn('[SmartNotif] Schedule failed:', e);
  }
}

function schDurationMinutes(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

async function schScheduleAllTodayClasses() {
  const today = schTodayDayName();
  const todaySlots = scheduleData.slots.filter(s => s.day === today && s.status === 'pending');
  for (const slot of todaySlots) {
    const subject = scheduleData.subjects.find(s => s.id === slot.subjectId);
    if (subject) await schScheduleClassCheck(slot, subject);
  }
}

// ─── RENDER: TODAY'S DASHBOARD CARD ───────────────────────────────────────

function schRenderTodayCard() {
  const today = schTodayDayName();
  const todayDate = new Date();
  const dateStr = todayDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

  const todaySlots = scheduleData.slots
    .filter(s => s.day === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const pending = todaySlots.filter(s => s.status === 'pending').length;
  const done = todaySlots.filter(s => s.status === 'done').length;
  const cancelled = todaySlots.filter(s => s.status === 'cancelled').length;

  let slotsHtml = '';
  if (todaySlots.length === 0) {
    slotsHtml = `<div class="sch-empty-today">No sessions scheduled for today 🎉</div>`;
  } else {
    slotsHtml = todaySlots.map(slot => {
      const sub = scheduleData.subjects.find(s => s.id === slot.subjectId);
      if (!sub) return '';
      const color = sub.color || '#8b7cf6';
      const typeClass = schActivityClass(slot.activityType);
      const statusIcon = slot.status === 'done' ? '✓' : slot.status === 'cancelled' ? '✕' : '○';
      const btnClass = `status-${slot.status}`;
      return `
        <div class="sch-timeline-slot" data-slot-id="${slot.id}">
          <div class="sch-slot-time">
            <span class="sch-slot-start">${schFormatTime(slot.startTime)}</span>
            <span class="sch-slot-end">${schFormatTime(slot.endTime)}</span>
          </div>
          <div class="sch-slot-indicator" style="background:${color}22;border-left:3px solid ${color}"></div>
          <div class="sch-slot-info">
            <div class="sch-slot-subject" style="color:${color}">${sub.icon || '📚'} ${sub.name}</div>
            <div class="sch-slot-meta">
              <span class="sch-slot-type ${typeClass}">${slot.activityType}</span>
              ${sub.packageName ? `<span class="sch-slot-pkg">${sub.packageName}</span>` : ''}
            </div>
          </div>
          <button class="sch-slot-status-btn ${btnClass}" 
                  onclick="schCycleSlotStatus('${slot.id}')" 
                  title="Tap to cycle status">
            ${statusIcon}
          </button>
        </div>
      `;
    }).join('');
  }

  const el = document.getElementById('sch-today-card');
  if (!el) return;
  el.innerHTML = `
    <div class="sch-today-header">
      <div class="sch-today-title">
        <span>📅 Today's Schedule</span>
        <span class="sch-today-date">${dateStr}</span>
      </div>
      <div class="sch-today-stats">
        <div class="sch-stat"><span class="sch-stat-num pending">${pending}</span><span class="sch-stat-label">Pending</span></div>
        <div class="sch-stat"><span class="sch-stat-num done">${done}</span><span class="sch-stat-label">Done</span></div>
        <div class="sch-stat"><span class="sch-stat-num cancelled">${cancelled}</span><span class="sch-stat-label">Cancelled</span></div>
      </div>
    </div>
    <div class="sch-timeline">${slotsHtml}</div>
  `;
}

// ─── RENDER: USAGE STATS CARD ─────────────────────────────────────────────

function schRenderUsageCard() {
  const el = document.getElementById('sch-usage-card');
  if (!el) return;

  if (!schUsagePermission) {
    el.innerHTML = `
      <div class="sch-usage-title">⏱ Today's Study Hours <span style="font-size:0.6rem;color:rgba(255,255,255,0.25);font-weight:400">(Phase 2 — Android only)</span></div>
      <button class="sch-usage-permission-btn" onclick="schRequestUsagePermission()">
        🔓 Grant Usage Access Permission
      </button>
    `;
    return;
  }

  const subjectsWithPkg = scheduleData.subjects.filter(s => s.packageName && s.packageName.length > 3);
  if (subjectsWithPkg.length === 0) {
    el.innerHTML = `<div class="sch-usage-title">⏱ Today's Study Hours</div><div style="font-size:0.75rem;color:rgba(255,255,255,0.25);text-align:center;padding:12px">Add subjects with package names to see usage</div>`;
    return;
  }

  const maxMins = Math.max(...subjectsWithPkg.map(s => schUsageData[s.packageName] || 0), 60);

  const barsHtml = subjectsWithPkg.map(sub => {
    const mins = schUsageData[sub.packageName] || 0;
    const pct = Math.min((mins / maxMins) * 100, 100);
    const color = sub.color || '#8b7cf6';
    const label = mins === 0 ? '0 min' : mins < 60 ? `${mins} min` : `${Math.floor(mins/60)}h ${mins%60}m`;
    return `
      <div class="sch-usage-bar-item">
        <div class="sch-usage-bar-header">
          <span class="sch-usage-bar-subject">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
            ${sub.icon || ''} ${sub.name}
          </span>
          <span class="sch-usage-bar-mins">${label}</span>
        </div>
        <div class="sch-usage-bar-track">
          <div class="sch-usage-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div class="sch-usage-title" style="display:flex;justify-content:space-between;align-items:center">
      <span>⏱ Today's Study Hours</span>
      <button onclick="schFetchUsageData()" style="background:none;border:none;color:#8b7cf6;font-size:0.7rem;cursor:pointer;padding:0">↻ Refresh</button>
    </div>
    <div class="sch-usage-bar-list">${barsHtml}</div>
  `;
}

// ─── RENDER: NOTIFICATION MONITOR CARD ────────────────────────────────────

function schRenderNotifCard() {
  const el = document.getElementById('sch-notif-card');
  if (!el) return;

  const geminiKey = localStorage.getItem(GEMINI_KEY_STORAGE) || '';
  const monPkgs = scheduleData.subjects.map(s => s.packageName).filter(Boolean);
  const statusText = schNotifPermission ? 'Active' : 'Inactive';
  const statusClass = schNotifPermission ? 'active' : 'inactive';

  const pkgListHtml = monPkgs.map(pkg => {
    const sub = scheduleData.subjects.find(s => s.packageName === pkg);
    const color = sub ? sub.color : '#8b7cf6';
    return `<div class="sch-notif-pkg-item">
      <div class="sch-notif-pkg-dot" style="background:${color}"></div>
      <span class="sch-notif-pkg-name">${pkg}</span>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="sch-notif-header">
      <span class="sch-notif-title">🔔 Notification Monitor <span style="font-size:0.6rem;font-weight:400;color:rgba(255,255,255,0.25)">(Phase 3)</span></span>
      <span class="sch-notif-status ${statusClass}">${statusText}</span>
    </div>
    <div class="sch-notif-content">
      ${!schNotifPermission ? `<button class="sch-notif-permission-btn" onclick="schRequestNotifPermission()">🔓 Grant Notification Access</button>` : ''}
      ${monPkgs.length > 0 ? `<div style="font-size:0.65rem;color:rgba(255,255,255,0.3);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em">Monitoring ${monPkgs.length} app(s)</div><div class="sch-notif-pkg-list">${pkgListHtml}</div>` : '<div style="font-size:0.75rem;color:rgba(255,255,255,0.25)">Add subjects with package names to monitor notifications</div>'}
      <div class="sch-gemini-input-wrap">
        <label class="sch-gemini-label">🤖 Gemini API Key (for AI classification)</label>
        <input id="sch-gemini-key" class="sch-gemini-input" type="password" 
               placeholder="AIza..." 
               value="${geminiKey}"
               onchange="schSaveGeminiKey(this.value)"
               oninput="schSaveGeminiKey(this.value)" />
      </div>
      <div id="sch-ai-log" class="sch-ai-log" style="${schAiLog.length === 0 ? 'display:none' : ''}"></div>
    </div>
  `;

  schRenderAiLog();
}

function schRenderAiLog() {
  const el = document.getElementById('sch-ai-log');
  if (!el) return;
  if (schAiLog.length === 0) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = schAiLog.map(log => `
    <div class="sch-ai-log-entry">
      <span class="sch-ai-log-time">${log.timeStr}</span>
      <span class="sch-ai-log-tag ${log.category}">[${log.category}]</span>
      <span>${log.title} ${log.detail ? '— ' + log.detail : ''}</span>
    </div>
  `).join('');
}

function schSaveGeminiKey(val) {
  localStorage.setItem(GEMINI_KEY_STORAGE, val.trim());
}

async function schRequestNotifPermission() {
  if (!NotificationListenerPlugin) {
    schShowToast('⚠️ Available only in Android app');
    return;
  }
  try {
    await NotificationListenerPlugin.requestPermission();
    setTimeout(async () => {
      await schCheckNotifListenerPermission();
    }, 1500);
  } catch (e) {
    schShowToast('Could not open Notification Access settings');
  }
}

// ─── RENDER: SUBJECTS LIST ─────────────────────────────────────────────────

function schRenderSubjectsList() {
  const el = document.getElementById('sch-subjects-list');
  if (!el) return;

  if (scheduleData.subjects.length === 0) {
    el.innerHTML = `
      <button class="sch-add-subject-btn" onclick="schOpenAddSubjectModal()">
        <span style="font-size:1rem">+</span> Add your first subject
      </button>
    `;
    return;
  }

  el.innerHTML = scheduleData.subjects.map(sub => `
    <div class="sch-subject-chip" onclick="schOpenEditSubjectModal('${sub.id}')">
      <div class="sch-subject-dot" style="background:${sub.color || '#8b7cf6'}"></div>
      <span style="font-size:1rem;line-height:1">${sub.icon || '📚'}</span>
      <div class="sch-subject-name">${sub.name}</div>
      <span class="sch-subject-pkg">${sub.packageName || 'no package'}</span>
      <button class="sch-subject-delete" onclick="event.stopPropagation();schDeleteSubject('${sub.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
      </button>
    </div>
  `).join('') + `
    <button class="sch-add-subject-btn" onclick="schOpenAddSubjectModal()">
      <span style="font-size:1rem">+</span> Add subject
    </button>
  `;
}

// ─── RENDER: WEEKLY GRID ───────────────────────────────────────────────────

function schRenderWeekGrid() {
  const el = document.getElementById('sch-week-grid');
  if (!el) return;

  const todayIdx = new Date().getDay();
  const today = new Date();

  el.innerHTML = DAY_FULL.map((day, idx) => {
    const date = new Date(today);
    date.setDate(today.getDate() - today.getDay() + idx);
    const daySlots = scheduleData.slots.filter(s => s.day === day);
    const isToday = idx === todayIdx;
    const isSelected = day === schSelectedDay;

    const dotsHtml = daySlots.slice(0, 3).map(slot => {
      const sub = scheduleData.subjects.find(s => s.id === slot.subjectId);
      return `<div class="sch-day-dot" style="background:${sub ? sub.color : '#8b7cf6'}"></div>`;
    }).join('');

    return `
      <div class="sch-day-pill ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" 
           onclick="schSelectDay('${day}')">
        <span class="sch-day-name">${DAYS[idx]}</span>
        <span class="sch-day-num">${date.getDate()}</span>
        <div class="sch-day-dot-row">${dotsHtml}</div>
      </div>
    `;
  }).join('');

  schRenderDaySlots();
}

function schRenderDaySlots() {
  const el = document.getElementById('sch-day-slots');
  if (!el) return;

  const daySlots = scheduleData.slots
    .filter(s => s.day === schSelectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  let innerHtml = `<div class="sch-day-slots-header">${schSelectedDay}'s Sessions</div>`;

  if (daySlots.length === 0) {
    innerHtml += `<div style="padding:20px;text-align:center;color:rgba(255,255,255,0.2);font-size:0.78rem">No sessions for ${schSelectedDay}</div>`;
  } else {
    innerHtml += daySlots.map(slot => {
      const sub = scheduleData.subjects.find(s => s.id === slot.subjectId);
      if (!sub) return '';
      const color = sub.color || '#8b7cf6';
      const typeClass = schActivityClass(slot.activityType);
      return `
        <div class="sch-slot-row">
          <div class="sch-slot-row-color" style="background:${color}"></div>
          <div class="sch-slot-row-info">
            <div class="sch-slot-row-subject">${sub.icon || '📚'} ${sub.name} <span class="sch-slot-type ${typeClass}" style="font-size:0.58rem;vertical-align:middle">${slot.activityType}</span></div>
            <div class="sch-slot-row-time">${schFormatTime(slot.startTime)} – ${schFormatTime(slot.endTime)}</div>
          </div>
          <div class="sch-slot-row-actions">
            <button class="sch-slot-row-btn" onclick="schOpenEditSlotModal('${slot.id}')">Edit</button>
            <button class="sch-slot-row-btn danger" onclick="schDeleteSlot('${slot.id}')">Del</button>
          </div>
        </div>
      `;
    }).join('');
  }

  innerHtml += `<button class="sch-add-slot-btn" onclick="schOpenAddSlotModal()">+ Add session for ${schSelectedDay}</button>`;
  el.innerHTML = innerHtml;
}

function schSelectDay(day) {
  schSelectedDay = day;
  schRenderWeekGrid();
}

// ─── RENDER: ALL ───────────────────────────────────────────────────────────

function schRenderAll() {
  schRenderTodayCard();
  schRenderUsageCard();
  schRenderNotifCard();
  schRenderSubjectsList();
  schRenderWeekGrid();
}

// ─── SLOT STATUS CYCLE ─────────────────────────────────────────────────────

window.schCycleSlotStatus = function(slotId) {
  const slot = scheduleData.slots.find(s => s.id === slotId);
  if (!slot) return;
  const cycle = { pending: 'done', done: 'cancelled', cancelled: 'pending' };
  slot.status = cycle[slot.status] || 'pending';
  slot.updatedTime = Date.now();
  schSave();
  schRenderTodayCard();
  schSyncToServer();
};

// ─── SUBJECT CRUD ─────────────────────────────────────────────────────────

window.schDeleteSubject = function(id) {
  if (!confirm('Delete this subject? All its slots will also be removed.')) return;
  scheduleData.subjects = scheduleData.subjects.filter(s => s.id !== id);
  scheduleData.slots = scheduleData.slots.filter(s => s.subjectId !== id);
  schSave();
  schRenderAll();
  schSyncToServer();
  schShowToast('Subject deleted');
};

// ─── SLOT CRUD ────────────────────────────────────────────────────────────

window.schDeleteSlot = function(id) {
  scheduleData.slots = scheduleData.slots.filter(s => s.id !== id);
  schSave();
  schRenderAll();
  schSyncToServer();
  schShowToast('Session deleted');
};

// ─── MODALS: SUBJECT ──────────────────────────────────────────────────────

window.schOpenAddSubjectModal = function() {
  schEditingSubjectId = null;
  schOpenSubjectModal(null);
};

window.schOpenEditSubjectModal = function(id) {
  schEditingSubjectId = id;
  const sub = scheduleData.subjects.find(s => s.id === id);
  schOpenSubjectModal(sub);
};

function schOpenSubjectModal(sub) {
  const overlay = document.getElementById('sch-subject-modal');
  if (!overlay) return;

  const selectedColor = sub ? sub.color : SUBJECT_COLORS[scheduleData.subjects.length % SUBJECT_COLORS.length];
  const colorSwatchesHtml = SUBJECT_COLORS.map(c =>
    `<div class="sch-color-swatch ${c === selectedColor ? 'selected' : ''}" 
         style="background:${c}" 
         onclick="schSelectColor('${c}')" 
         data-color="${c}"></div>`
  ).join('');

  document.getElementById('sch-subject-modal-title').textContent = sub ? 'Edit Subject' : 'Add Subject';
  document.getElementById('sch-sub-name').value = sub ? sub.name : '';
  document.getElementById('sch-sub-pkg').value = sub ? (sub.packageName || '') : '';
  document.getElementById('sch-sub-icon').value = sub ? (sub.icon || '📚') : '📚';
  document.getElementById('sch-sub-colors').innerHTML = colorSwatchesHtml;
  document.getElementById('sch-sub-selected-color').value = selectedColor;

  overlay.classList.add('open');
}

window.schSelectColor = function(color) {
  document.querySelectorAll('#sch-sub-colors .sch-color-swatch').forEach(el => {
    el.classList.toggle('selected', el.dataset.color === color);
  });
  document.getElementById('sch-sub-selected-color').value = color;
};

window.schCloseSubjectModal = function() {
  document.getElementById('sch-subject-modal').classList.remove('open');
};

window.schSaveSubject = function() {
  const name = document.getElementById('sch-sub-name').value.trim();
  const pkg = document.getElementById('sch-sub-pkg').value.trim();
  const icon = document.getElementById('sch-sub-icon').value.trim() || '📚';
  const color = document.getElementById('sch-sub-selected-color').value || '#8b7cf6';

  if (!name) { schShowToast('Subject name is required'); return; }

  if (schEditingSubjectId) {
    const sub = scheduleData.subjects.find(s => s.id === schEditingSubjectId);
    if (sub) {
      sub.name = name; sub.packageName = pkg; sub.icon = icon; sub.color = color;
      sub.updatedTime = Date.now();
    }
  } else {
    scheduleData.subjects.push({
      id: schId(), name, packageName: pkg, icon, color,
      createdTime: Date.now(), updatedTime: Date.now()
    });
  }

  schSave();
  schCloseSubjectModal();
  schRenderAll();
  schSyncToServer();
  schShowToast(schEditingSubjectId ? 'Subject updated ✓' : 'Subject added ✓');
};

// ─── MODALS: SLOT ─────────────────────────────────────────────────────────

window.schOpenAddSlotModal = function() {
  schEditingSlotId = null;
  schOpenSlotModal(null);
};

window.schOpenEditSlotModal = function(id) {
  schEditingSlotId = id;
  const slot = scheduleData.slots.find(s => s.id === id);
  schOpenSlotModal(slot);
};

function schOpenSlotModal(slot) {
  const overlay = document.getElementById('sch-slot-modal');
  if (!overlay) return;

  if (scheduleData.subjects.length === 0) {
    schShowToast('Add a subject first!');
    return;
  }

  const subjectOptions = scheduleData.subjects.map(s =>
    `<option value="${s.id}" ${slot && slot.subjectId === s.id ? 'selected' : ''}>${s.icon || ''} ${s.name}</option>`
  ).join('');

  const dayOptions = DAY_FULL.map(d =>
    `<option value="${d}" ${(slot ? slot.day : schSelectedDay) === d ? 'selected' : ''}>${d}</option>`
  ).join('');

  const typePillsHtml = ACTIVITY_TYPES.map(t => {
    const isSelected = slot ? slot.activityType === t : t === 'Class';
    const cls = schActivityClass(t);
    return `<div class="sch-type-pill ${cls} ${isSelected ? 'selected' : ''}" 
                onclick="schSelectType('${t}')" 
                data-type="${t}">${t}</div>`;
  }).join('');

  document.getElementById('sch-slot-modal-title').textContent = slot ? 'Edit Session' : 'Add Session';
  document.getElementById('sch-slot-subject').innerHTML = subjectOptions;
  document.getElementById('sch-slot-day').innerHTML = dayOptions;
  document.getElementById('sch-slot-start').value = slot ? slot.startTime : '09:00';
  document.getElementById('sch-slot-end').value = slot ? slot.endTime : '10:30';
  document.getElementById('sch-slot-types').innerHTML = typePillsHtml;
  document.getElementById('sch-slot-selected-type').value = slot ? slot.activityType : 'Class';

  overlay.classList.add('open');
}

window.schSelectType = function(type) {
  document.querySelectorAll('#sch-slot-types .sch-type-pill').forEach(el => {
    el.classList.toggle('selected', el.dataset.type === type);
  });
  document.getElementById('sch-slot-selected-type').value = type;
};

window.schCloseSlotModal = function() {
  document.getElementById('sch-slot-modal').classList.remove('open');
};

window.schSaveSlot = async function() {
  const subjectId = document.getElementById('sch-slot-subject').value;
  const day = document.getElementById('sch-slot-day').value;
  const startTime = document.getElementById('sch-slot-start').value;
  const endTime = document.getElementById('sch-slot-end').value;
  const activityType = document.getElementById('sch-slot-selected-type').value || 'Class';

  if (!subjectId || !day || !startTime || !endTime) {
    schShowToast('Please fill all fields');
    return;
  }

  if (startTime >= endTime) {
    schShowToast('End time must be after start time');
    return;
  }

  if (schEditingSlotId) {
    const slot = scheduleData.slots.find(s => s.id === schEditingSlotId);
    if (slot) {
      slot.subjectId = subjectId; slot.day = day;
      slot.startTime = startTime; slot.endTime = endTime;
      slot.activityType = activityType; slot.updatedTime = Date.now();
    }
  } else {
    const newSlot = {
      id: schId(), subjectId, day, startTime, endTime,
      activityType, status: 'pending',
      createdTime: Date.now(), updatedTime: Date.now()
    };
    scheduleData.slots.push(newSlot);

    // Schedule smart notification for today's classes
    const subject = scheduleData.subjects.find(s => s.id === subjectId);
    if (subject && day === schTodayDayName()) {
      await schScheduleClassCheck(newSlot, subject);
    }
  }

  schSave();
  schCloseSlotModal();
  schRenderAll();
  schSyncToServer();
  schShowToast(schEditingSlotId ? 'Session updated ✓' : 'Session added ✓');
};

// ─── INIT ─────────────────────────────────────────────────────────────────

export async function initScheduleManager() {
  schLoad();
  schRenderAll();

  // Sync from server on startup
  setTimeout(schSyncToServer, 1500);

  // Init native plugins
  await schInitCapacitorPlugins();

  // Schedule today's smart notifications
  setTimeout(schScheduleAllTodayClasses, 3000);

  // Periodic usage refresh every 5 min
  setInterval(async () => {
    if (schUsagePermission) await schFetchUsageData();
  }, 5 * 60 * 1000);
}

// Expose functions used by inline onclick handlers
window.schOpenAddSubjectModal = window.schOpenAddSubjectModal;
window.schOpenEditSubjectModal = window.schOpenEditSubjectModal;
window.schOpenAddSlotModal = window.schOpenAddSlotModal;
window.schOpenEditSlotModal = window.schOpenEditSlotModal;
window.schSaveSubject = window.schSaveSubject;
window.schSaveSlot = window.schSaveSlot;
window.schCloseSubjectModal = window.schCloseSubjectModal;
window.schCloseSlotModal = window.schCloseSlotModal;
window.schRequestUsagePermission = schRequestUsagePermission;
window.schRequestNotifPermission = schRequestNotifPermission;
window.schFetchUsageData = schFetchUsageData;
window.schSaveGeminiKey = schSaveGeminiKey;
