// שכבת נתונים "אופליין תחילה": עותק מקומי מלא של הנתונים (IndexedDB) שממנו כל המסכים קוראים,
// ותור פעולות כתיבה שנשלח לשרת ברגע שיש חיבור. כך האפליקציה נפתחת ופועלת גם בלי אינטרנט.
import { useSyncExternalStore } from 'react';
import { remote, ApiRequestError } from './remote';
import { idbGet, idbSet, idbDel } from './idb';

const ALL_PARTS = ['classes', 'students', 'schedule', 'events', 'lessons'];
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const TYPE_LABELS = {
  late: 'איחור', absent: 'חיסור', positive: 'חיזוק חיובי', disturb: 'הפרעה',
  homework: 'לא הכין שיעורי בית', removal: 'הרחקה משיעור', noEquipment: 'ללא ציוד',
};
const NON_CARRYOVER = ['late', 'disturb'];

const emptyState = () => ({ classes: [], students: [], schedule: [], events: [], lessons: [], syncedAt: null });

let state = emptyState();
let queue = [];
let reachable = true;
let flushing = false;
let pulling = false;
let authError = false;
let syncPromise = null;
let started = false;
let mutations = 0;
let lastPull = 0;
let syncVersion = 0;
let statusSnap = computeStatus();
const listeners = new Set();

function computeStatus() {
  return {
    online: reachable && (typeof navigator === 'undefined' || navigator.onLine !== false),
    pending: queue.length,
    syncing: flushing || pulling,
    authError,
  };
}

function notify() {
  const next = computeStatus();
  const changed = Object.keys(next).some((k) => next[k] !== statusSnap[k]);
  if (changed) statusSnap = next;
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useSyncStatus() {
  return useSyncExternalStore(subscribe, () => statusSnap);
}
// עולה רק כשהעותק המקומי הוחלף בנתונים חדשים מהשרת (לא בכל פעולה מקומית)
export function useSyncVersion() {
  return useSyncExternalStore(subscribe, () => syncVersion);
}

export function pendingCount() { return queue.length; }

/* ---------- עזרים ---------- */

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nowTs = () => {
  const d = new Date();
  return `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const uid = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
const numOrNull = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

function matchEvent(e, b) {
  return (b.clientId && e.clientId === b.clientId) || (b.id != null && e.id === b.id);
}

function findEventById(id) {
  return state.events.find((e) => e.id === id || String(e.id) === String(id) || `c:${e.clientId}` === id || (e.clientId && e.clientId === id));
}

/* ---------- יישום פעולת כתיבה על העותק המקומי (אידמפוטנטי — מותר להריץ שוב) ---------- */

function applyOp(action, b) {
  switch (action) {
    case 'events_create': {
      if (state.events.some((e) => e.clientId === b.clientId)) return;
      const st = state.students.find((s) => s.id === b.studentId);
      const sch = state.schedule.find((e) => e.classId == b.classId && e.period == b.period);
      state = {
        ...state,
        events: [...state.events, {
          id: `c:${b.clientId}`, clientId: b.clientId, ts: b.ts, classId: b.classId, studentId: b.studentId,
          studentName: st?.fullName || '', type: b.type, date: b.date, period: b.period,
          subject: sch?.subject || '', note: b.note || '', syncedToMashov: false,
        }],
      };
      return;
    }
    case 'events_delete':
      state = { ...state, events: state.events.filter((e) => !matchEvent(e, b)) };
      return;
    case 'events_set_note':
      state = { ...state, events: state.events.map((e) => (matchEvent(e, b) ? { ...e, note: b.note } : e)) };
      return;
    case 'lesson_topic': {
      const idx = state.lessons.findIndex((l) => l.classId === b.classId && l.date === b.date && l.period === b.period);
      const updatedAt = nowTs();
      if (idx >= 0) {
        const lessons = state.lessons.slice();
        lessons[idx] = { ...lessons[idx], topic: b.topic, updatedAt };
        state = { ...state, lessons };
      } else {
        state = { ...state, lessons: [...state.lessons, { id: -Date.now(), classId: b.classId, date: b.date, period: b.period, topic: b.topic, updatedAt }] };
      }
      return;
    }
    case 'seating_update':
      state = { ...state, classes: state.classes.map((c) => (c.id === b.classId ? { ...c, desks: b.desks } : c)) };
      return;
    default:
  }
}

/* ---------- שמירה מקומית ---------- */

let snapshotTimer = null;
function persistSnapshotSoon() {
  clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(persistSnapshotNow, 1500);
}
function persistSnapshotNow() {
  clearTimeout(snapshotTimer);
  idbSet('snapshot', state).catch(() => {});
}
function persistQueue() {
  idbSet('queue', queue).catch(() => {});
}

export async function initOffline() {
  try {
    const [snap, q] = await Promise.all([idbGet('snapshot'), idbGet('queue')]);
    if (snap) state = { ...emptyState(), ...snap };
    if (Array.isArray(q)) queue = q;
    // ייתכן שהצילום המקומי ישן מהתור — מחילים שוב את הפעולות הממתינות (אידמפוטנטי)
    for (const op of queue) applyOp(op.action, op.body);
  } catch (e) {
    console.warn('offline store init failed', e);
  }
  statusSnap = computeStatus();
  notify();
}

export async function clearLocalData() {
  state = emptyState();
  queue = [];
  started = false;
  await Promise.all([idbDel('snapshot'), idbDel('queue')]).catch(() => {});
  syncVersion++;
  notify();
}

/* ---------- סנכרון עם השרת ---------- */

function enqueue(action, body) {
  // החלפה מלאה של סידור ישיבה — מספיק לשלוח רק את האחרון לכל כיתה (לא נוגעים בפעולה שנשלחת כרגע)
  if (action === 'seating_update') {
    queue = queue.filter((op, i) => !(op.action === action && op.body.classId === body.classId && !(flushing && i === 0)));
  }
  queue.push({ opId: uid(), action, body });
  mutations++;
  applyOp(action, body);
  persistQueue();
  persistSnapshotSoon();
  notify();
  setTimeout(() => sync(), 0);
}

async function flush() {
  if (flushing || !queue.length) return;
  flushing = true;
  notify();
  try {
    while (queue.length) {
      const op = queue[0];
      try {
        await remote(op.action, op.body);
        reachable = true;
        authError = false;
        queue = queue.filter((o) => o.opId !== op.opId);
        persistQueue();
        notify();
      } catch (err) {
        if (err instanceof ApiRequestError) {
          reachable = true;
          if (err.status === 401) { authError = true; break; }
          if (err.status >= 500 || err.status === 408 || err.status === 429) break;
          // שגיאה קבועה (למשל תלמיד/אירוע שנמחקו בשרת) — מוותרים על הפעולה כדי לא לחסום את התור
          console.warn('dropping unsyncable op', op, err.message);
          queue = queue.filter((o) => o.opId !== op.opId);
          persistQueue();
          notify();
        } else {
          reachable = false;
          break;
        }
      }
    }
  } finally {
    flushing = false;
    notify();
  }
}

async function pull(parts) {
  if (pulling) return false;
  pulling = true;
  notify();
  try {
    const startMut = mutations;
    const snap = await remote('snapshot', parts ? { parts: parts.join(',') } : null, 60000);
    reachable = true;
    authError = false;
    // אם בינתיים נוספו פעולות מקומיות — לא דורסים אותן; הסבב הבא יסנכרן שוב
    if (queue.length || mutations !== startMut) return false;
    const next = { ...state };
    for (const k of (parts || ALL_PARTS)) if (Array.isArray(snap[k])) next[k] = snap[k];
    next.syncedAt = Date.now();
    state = next;
    lastPull = Date.now();
    persistSnapshotNow();
    syncVersion++;
    warmPhotos();
    return true;
  } catch (err) {
    if (err instanceof ApiRequestError) { reachable = true; if (err.status === 401) authError = true; } else reachable = false;
    return false;
  } finally {
    pulling = false;
    notify();
  }
}

export function sync({ parts } = {}) {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    try {
      // כמה סבבים: פעולות שנוספו תוך כדי משיכת נתונים נשלחות בסבב הבא
      for (let round = 0; round < 3; round++) {
        await flush();
        if (queue.length) break;
        await pull(parts);
        if (!queue.length) break;
      }
    } finally {
      syncPromise = null;
      notify();
    }
  })();
  return syncPromise;
}

async function syncFresh(parts) {
  while (syncPromise) await syncPromise.catch(() => {});
  return sync({ parts });
}

const warmed = new Set();
function warmPhotos() {
  const base = `${location.origin}/talap/`;
  const urls = [...state.students.map((s) => s.photoUrl), ...state.classes.map((c) => c.photoUrl)]
    .filter((u) => u && !warmed.has(u)).slice(0, 300);
  (async () => {
    for (const u of urls) {
      try { await fetch(new URL(u, base)); warmed.add(u); } catch { return; }
    }
  })();
}

// מופעל אחרי כניסה: מתחיל סנכרון ומחזיר הבטחה שמסתיימת כשיש נתונים מקומיים (מיידי אם כבר יש עותק)
export function startSync() {
  if (!started) {
    started = true;
    window.addEventListener('online', () => { reachable = true; notify(); sync(); });
    window.addEventListener('offline', () => notify());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') sync();
      else persistSnapshotNow();
    });
    window.addEventListener('pagehide', persistSnapshotNow);
    setInterval(() => {
      if (queue.length || !reachable || Date.now() - lastPull > 5 * 60 * 1000) sync();
    }, 20000);
  }
  const first = sync();
  return state.syncedAt ? Promise.resolve() : first;
}

/* ---------- ה-API שהמסכים משתמשים בו ---------- */

function groupEvents(evs, keyOf, withCarryOver) {
  const classNames = Object.fromEntries(state.classes.map((c) => [c.id, c.name]));
  const groups = new Map();
  for (const e of evs) {
    const key = keyOf(e);
    if (!groups.has(key)) {
      const topic = state.lessons.find((l) => l.classId === e.classId && l.date === e.date && l.period === e.period)?.topic || '';
      groups.set(key, {
        sort: [e.date, e.classId, e.period],
        g: { date: e.date, classId: e.classId, className: classNames[e.classId] || '', period: e.period, subject: e.subject, topic, events: [] },
      });
    }
    const item = {
      id: e.id, clientId: e.clientId || '', studentId: e.studentId, studentName: e.studentName,
      type: e.type, typeLabel: TYPE_LABELS[e.type] || e.type, note: e.note, ts: e.ts, syncedToMashov: !!e.syncedToMashov,
    };
    if (withCarryOver) item.carryOverToNextLesson = !NON_CARRYOVER.includes(e.type);
    groups.get(key).g.events.push(item);
  }
  return [...groups.values()]
    .sort((a, b) => (a.sort[0] < b.sort[0] ? -1 : a.sort[0] > b.sort[0] ? 1 : a.sort[1] - b.sort[1] || a.sort[2] - b.sort[2]))
    .map((x) => x.g);
}

const LOCAL = {
  async classes_list() { return { classes: state.classes }; },
  async schedule_list() { return { schedule: state.schedule }; },
  async students_list(b) {
    const classId = numOrNull(b.classId);
    return { students: classId ? state.students.filter((s) => s.classId === classId) : state.students };
  },
  async current_lesson(b) {
    const classId = Number(b.classId);
    const at = b.at ? new Date(b.at) : new Date();
    const dow = at.getDay();
    const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
    const lesson = state.schedule.find((e) => e.classId == classId && e.dayOfWeek == dow && time >= e.startTime && time < e.endTime) || null;
    return { lesson, date: ymd(at), dayName: DAY_NAMES[dow] };
  },
  async lesson_get(b) {
    const lesson = state.lessons.find((l) => l.classId === Number(b.classId) && l.date === b.date && l.period === Number(b.period)) || null;
    return { lesson };
  },
  async lesson_topic(b) {
    const body = { classId: Number(b.classId), date: b.date, period: Number(b.period), topic: b.topic || '' };
    enqueue('lesson_topic', body);
    return { lesson: state.lessons.find((l) => l.classId === body.classId && l.date === body.date && l.period === body.period) };
  },
  async events_today(b) {
    const date = b.date || ymd(new Date());
    return { date, lessons: groupEvents(state.events.filter((e) => e.date === date), (e) => `${e.classId}|${e.period}`, true) };
  },
  async events_range(b) {
    const classId = numOrNull(b.classId);
    const studentId = numOrNull(b.studentId);
    const evs = state.events.filter((e) => e.date >= b.from && e.date <= b.to
      && (classId === null || e.classId === classId) && (studentId === null || e.studentId === studentId));
    return { from: b.from, to: b.to, lessons: groupEvents(evs, (e) => `${e.date}|${e.classId}|${e.period}`, false) };
  },
  async events_create(b) {
    if (!TYPE_LABELS[b.type]) throw new ApiRequestError('invalid type', 400);
    const st = state.students.find((s) => s.id === Number(b.studentId));
    if (!st) throw new ApiRequestError('תלמיד לא נמצא', 404);
    const body = {
      classId: Number(b.classId), studentId: st.id, type: b.type, date: b.date || ymd(new Date()),
      period: Number(b.period), clientId: uid(), ts: nowTs(),
    };
    if (b.note) body.note = b.note;
    enqueue('events_create', body);
    return { event: state.events.find((e) => e.clientId === body.clientId) };
  },
  async events_delete(b) {
    const e = findEventById(b.id);
    if (e) enqueue('events_delete', e.clientId ? { clientId: e.clientId } : { id: e.id });
    return { deleted: b.id };
  },
  async events_set_note(b) {
    const e = findEventById(b.id);
    if (!e) throw new ApiRequestError('event not found', 404);
    enqueue('events_set_note', { ...(e.clientId ? { clientId: e.clientId } : { id: e.id }), note: b.note || '' });
    return { event: findEventById(b.id) };
  },
  async seating_update(b) {
    enqueue('seating_update', { classId: Number(b.classId), desks: b.desks });
    return { ok: true };
  },
};

// פעולות ניהול (כיתות, תלמידים, מערכת שעות, תמונות) דורשות חיבור — ואחריהן מרעננים את העותק המקומי
const ONLINE_ONLY = {
  classes_upsert: ['classes', 'students', 'schedule'],
  classes_delete: ['classes', 'students', 'schedule'],
  students_upsert: ['students'],
  students_delete: ['students'],
  students_import: ['students'],
  schedule_set: ['schedule'],
  photo_upload: ['students'],
  class_photo_upload: ['classes'],
};

async function adminCall(action, body) {
  let result;
  try {
    result = await remote(action, body, 60000);
    reachable = true;
  } catch (err) {
    if (err instanceof ApiRequestError) throw err;
    reachable = false;
    notify();
    throw new ApiRequestError('אין חיבור לשרת — פעולה זו דורשת חיבור לאינטרנט', 0);
  }
  await syncFresh(ONLINE_ONLY[action]);
  return result;
}

export async function api(action, body = null) {
  if (LOCAL[action]) return LOCAL[action](body || {});
  if (ONLINE_ONLY[action]) return adminCall(action, body);
  return remote(action, body);
}
