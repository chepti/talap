import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useSyncVersion } from '../lib/offline';
import { todayStr } from '../lib/date';
import DeskGrid from '../components/DeskGrid';
import EventBucketBar, { EVENT_TYPES, EDIT_KEY } from '../components/EventBucketBar';
import DatePicker from '../components/DatePicker';
import PhotoCapture from '../components/PhotoCapture';
import PrintListEditor from '../components/PrintListEditor';
import GroupPhotoTagger from '../components/GroupPhotoTagger';
import StudentList, { NameControls, splitName, sortStudents } from '../components/StudentList';

function readPref(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function writePref(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

const COLOR_BY_TYPE = Object.fromEntries(EVENT_TYPES.map((t) => [t.key, t.color]));
const LABEL_BY_TYPE = Object.fromEntries(EVENT_TYPES.map((t) => [t.key, t.label]));

/* ---------- אייקונים (סגנון Lucide: stroke 2, קצוות מעוגלים) ---------- */
function Icon({ children, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const MenuIcon = ({ size }) => <Icon size={size}><path d="M4 6h16M4 12h16M4 18h16" /></Icon>;
const MaximizeIcon = () => <Icon><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" /></Icon>;
const CameraIcon = () => <Icon><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" /><circle cx="12" cy="13" r="3.5" /></Icon>;
const PlanIcon = () => <Icon><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01" /></Icon>;
const ListIcon = () => <Icon><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Icon>;
const GridIcon = () => <Icon><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></Icon>;
const UsersIcon = () => <Icon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Icon>;
const ChevronIcon = () => <Icon size={14}><path d="m6 9 6 6 6-6" /></Icon>;
const CloseIcon = () => <Icon size={16}><path d="M18 6 6 18M6 6l12 12" /></Icon>;
const TrashIcon = () => <Icon size={16}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" /></Icon>;
const ExternalIcon = () => <Icon size={16}><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></Icon>;

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}

const normalizeUrl = (v) => {
  const t = (v || '').trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

function ToolBtn({ icon, label, active, onClick }) {
  return (
    <button
      className={`pill-btn ${active ? '' : 'ghost'}`}
      onClick={onClick}
      title={label}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: active ? undefined : 'rgba(255,255,255,0.85)' }}
    >
      {icon}<span style={{ fontSize: '0.9rem' }}>{label}</span>
    </button>
  );
}

function SectionTitle({ children }) {
  return <div style={{ opacity: 0.55, fontSize: '0.75rem', fontWeight: 700, letterSpacing: 0.5, marginTop: 2 }}>{children}</div>;
}

export default function ClassroomView({ classId, onBack, onSwitchClass, onOpenReports, onOpenPlanner, onOpenRoster, onOpenSchedule }) {
  const [planUrl, setPlanUrl] = useState('');
  const [prepNotes, setPrepNotes] = useState('');
  const [prints, setPrints] = useState([]);
  const [classData, setClassData] = useState(null);
  const [allClasses, setAllClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [lesson, setLesson] = useState(undefined); // undefined = loading, null = no lesson now
  const [topic, setTopic] = useState('');
  const [events, setEvents] = useState([]);
  const [activeBucket, setActiveBucket] = useState(null);
  const [editMode, setEditMode] = useState('none'); // none | seating | layout
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [selectedPoolStudent, setSelectedPoolStudent] = useState(null);
  const [noteEvent, setNoteEvent] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [editTarget, setEditTarget] = useState(null); // { studentId, studentName }
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [layoutRows, setLayoutRows] = useState(4);
  const [layoutCols, setLayoutCols] = useState(4);
  const [scheduleAll, setScheduleAll] = useState(null);
  const [dayLessons, setDayLessons] = useState([]);
  const [viewDate, setViewDate] = useState(todayStr());
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [popover, setPopover] = useState(null); // 'class' | 'lesson' | null
  const [sheet, setSheet] = useState(null); // 'plan' | 'students' | null
  const [photoMode, setPhotoMode] = useState(false);
  const [viewMode, setViewMode] = useState(readPref('talap.viewMode', 'desks')); // desks | list
  const [sortBy, setSortBy] = useState(readPref('talap.sortBy', 'last')); // last | first
  const [nameOrder, setNameOrder] = useState('fl'); // סדר השמות כפי ששמורים בכיתה הזו (לכל כיתה בנפרד)
  useEffect(() => { setNameOrder(readPref(`talap.nameOrder.${classId}`, 'fl')); }, [classId]);
  const [groupPhoto, setGroupPhoto] = useState(false);
  const [photoStudent, setPhotoStudent] = useState(null); // { id, name }
  const [newStudentName, setNewStudentName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const lastSaved = useRef({ topic: '', planUrl: '', notes: '' });
  const noteFocused = useRef(false);

  async function loadLessonPeriod(period, subject, forDate = viewDate) {
    setLesson({ period, subject, date: forDate });
    const lg = await api('lesson_get', { classId, date: forDate, period });
    let t = lg.lesson?.topic || '';
    // בשיעור תפילה הנושא קבוע — לא צריך להזין כל פעם מחדש
    if (!t && subject?.trim() === 'תפילה') {
      t = 'תפילה';
      await api('lesson_topic', { classId, date: forDate, period, topic: t });
    }
    lastSaved.current = { topic: t, planUrl: lg.lesson?.planUrl || '', notes: lg.lesson?.notes || '' };
    setPlanUrl(lastSaved.current.planUrl);
    setPrepNotes(lastSaved.current.notes);
    setPrints(lg.lesson?.prints || []);
    setTopic(t);
    const evt = await api('events_today', { date: forDate });
    const group = evt.lessons.find((g) => g.classId === classId && g.period === period);
    setEvents(group ? group.events : []);
  }

  async function loadAll() {
    const [{ classes }, { students }, { schedule }] = await Promise.all([
      api('classes_list'),
      api('students_list', { classId }),
      api('schedule_list'),
    ]);
    const cls = classes.find((c) => c.id === classId);
    setClassData(cls);
    setAllClasses(classes);
    setStudents(students);
    setLayoutRows(cls?.rows || 4);
    setLayoutCols(cls?.cols || 4);
    setScheduleAll(schedule);
  }

  useEffect(() => {
    setError('');
    setLesson(undefined);
    setSheet(null);
    setPhotoMode(false);
    loadAll().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  // כשהעותק המקומי הוחלף בנתונים חדשים מהשרת (סנכרון ברקע / חזרת חיבור) — מרעננים את מה שמוצג
  const syncVersion = useSyncVersion();
  useEffect(() => {
    if (syncVersion === 0 || scheduleAll === null) return;
    (async () => {
      const [{ classes }, { students }] = await Promise.all([api('classes_list'), api('students_list', { classId })]);
      const cls = classes.find((c) => c.id === classId);
      if (cls) setClassData(cls);
      setAllClasses(classes);
      setStudents(students);
      await refreshEvents();
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncVersion]);

  // בכל שינוי תאריך צפייה (או אחרי טעינת מערכת השעות) — לחשב אילו שיעורים
  // חלים על היום הזה, ולבחור ברירת מחדל: השיעור החי עכשיו (רק אם זה היום
  // בפועל), אחרת השיעור האחרון שכבר התחיל, אחרת הראשון של אותו יום
  useEffect(() => {
    if (scheduleAll === null) return;
    const dow = new Date(viewDate + 'T00:00:00').getDay(); // 0=ראשון..6=שבת, תואם ל-date('w') ב-PHP
    const list = scheduleAll
      .filter((e) => e.classId === classId && e.dayOfWeek === dow)
      .sort((a, b) => a.period - b.period);
    setDayLessons(list);

    (async () => {
      const isToday = viewDate === todayStr();
      let chosen = null;
      if (isToday) {
        const cur = await api('current_lesson', { classId });
        chosen = cur.lesson;
      }
      if (!chosen && list.length) {
        if (isToday) {
          const now = new Date();
          const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          const past = list.filter((e) => e.startTime <= nowStr);
          chosen = past.length ? past[past.length - 1] : list[0];
        } else {
          chosen = list[0];
        }
      }
      if (chosen) await loadLessonPeriod(chosen.period, chosen.subject, viewDate);
      else setLesson(null);
    })().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleAll, viewDate, classId]);

  // פס ההערה: נעלם לבד אחרי כמה שניות אם לא התחילו לכתוב בו
  useEffect(() => {
    if (!noteEvent) return undefined;
    noteFocused.current = false;
    const t = setTimeout(() => { if (!noteFocused.current) setNoteEvent(null); }, 6000);
    return () => clearTimeout(t);
  }, [noteEvent]);

  const studentsById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);

  const seatedStudentIds = useMemo(() => {
    if (!classData) return new Set();
    return new Set(classData.desks.flatMap((d) => d.seats).filter((s) => s !== null));
  }, [classData]);

  const unassignedStudents = useMemo(
    () => students.filter((s) => !seatedStudentIds.has(s.id)),
    [students, seatedStudentIds]
  );

  // שמות להצגה בכרטיסי הישיבה: משפחה קודם או פרטי קודם, לפי הבחירה
  const displayById = useMemo(() => Object.fromEntries(students.map((s) => {
    const { first, last } = splitName(s.fullName, nameOrder);
    return [s.id, { ...s, fullName: (sortBy === 'first' ? `${first} ${last}` : `${last} ${first}`).trim() }];
  })), [students, sortBy, nameOrder]);

  const dotsByStudent = useMemo(() => {
    const map = {};
    for (const e of events) {
      if (!map[e.studentId]) map[e.studentId] = [];
      map[e.studentId].push({ id: e.id, color: COLOR_BY_TYPE[e.type], typeLabel: e.typeLabel, note: e.note });
    }
    return map;
  }, [events]);

  const editTargetEvents = useMemo(
    () => (editTarget ? events.filter((e) => e.studentId === editTarget.studentId) : []),
    [editTarget, events]
  );

  async function deleteOneEvent(id) {
    if (editingNoteId === id) { setEditingNoteId(null); setEditingNoteText(''); }
    await api('events_delete', { id });
    await refreshEvents();
  }

  function startEditNote(ev) {
    setEditingNoteId(ev.id);
    setEditingNoteText(ev.note || '');
  }

  async function saveEditedNote() {
    if (editingNoteId == null) return;
    await api('events_set_note', { id: editingNoteId, note: editingNoteText });
    setEditingNoteId(null);
    setEditingNoteText('');
    await refreshEvents();
  }

  async function refreshEvents() {
    if (!lesson) return;
    const evt = await api('events_today', { date: lesson.date || viewDate });
    const group = evt.lessons.find((g) => g.classId === classId && g.period === lesson.period);
    setEvents(group ? group.events : []);
  }

  async function reloadStudents() {
    const [{ students }, { classes }] = await Promise.all([api('students_list', { classId }), api('classes_list')]);
    setStudents(students);
    const cls = classes.find((c) => c.id === classId);
    if (cls) setClassData(cls);
  }

  async function persistDesks(newDesks) {
    setClassData({ ...classData, desks: newDesks });
    await api('seating_update', { classId, desks: newDesks });
  }

  async function handleSeatClick(deskId, seatIndex, studentId) {
    if (photoMode) {
      if (studentId) setPhotoStudent({ id: studentId, name: studentsById[studentId]?.fullName || '' });
      return;
    }

    if (selectedPoolStudent != null) {
      // שיבוץ תלמיד/ה מהמחסן למקום הזה (מי שהיה שם, אם היה, פשוט חוזר להיות לא-משובץ)
      const newDesks = classData.desks.map((d) => ({ ...d, seats: [...d.seats] }));
      const target = newDesks.find((d) => d.id === deskId);
      target.seats[seatIndex] = selectedPoolStudent;
      setSelectedPoolStudent(null);
      setSelectedSeat(null);
      await persistDesks(newDesks);
      return;
    }

    if (editMode === 'seating') {
      if (!selectedSeat) {
        setSelectedSeat({ deskId, seatIndex });
        return;
      }
      if (selectedSeat.deskId === deskId && selectedSeat.seatIndex === seatIndex) {
        setSelectedSeat(null);
        return;
      }
      const newDesks = classData.desks.map((d) => ({ ...d, seats: [...d.seats] }));
      const a = newDesks.find((d) => d.id === selectedSeat.deskId);
      const b = newDesks.find((d) => d.id === deskId);
      const tmp = a.seats[selectedSeat.seatIndex];
      a.seats[selectedSeat.seatIndex] = b.seats[seatIndex];
      b.seats[seatIndex] = tmp;
      setSelectedSeat(null);
      await persistDesks(newDesks);
      return;
    }

    if (!activeBucket) return;
    if (!studentId) return;

    if (activeBucket === EDIT_KEY) {
      const student = studentsById[studentId];
      setEditingNoteId(null);
      setEditTarget({ studentId, studentName: student?.fullName || '' });
      return;
    }

    if (!lesson) { setError('אין שיעור מוגדר ליום הזה במערכת השעות עבור כיתה זו'); return; }

    const { event } = await api('events_create', {
      classId, studentId, type: activeBucket, date: lesson.date || viewDate, period: lesson.period,
    });
    await refreshEvents();
    setNoteEvent(event);
    setNoteText('');
  }

  function handlePoolClick(studentId) {
    setSelectedSeat(null);
    setSelectedPoolStudent((cur) => (cur === studentId ? null : studentId));
  }

  async function returnSelectedSeatToPool() {
    if (!selectedSeat) return;
    const newDesks = classData.desks.map((d) => ({ ...d, seats: [...d.seats] }));
    const d = newDesks.find((x) => x.id === selectedSeat.deskId);
    d.seats[selectedSeat.seatIndex] = null;
    setSelectedSeat(null);
    await persistDesks(newDesks);
  }

  // שמירת שדה של השיעור (נושא / קישור לתכנון / הערות לעצמי) — רק אם באמת השתנה, כדי לא לדרוס בטעות
  async function saveLessonField(field, rawValue) {
    if (!lesson) return;
    const value = field === 'planUrl' ? normalizeUrl(rawValue) : rawValue;
    if (field === 'planUrl') setPlanUrl(value);
    if (value === lastSaved.current[field]) return;
    lastSaved.current = { ...lastSaved.current, [field]: value };
    await api('lesson_topic', { classId, date: lesson.date || viewDate, period: lesson.period, [field]: value });
  }

  async function savePrints(arr) {
    if (!lesson) return;
    setPrints(arr);
    await api('lesson_topic', { classId, date: lesson.date || viewDate, period: lesson.period, prints: arr });
  }

  async function saveNote() {
    if (!noteEvent) return;
    if (noteText.trim()) await api('events_set_note', { id: noteEvent.id, note: noteText });
    setNoteEvent(null);
    refreshEvents();
  }

  async function applyLayout() {
    const oldFlat = classData.desks.flatMap((d) => d.seats).filter((s) => s !== null);
    const newDesks = [];
    let n = 1;
    for (let r = 0; r < layoutRows; r++) {
      for (let c = 0; c < layoutCols; c++) {
        const seats = [oldFlat.shift() ?? null, oldFlat.shift() ?? null];
        newDesks.push({ id: 'd' + n, row: r, col: c, seats });
        n++;
      }
    }
    setClassData({ ...classData, rows: layoutRows, cols: layoutCols, desks: newDesks });
    await api('seating_update', { classId, desks: newDesks });
    setEditMode('none');
  }

  async function savePhoto(dataUrl) {
    if (!photoStudent) return;
    await api('photo_upload', { studentId: photoStudent.id, imageBase64: dataUrl });
    setPhotoStudent(null); // נשארים במצב צילום — אפשר לצלם את התלמיד/ה הבא/ה מיד
    await reloadStudents();
  }

  async function addStudent(e) {
    e.preventDefault();
    const fullName = newStudentName.trim();
    if (!fullName) return;
    const { student } = await api('students_upsert', { classId, fullName });
    setNewStudentName('');
    // משבצים אוטומטית במקום הפנוי הראשון (אם יש), כדי שיופיע מיד בכיתה
    const desks = classData.desks.map((d) => ({ ...d, seats: [...d.seats] }));
    const free = desks.find((d) => d.seats.some((s) => s === null));
    if (student && free) {
      free.seats[free.seats.findIndex((s) => s === null)] = student.id;
      await persistDesks(desks);
    }
    await reloadStudents();
  }

  async function removeStudent(id) {
    await api('students_delete', { id });
    setConfirmDeleteId(null);
    if (seatedStudentIds.has(id)) {
      const desks = classData.desks.map((d) => ({ ...d, seats: d.seats.map((s) => (s === id ? null : s)) }));
      await persistDesks(desks);
    }
    await reloadStudents();
  }

  async function leaveWithTopic() {
    if (!topic.trim()) return;
    await saveLessonField('topic', topic);
    setConfirmLeave(false);
    onBack();
  }

  function tryBack() {
    if (lesson && !topic.trim()) { setDrawerOpen(false); setConfirmLeave(true); return; }
    onBack();
  }

  function closeOverlays() { setDrawerOpen(false); setPopover(null); }

  function togglePhotoMode() {
    setPhotoMode((m) => !m);
    setActiveBucket(null);
    setEditMode('none');
    setSelectedSeat(null);
    setSelectedPoolStudent(null);
  }

  if (!classData || lesson === undefined) return <div style={{ padding: 24 }}>טוענת…</div>;

  const isPrayer = lesson?.subject?.trim() === 'תפילה';
  const otherClasses = allClasses.filter((c) => c.id !== classId);

  const chipStyle = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999,
    border: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
  };
  const popoverStyle = {
    position: 'absolute', top: '100%', insetInlineStart: 0, marginTop: 6, zIndex: 40, minWidth: 180,
    display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 6px 24px rgba(0,0,0,0.22)',
  };

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      {(drawerOpen || popover) && (
        <div onClick={closeOverlays} style={{ position: 'absolute', inset: 0, zIndex: 27, background: drawerOpen ? 'rgba(0,0,0,0.15)' : 'transparent' }} />
      )}

      {/* תפריט נשלף — מסודר לפי נושאים */}
      <div style={{
        position: 'absolute', top: 0, insetInlineStart: 0, height: '100%', width: 290, zIndex: 28,
        background: 'var(--color-bg)', boxShadow: drawerOpen ? '6px 0 24px rgba(0,0,0,0.2)' : 'none',
        transform: `translateX(${drawerOpen ? '0' : '100%'})`, transition: 'transform 0.25s ease',
        padding: '16px 18px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: '1.3rem', flex: 1 }}>{classData.name}</h1>
          <button className="pill-btn ghost" onClick={() => setDrawerOpen(false)} title="סגירה" style={{ padding: '6px 10px' }}><CloseIcon /></button>
        </div>

        <SectionTitle>מעבר</SectionTitle>
        <DatePicker value={viewDate} onChange={setViewDate} />
        {otherClasses.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {otherClasses.map((c) => (
              <button key={c.id} className="pill-btn secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                onClick={() => { setDrawerOpen(false); onSwitchClass(c.id); }}
              >{c.name}</button>
            ))}
          </div>
        )}
        <button className="pill-btn ghost" onClick={tryBack} style={{ alignSelf: 'flex-start' }}>← למסך הראשי</button>

        <hr style={{ width: '100%', border: 'none', borderTop: '1px solid var(--color-border)', margin: 0 }} />
        <SectionTitle>הכיתה</SectionTitle>
        <button
          className={`pill-btn ${editMode === 'seating' ? '' : 'secondary'}`}
          onClick={() => { setEditMode(editMode === 'seating' ? 'none' : 'seating'); setSelectedSeat(null); setSelectedPoolStudent(null); setActiveBucket(null); setPhotoMode(false); setDrawerOpen(false); setViewMode('desks'); writePref('talap.viewMode', 'desks'); }}
        >עריכת סידור ישיבה</button>
        <button
          className={`pill-btn ${editMode === 'layout' ? '' : 'secondary'}`}
          onClick={() => { setEditMode(editMode === 'layout' ? 'none' : 'layout'); setActiveBucket(null); setPhotoMode(false); }}
        >עריכת סידור שולחנות</button>
        {editMode === 'layout' && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label>שורות: <input type="text" inputMode="numeric" value={layoutRows} onChange={(e) => setLayoutRows(Number(e.target.value) || 1)} style={{ width: 50 }} /></label>
            <label>עמודות: <input type="text" inputMode="numeric" value={layoutCols} onChange={(e) => setLayoutCols(Number(e.target.value) || 1)} style={{ width: 50 }} /></label>
            <button className="pill-btn" onClick={applyLayout}>עדכון פריסה</button>
          </div>
        )}

        <hr style={{ width: '100%', border: 'none', borderTop: '1px solid var(--color-border)', margin: 0 }} />
        <SectionTitle>כלים</SectionTitle>
        <button className="pill-btn ghost" onClick={onOpenPlanner}>תכנון שיעורים</button>
        <button className="pill-btn ghost" onClick={onOpenReports}>דוחות</button>
        <button className="pill-btn ghost" onClick={onOpenRoster}>ניהול תלמידים</button>
        <button className="pill-btn ghost" onClick={onOpenSchedule}>מערכת שעות</button>
      </div>

      {/* תוכן ראשי */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px 20px 14px', gap: 10 }}>
        {/* פס עליון קבוע: מה השיעור עכשיו, מה הנושא, וקיצורי דרך */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', position: 'relative', zIndex: 29 }}>
          <button className="pill-btn ghost" onClick={() => { setPopover(null); setDrawerOpen((o) => !o); }} title="תפריט"
            style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.85)' }}>
            <MenuIcon size={20} />
          </button>

          <div style={{ position: 'relative' }}>
            <button style={chipStyle} onClick={() => setPopover((p) => (p === 'class' ? null : 'class'))} title="מעבר לכיתה אחרת">
              {classData.name}{otherClasses.length > 0 && <ChevronIcon />}
            </button>
            {popover === 'class' && otherClasses.length > 0 && (
              <div className="card" style={popoverStyle}>
                {otherClasses.map((c) => (
                  <button key={c.id} className="pill-btn secondary" onClick={() => { setPopover(null); onSwitchClass(c.id); }}>{c.name}</button>
                ))}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button style={{ ...chipStyle, background: lesson ? 'var(--color-primary-light)' : 'rgba(255,255,255,0.9)' }}
              onClick={() => dayLessons.length > 1 && setPopover((p) => (p === 'lesson' ? null : 'lesson'))}
              title={dayLessons.length > 1 ? 'החלפת שיעור' : undefined}>
              {lesson ? `שיעור ${lesson.period} · ${lesson.subject}` : 'אין שיעור ביום הזה'}
              {dayLessons.length > 1 && <ChevronIcon />}
            </button>
            {popover === 'lesson' && (
              <div className="card" style={popoverStyle}>
                {dayLessons.map((e) => (
                  <button key={e.period} className={`pill-btn ${lesson?.period === e.period ? '' : 'secondary'}`}
                    onClick={() => { setPopover(null); loadLessonPeriod(e.period, e.subject, viewDate); }}>
                    שיעור {e.period} · {e.subject}
                  </button>
                ))}
              </div>
            )}
          </div>

          {viewDate !== todayStr() && (
            <span style={{ ...chipStyle, cursor: 'default', background: '#fff3cd' }}>{viewDate.split('-').reverse().join('.')}</span>
          )}

          {lesson && (isPrayer ? (
            <span style={{ opacity: 0.7, fontSize: '0.9rem' }}>נושא: תפילה</span>
          ) : (
            <input
              type="text" placeholder="נושא השיעור…" value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onBlur={() => saveLessonField('topic', topic)}
              style={{ flex: '1 1 160px', minWidth: 140, maxWidth: 360, background: 'rgba(255,255,255,0.9)' }}
            />
          ))}

          <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ToolBtn
              icon={viewMode === 'list' ? <GridIcon /> : <ListIcon />}
              label={viewMode === 'list' ? 'סידור ישיבה' : 'רשימת שמות'}
              onClick={() => {
                const next = viewMode === 'list' ? 'desks' : 'list';
                setViewMode(next); writePref('talap.viewMode', next);
                setEditMode('none'); setSelectedSeat(null); setSelectedPoolStudent(null);
              }}
            />
            <ToolBtn icon={<PlanIcon />} label="תכנון שיעור" active={sheet === 'plan'} onClick={() => setSheet(sheet === 'plan' ? null : 'plan')} />
            <ToolBtn icon={<CameraIcon />} label="צילום" active={photoMode} onClick={togglePhotoMode} />
            <ToolBtn icon={<UsersIcon />} label="תלמידים" active={sheet === 'students'} onClick={() => setSheet(sheet === 'students' ? null : 'students')} />
            <button className="pill-btn ghost" onClick={toggleFullscreen} title="מסך מלא" style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.85)' }}>
              <MaximizeIcon />
            </button>
          </div>
        </div>

        {error && <div style={{ color: 'var(--color-removal)' }}>{error}</div>}

        {photoMode && (
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'var(--color-primary-light)' }}>
            <CameraIcon />
            <span style={{ fontWeight: 600 }}>מצב צילום — לחצי על תלמיד/ה כדי לצלם</span>
            <button className="pill-btn secondary" style={{ marginInlineStart: 'auto' }} onClick={() => setGroupPhoto(true)}>תמונה קבוצתית / מהגלריה</button>
            <button className="pill-btn ghost" onClick={() => setPhotoMode(false)}>סיום</button>
          </div>
        )}

        {editMode === 'seating' && (
          <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, opacity: 0.7 }}>מחסן — תלמידים ללא מקום:</span>
            {unassignedStudents.length === 0 && <span style={{ opacity: 0.5 }}>כולם משובצים</span>}
            {unassignedStudents.map((s) => (
              <button
                key={s.id}
                className="pill-btn secondary"
                style={selectedPoolStudent === s.id ? { background: 'var(--color-primary)', color: '#fff' } : undefined}
                onClick={() => handlePoolClick(s.id)}
              >{s.fullName}</button>
            ))}
            {selectedSeat && (
              <button className="pill-btn ghost" onClick={returnSelectedSeatToPool}>החזרת התלמיד/ה שנבחר/ה למחסן</button>
            )}
            <button className="pill-btn" style={{ marginInlineStart: 'auto' }} onClick={() => { setEditMode('none'); setSelectedSeat(null); setSelectedPoolStudent(null); }}>סיום עריכה</button>
          </div>
        )}

        {viewMode === 'list' ? (
          <StudentList
            students={students}
            dotsByStudent={dotsByStudent}
            sortBy={sortBy}
            onSortChange={(k) => { setSortBy(k); writePref('talap.sortBy', k); }}
            nameOrder={nameOrder}
            onNameOrderChange={(o) => { setNameOrder(o); writePref(`talap.nameOrder.${classId}`, o); }}
            onPick={(id) => handleSeatClick(null, 0, id)}
            toolbar={<EventBucketBar active={activeBucket} onSelect={(k) => { setPhotoMode(false); setActiveBucket(k); }} />}
          />
        ) : (
          <DeskGrid
            classData={classData}
            studentsById={displayById}
            dotsByStudent={dotsByStudent}
            editMode={editMode === 'seating'}
            selectedSeat={selectedSeat}
            selectedPool={selectedPoolStudent}
            onSeatClick={handleSeatClick}
            toolbar={editMode === 'none' ? <EventBucketBar active={activeBucket} onSelect={(k) => { setPhotoMode(false); setActiveBucket(k); }} /> : null}
            extra={editMode === 'none' ? (
              <NameControls
                sortBy={sortBy} onSortChange={(k) => { setSortBy(k); writePref('talap.sortBy', k); }}
                nameOrder={nameOrder} onNameOrderChange={(o) => { setNameOrder(o); writePref(`talap.nameOrder.${classId}`, o); }}
              />
            ) : null}
          />
        )}
      </div>

      {/* לוחית צד: תכנון השיעור (בלי לצאת מהמסך) / ניהול תלמידים מהיר */}
      {sheet && (
        <div className="card" style={{
          position: 'absolute', top: 66, insetInlineEnd: 20, width: 340, maxHeight: 'calc(100% - 90px)', overflowY: 'auto',
          zIndex: 26, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <b style={{ flex: 1 }}>{sheet === 'plan' ? 'תכנון השיעור' : `תלמידים — ${classData.name}`}</b>
            <button className="pill-btn ghost" onClick={() => setSheet(null)} title="סגירה" style={{ padding: '4px 8px' }}><CloseIcon /></button>
          </div>

          {sheet === 'plan' && (!lesson ? (
            <span style={{ opacity: 0.6 }}>אין שיעור מוגדר ליום הזה.</span>
          ) : (
            <>
              <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>שיעור {lesson.period} · {lesson.subject}</span>
              <input type="text" placeholder="נושא השיעור" value={topic}
                onChange={(e) => setTopic(e.target.value)} onBlur={() => saveLessonField('topic', topic)} />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="text" inputMode="url" dir="ltr" placeholder="קישור לתכנון / מצגת הרצף" value={planUrl}
                  onChange={(e) => setPlanUrl(e.target.value)} onBlur={() => saveLessonField('planUrl', planUrl)}
                  style={{ flex: 1, textAlign: 'start' }} />
                {/^https?:\/\//i.test(planUrl) && (
                  <a href={planUrl} target="_blank" rel="noopener noreferrer" className="pill-btn secondary"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}>
                    <ExternalIcon />פתיחה
                  </a>
                )}
              </div>
              <textarea rows={5} placeholder="הערות לעצמי: מה להדפיס, להכין, להביא…" value={prepNotes}
                onChange={(e) => setPrepNotes(e.target.value)} onBlur={() => saveLessonField('notes', prepNotes)} />
              <PrintListEditor key={`${lesson.date}-${lesson.period}`} value={prints} onCommit={savePrints} compact />
            </>
          ))}

          {sheet === 'students' && (
            <>
              <form onSubmit={addStudent} style={{ display: 'flex', gap: 6 }}>
                <input type="text" placeholder="שם תלמיד/ה חדש/ה" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} style={{ flex: 1 }} />
                <button className="pill-btn" type="submit" disabled={!newStudentName.trim()}>הוספה</button>
              </form>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {students.length === 0 && <span style={{ opacity: 0.6 }}>אין תלמידים בכיתה.</span>}
                {students.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ flex: 1 }}>{s.fullName}{!seatedStudentIds.has(s.id) && <span style={{ opacity: 0.5, fontSize: '0.75rem' }}> · ללא מקום</span>}</span>
                    {confirmDeleteId === s.id ? (
                      <>
                        <button className="pill-btn" style={{ background: 'var(--color-removal)', padding: '4px 12px' }} onClick={() => removeStudent(s.id)}>מחיקה</button>
                        <button className="pill-btn ghost" style={{ padding: '4px 10px' }} onClick={() => setConfirmDeleteId(null)}>ביטול</button>
                      </>
                    ) : (
                      <button className="pill-btn ghost" title="הסרת תלמיד/ה" style={{ padding: '4px 8px', color: 'var(--color-removal)' }} onClick={() => setConfirmDeleteId(s.id)}><TrashIcon /></button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* פס הערה: קטן, בפינה השמאלית התחתונה, נעלם לבד */}
      {noteEvent && (
        <div className="card" style={{
          position: 'fixed', bottom: 14, left: 14, width: 'max-content', maxWidth: '60vw', padding: '6px 10px',
          display: 'flex', gap: 6, alignItems: 'center', boxShadow: '0 3px 14px rgba(0,0,0,0.2)', zIndex: 20, fontSize: '0.85rem',
        }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_BY_TYPE[noteEvent.type], flex: 'none' }} />
          <span style={{ whiteSpace: 'nowrap' }} title={LABEL_BY_TYPE[noteEvent.type]}>{noteEvent.studentName}</span>
          <input type="text" value={noteText} placeholder="הערה"
            onFocus={() => { noteFocused.current = true; }}
            onChange={(e) => { noteFocused.current = true; setNoteText(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter') saveNote(); }}
            style={{ width: 130, padding: '4px 8px', fontSize: '0.85rem' }} />
          {noteText.trim() && <button className="pill-btn" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={saveNote}>שמירה</button>}
          <button className="pill-btn ghost" title="סגירה" style={{ padding: '4px 6px' }} onClick={() => setNoteEvent(null)}><CloseIcon /></button>
        </div>
      )}

      {editTarget && (
        <div className="card" style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: 'max-content', maxWidth: '90vw',
          display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 20,
        }}>
          <span style={{ fontWeight: 600 }}>הסימונים של {editTarget.studentName} בשיעור הזה:</span>
          {editTargetEvents.length === 0 && <span style={{ opacity: 0.6 }}>אין סימונים</span>}
          {editTargetEvents.map((e) => (
            <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: COLOR_BY_TYPE[e.type], display: 'inline-block' }} />
                <span style={{ flex: 1 }}>{e.typeLabel}{e.note ? ` — ${e.note}` : ''}</span>
                {editingNoteId !== e.id && (
                  <button className="pill-btn ghost" onClick={() => startEditNote(e)}>{e.note ? 'עריכת הערה' : 'הוספת הערה'}</button>
                )}
                <button className="pill-btn ghost" style={{ color: 'var(--color-removal)' }} onClick={() => deleteOneEvent(e.id)}>מחיקה</button>
              </div>
              {editingNoteId === e.id && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" value={editingNoteText} onChange={(ev) => setEditingNoteText(ev.target.value)} placeholder="הערה" style={{ flex: 1 }} />
                  <button className="pill-btn" onClick={saveEditedNote}>שמירה</button>
                  <button className="pill-btn ghost" onClick={() => { setEditingNoteId(null); setEditingNoteText(''); }}>ביטול</button>
                </div>
              )}
            </div>
          ))}
          <button className="pill-btn secondary" onClick={() => { setEditTarget(null); setEditingNoteId(null); }}>סגירה</button>
        </div>
      )}

      {confirmLeave && (
        <div className="card" style={{
          position: 'fixed', top: '40%', left: '50%', transform: 'translateX(-50%)', width: 'max-content', maxWidth: '90vw',
          display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 35,
        }}>
          <span style={{ fontWeight: 600 }}>לא מילאת נושא שיעור — מה היה הנושא?</span>
          <input
            type="text" placeholder="נושא השיעור" value={topic} style={{ minWidth: 280 }}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') leaveWithTopic(); }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="pill-btn" disabled={!topic.trim()} onClick={leaveWithTopic}>שמירה ויציאה</button>
            <button className="pill-btn ghost" onClick={() => { setConfirmLeave(false); onBack(); }}>יציאה בלי נושא</button>
            <button className="pill-btn ghost" onClick={() => setConfirmLeave(false)}>להישאר בכיתה</button>
          </div>
        </div>
      )}

      {groupPhoto && (
        <GroupPhotoTagger
          students={sortStudents(students, sortBy, nameOrder).map((st) => displayById[st.id] || st)}
          onSave={async (studentId, dataUrl) => { await api('photo_upload', { studentId, imageBase64: dataUrl }); await reloadStudents(); }}
          onClose={() => setGroupPhoto(false)}
        />
      )}

      {photoStudent && (
        <PhotoCapture onSave={savePhoto} onCancel={() => setPhotoStudent(null)} />
      )}
    </div>
  );
}
