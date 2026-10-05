import { useEffect, useState } from 'react';
import { api, getKey, clearKey } from './lib/api';
import { startSync, clearLocalData, pendingCount } from './lib/offline';
import SyncBadge from './components/SyncBadge';
import Login from './pages/Login';
import ClassPicker from './pages/ClassPicker';
import ClassroomView from './pages/ClassroomView';
import RosterAdmin from './pages/RosterAdmin';
import ScheduleAdmin from './pages/ScheduleAdmin';
import ReportsView from './pages/ReportsView';
import PlannerView from './pages/PlannerView';
import Footer from './components/Footer';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!getKey());
  const [view, setView] = useState('picker'); // picker | classroom | roster | schedule
  const [classId, setClassId] = useState(null);
  const [checkingAutoOpen, setCheckingAutoOpen] = useState(true);

  // ניווט מבוסס היסטוריית דפדפן — כדי שכפתור "חזרה" הפיזי/של הדפדפן ינווט
  // בתוך האפליקציה (למסך הקודם) במקום לצאת ממנה לגמרי
  useEffect(() => {
    function onPopState(e) {
      setView(e.state?.view || 'picker');
      setClassId(e.state?.classId ?? null);
    }
    window.history.replaceState({ view: 'picker' }, '');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function navigate(newView, newClassId = null) {
    setView(newView);
    if (newClassId !== null) setClassId(newClassId);
    window.history.pushState({ view: newView, classId: newClassId }, '');
  }

  function goBack() {
    window.history.back();
  }

  // בכניסה לאפליקציה: אם יש כרגע שיעור פעיל לפי מערכת השעות (בכל כיתה) —
  // לפתוח ישר לתוכה במקום להציג את מסך בחירת הכיתה
  useEffect(() => {
    if (!loggedIn) { setCheckingAutoOpen(false); return; }
    (async () => {
      try {
        await startSync(); // מיידי אם כבר יש עותק מקומי; בהפעלה ראשונה ממתין לנתונים מהשרת
        const { schedule } = await api('schedule_list');
        const now = new Date();
        const dow = now.getDay();
        const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const match = schedule.find((e) => e.dayOfWeek === dow && nowStr >= e.startTime && nowStr < e.endTime);
        if (match) {
          setClassId(match.classId);
          setView('classroom');
          window.history.replaceState({ view: 'classroom', classId: match.classId }, '');
        }
      } catch { /* אם זה נכשל, פשוט נשארים במסך בחירת כיתה */ }
      setCheckingAutoOpen(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  if (!loggedIn) return <Login onSuccess={() => setLoggedIn(true)} />;
  if (checkingAutoOpen) return <div style={{ padding: 24 }}>טוענת…</div>;

  function feedback() {
    window.location.href = 'mailto:chepti@gmail.com?subject=' + encodeURIComponent('משוב על תלפ');
  }

  async function logout() {
    if (pendingCount() > 0 && !window.confirm(`יש ${pendingCount()} פעולות שעוד לא סונכרנו לשרת, והן יימחקו אם תתנתקי עכשיו. להתנתק בכל זאת?`)) return;
    clearKey();
    await clearLocalData();
    setLoggedIn(false);
    setView('picker');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SyncBadge />
      <div style={{ flex: 1, minHeight: 0 }}>
        {view === 'picker' && (
          <ClassPicker
            onPick={(id) => navigate('classroom', id)}
            onOpenRoster={() => navigate('roster')}
            onOpenSchedule={() => navigate('schedule')}
            onOpenReports={() => navigate('reports')}
            onOpenPlanner={() => navigate('planner')}
            onLogout={logout}
          />
        )}
        {view === 'classroom' && (
          <ClassroomView
            classId={classId}
            onBack={goBack}
            onSwitchClass={(id) => navigate('classroom', id)}
            onOpenReports={() => navigate('reports')}
            onOpenPlanner={() => navigate('planner')}
          />
        )}
        {view === 'roster' && <RosterAdmin onBack={goBack} />}
        {view === 'schedule' && <ScheduleAdmin onBack={goBack} />}
        {view === 'reports' && <ReportsView onBack={goBack} />}
        {view === 'planner' && <PlannerView onBack={goBack} />}
      </div>
      {view !== 'classroom' && <Footer onFeedback={feedback} />}
    </div>
  );
}
