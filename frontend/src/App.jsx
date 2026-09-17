import { useState } from 'react';
import { getKey } from './lib/api';
import Login from './pages/Login';
import ClassPicker from './pages/ClassPicker';
import ClassroomView from './pages/ClassroomView';
import RosterAdmin from './pages/RosterAdmin';
import ScheduleAdmin from './pages/ScheduleAdmin';
import Footer from './components/Footer';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!getKey());
  const [view, setView] = useState('picker'); // picker | classroom | roster | schedule
  const [classId, setClassId] = useState(null);

  if (!loggedIn) return <Login onSuccess={() => setLoggedIn(true)} />;

  function feedback() {
    window.location.href = 'mailto:chepti@gmail.com?subject=' + encodeURIComponent('משוב על תלפ');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        {view === 'picker' && (
          <ClassPicker
            onPick={(id) => { setClassId(id); setView('classroom'); }}
            onOpenRoster={() => setView('roster')}
            onOpenSchedule={() => setView('schedule')}
          />
        )}
        {view === 'classroom' && <ClassroomView classId={classId} onBack={() => setView('picker')} />}
        {view === 'roster' && <RosterAdmin onBack={() => setView('picker')} />}
        {view === 'schedule' && <ScheduleAdmin onBack={() => setView('picker')} />}
      </div>
      {view !== 'classroom' && <Footer onFeedback={feedback} />}
    </div>
  );
}
