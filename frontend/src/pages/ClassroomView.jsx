import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { todayStr } from '../lib/date';
import DeskGrid from '../components/DeskGrid';
import EventBucketBar, { EVENT_TYPES, EDIT_KEY } from '../components/EventBucketBar';
import DatePicker from '../components/DatePicker';

const COLOR_BY_TYPE = Object.fromEntries(EVENT_TYPES.map((t) => [t.key, t.color]));
const LABEL_BY_TYPE = Object.fromEntries(EVENT_TYPES.map((t) => [t.key, t.label]));

function MaximizeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}

export default function ClassroomView({ classId, onBack }) {
  const [classData, setClassData] = useState(null);
  const [students, setStudents] = useState([]);
  const [lesson, setLesson] = useState(undefined); // undefined = loading, null = no lesson now
  const [topic, setTopic] = useState('');
  const [topicSaved, setTopicSaved] = useState(true);
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

  async function loadLessonPeriod(period, subject, forDate = viewDate) {
    setLesson({ period, subject, date: forDate });
    const lg = await api('lesson_get', { classId, date: forDate, period });
    let t = lg.lesson?.topic || '';
    // בשיעור תפילה הנושא קבוע — לא צריך להזין כל פעם מחדש
    if (!t && subject?.trim() === 'תפילה') {
      t = 'תפילה';
      await api('lesson_topic', { classId, date: forDate, period, topic: t });
    }
    setTopic(t);
    setTopicSaved(true);
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
    setStudents(students);
    setLayoutRows(cls?.rows || 4);
    setLayoutCols(cls?.cols || 4);
    setScheduleAll(schedule);
  }

  useEffect(() => {
    setError('');
    setLesson(undefined);
    loadAll().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

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

  const studentsById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);

  const seatedStudentIds = useMemo(() => {
    if (!classData) return new Set();
    return new Set(classData.desks.flatMap((d) => d.seats).filter((s) => s !== null));
  }, [classData]);

  const unassignedStudents = useMemo(
    () => students.filter((s) => !seatedStudentIds.has(s.id)),
    [students, seatedStudentIds]
  );

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

  async function persistDesks(newDesks) {
    setClassData({ ...classData, desks: newDesks });
    await api('seating_update', { classId, desks: newDesks });
  }

  async function handleSeatClick(deskId, seatIndex, studentId) {
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

  async function saveTopic() {
    if (!lesson) return;
    await api('lesson_topic', { classId, date: lesson.date || viewDate, period: lesson.period, topic });
    setTopicSaved(true);
  }

  async function saveNote() {
    if (!noteEvent) return;
    await api('events_set_note', { id: noteEvent.id, note: noteText });
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

  function tryBack() {
    if (lesson && !topic.trim()) { setConfirmLeave(true); return; }
    onBack();
  }

  if (!classData || lesson === undefined) return <div style={{ padding: 24 }}>טוענת…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '14px 20px', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="pill-btn ghost" onClick={tryBack}>← כיתות</button>
        <h1 style={{ margin: 0, fontSize: '1.3rem' }}>{classData.name}</h1>
        <span style={{ opacity: 0.6, fontSize: '0.9rem' }}>
          {lesson ? `שיעור ${lesson.period} · ${lesson.subject}` : (dayLessons.length ? 'בחרי שיעור' : 'אין שיעור מוגדר ליום הזה בכיתה זו')}
        </span>
        <DatePicker value={viewDate} onChange={setViewDate} />
        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8 }}>
          <button
            className={`pill-btn ${editMode === 'seating' ? '' : 'secondary'}`}
            onClick={() => { setEditMode(editMode === 'seating' ? 'none' : 'seating'); setSelectedSeat(null); setSelectedPoolStudent(null); setActiveBucket(null); }}
          >עריכת סידור ישיבה</button>
          <button
            className={`pill-btn ${editMode === 'layout' ? '' : 'secondary'}`}
            onClick={() => { setEditMode(editMode === 'layout' ? 'none' : 'layout'); setActiveBucket(null); }}
          >עריכת סידור שולחנות</button>
          <button className="pill-btn ghost" onClick={toggleFullscreen} title="מסך מלא">
            <MaximizeIcon />
          </button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--color-removal)' }}>{error}</div>}

      {dayLessons.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ alignSelf: 'center', opacity: 0.6, fontSize: '0.85rem' }}>שיעורי היום הזה — להזנה גם שלא בזמן אמת:</span>
          {dayLessons.map((e) => (
            <button
              key={e.period}
              className={`pill-btn ${lesson?.period === e.period ? '' : 'secondary'}`}
              style={{ padding: '6px 16px', fontSize: '0.85rem' }}
              onClick={() => loadLessonPeriod(e.period, e.subject, viewDate)}
            >שיעור {e.period} · {e.subject}</button>
          ))}
        </div>
      )}

      {lesson && lesson.subject?.trim() === 'תפילה' && (
        <div style={{ opacity: 0.6, fontSize: '0.9rem' }}>נושא השיעור: תפילה (קבוע, לא צריך להזין)</div>
      )}

      {lesson && lesson.subject?.trim() !== 'תפילה' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text" placeholder="נושא השיעור"
            value={topic}
            onChange={(e) => { setTopic(e.target.value); setTopicSaved(false); }}
            onBlur={saveTopic}
            style={{ flex: 1, maxWidth: 400 }}
          />
          {!topicSaved && <button className="pill-btn secondary" onClick={saveTopic}>שמירה</button>}
        </div>
      )}

      {editMode === 'layout' && (
        <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label>שורות: <input type="text" inputMode="numeric" value={layoutRows} onChange={(e) => setLayoutRows(Number(e.target.value) || 1)} style={{ width: 50 }} /></label>
          <label>עמודות: <input type="text" inputMode="numeric" value={layoutCols} onChange={(e) => setLayoutCols(Number(e.target.value) || 1)} style={{ width: 50 }} /></label>
          <button className="pill-btn" onClick={applyLayout}>עדכון פריסה</button>
        </div>
      )}

      {editMode === 'none' && <EventBucketBar active={activeBucket} onSelect={setActiveBucket} />}

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
        </div>
      )}

      <DeskGrid
        classData={classData}
        studentsById={studentsById}
        dotsByStudent={dotsByStudent}
        editMode={editMode === 'seating'}
        selectedSeat={selectedSeat}
        selectedPool={selectedPoolStudent}
        onSeatClick={handleSeatClick}
      />

      {noteEvent && (
        <div className="card" style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: 'max-content', maxWidth: '90vw',
          display: 'flex', gap: 8, alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 20,
        }}>
          <span>{LABEL_BY_TYPE[noteEvent.type]} — {noteEvent.studentName}: להוסיף הערה?</span>
          <input type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="הערה (אופציונלי)" />
          <button className="pill-btn" onClick={saveNote}>שמירה</button>
          <button className="pill-btn ghost" onClick={() => setNoteEvent(null)}>דילוג</button>
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
          display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 20,
        }}>
          <span>לא מילאת נושא שיעור — למלא עכשיו או לדלג?</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="pill-btn secondary" onClick={() => setConfirmLeave(false)}>למלא עכשיו</button>
            <button className="pill-btn" onClick={() => { setConfirmLeave(false); onBack(); }}>לדלג</button>
          </div>
        </div>
      )}
    </div>
  );
}
