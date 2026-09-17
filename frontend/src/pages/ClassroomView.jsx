import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { todayStr } from '../lib/date';
import DeskGrid from '../components/DeskGrid';
import EventBucketBar, { EVENT_TYPES } from '../components/EventBucketBar';

const COLOR_BY_TYPE = Object.fromEntries(EVENT_TYPES.map((t) => [t.key, t.color]));
const LABEL_BY_TYPE = Object.fromEntries(EVENT_TYPES.map((t) => [t.key, t.label]));

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
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [layoutRows, setLayoutRows] = useState(4);
  const [layoutCols, setLayoutCols] = useState(4);
  const [todayLessons, setTodayLessons] = useState([]);
  const [error, setError] = useState('');

  const date = todayStr();

  async function loadLessonPeriod(period, subject) {
    setLesson({ period, subject, date });
    const lg = await api('lesson_get', { classId, date, period });
    setTopic(lg.lesson?.topic || '');
    setTopicSaved(true);
    const evt = await api('events_today', { date });
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

    // כל שיעורי היום של הכיתה הזו לפי מערכת השעות — כדי לאפשר גם הזנה
    // לשיעור שכבר התקיים היום (למשל בהפסקה), לא רק לשיעור החי כרגע
    const dow = new Date().getDay(); // 0=ראשון..6=שבת, תואם ל-date('w') ב-PHP
    const today = schedule
      .filter((e) => e.classId === classId && e.dayOfWeek === dow)
      .sort((a, b) => a.period - b.period);
    setTodayLessons(today);

    const cur = await api('current_lesson', { classId });
    let chosen = cur.lesson;
    if (!chosen && today.length) {
      const now = new Date();
      const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const past = today.filter((e) => e.startTime <= nowStr);
      chosen = past.length ? past[past.length - 1] : today[0];
    }

    if (chosen) await loadLessonPeriod(chosen.period, chosen.subject);
    else setLesson(null);
  }

  useEffect(() => {
    setError('');
    loadAll().catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

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

  async function refreshEvents() {
    if (!lesson) return;
    const evt = await api('events_today', { date: lesson.date || date });
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
    if (!lesson) { setError('אין שיעור מוגדר עכשיו במערכת השעות עבור כיתה זו'); return; }

    const { event } = await api('events_create', {
      classId, studentId, type: activeBucket, date: lesson.date || date, period: lesson.period,
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
    await api('lesson_topic', { classId, date: lesson.date || date, period: lesson.period, topic });
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
          {lesson ? `שיעור ${lesson.period} · ${lesson.subject}` : (todayLessons.length ? 'בחרי שיעור' : 'אין שיעור מוגדר להיום בכיתה זו')}
        </span>
        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 8 }}>
          <button
            className={`pill-btn ${editMode === 'seating' ? '' : 'secondary'}`}
            onClick={() => { setEditMode(editMode === 'seating' ? 'none' : 'seating'); setSelectedSeat(null); setSelectedPoolStudent(null); setActiveBucket(null); }}
          >עריכת סידור ישיבה</button>
          <button
            className={`pill-btn ${editMode === 'layout' ? '' : 'secondary'}`}
            onClick={() => { setEditMode(editMode === 'layout' ? 'none' : 'layout'); setActiveBucket(null); }}
          >עריכת סידור שולחנות</button>
        </div>
      </div>

      {error && <div style={{ color: 'var(--color-removal)' }}>{error}</div>}

      {todayLessons.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ alignSelf: 'center', opacity: 0.6, fontSize: '0.85rem' }}>שיעורי היום — להזנה גם שלא בזמן אמת:</span>
          {todayLessons.map((e) => (
            <button
              key={e.period}
              className={`pill-btn ${lesson?.period === e.period ? '' : 'secondary'}`}
              style={{ padding: '6px 16px', fontSize: '0.85rem' }}
              onClick={() => loadLessonPeriod(e.period, e.subject)}
            >שיעור {e.period} · {e.subject}</button>
          ))}
        </div>
      )}

      {lesson && (
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
          <input type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="הערה (אופציונלי)" autoFocus />
          <button className="pill-btn" onClick={saveNote}>שמירה</button>
          <button className="pill-btn ghost" onClick={() => setNoteEvent(null)}>דילוג</button>
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
