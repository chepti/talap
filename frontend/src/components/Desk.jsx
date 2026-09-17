function initials(name) {
  return (name || '').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('');
}

function Seat({ student, dots, selected, editMode, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, minWidth: 0, minHeight: 64,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        background: selected ? 'var(--color-primary-light)' : '#fffdf8',
        border: selected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
        borderRadius: 12, padding: '6px 4px', position: 'relative',
        opacity: student ? 1 : 0.5,
      }}
    >
      {student?.photoUrl ? (
        <img src={student.photoUrl} alt="" width={28} height={28} style={{ borderRadius: '50%', objectFit: 'cover' }} />
      ) : student ? (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600,
        }}>{initials(student.fullName)}</div>
      ) : (
        <div style={{ width: 28, height: 28 }} />
      )}
      <span style={{ fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
        {student ? student.fullName : (editMode ? 'ריק' : '')}
      </span>
      {dots && dots.length > 0 && (
        <div style={{ display: 'flex', gap: 3 }}>
          {dots.map((d) => (
            <span key={d.id} title={d.typeLabel + (d.note ? `: ${d.note}` : '')}
              style={{ width: 9, height: 9, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
          ))}
        </div>
      )}
    </button>
  );
}

export default function Desk({ desk, totalRows, studentsById, dotsByStudent, editMode, selected, selectedPool, onSeatClick }) {
  return (
    <div style={{
      gridRow: totalRows - desk.row, gridColumn: desk.col + 1,
      display: 'flex', gap: 4, background: '#efe3cd', borderRadius: 14, padding: 6,
      boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
    }}>
      {desk.seats.map((studentId, i) => (
        <Seat
          key={i}
          student={studentId ? studentsById[studentId] : null}
          dots={studentId ? dotsByStudent[studentId] : null}
          editMode={editMode || !!selectedPool}
          selected={selected && selected.deskId === desk.id && selected.seatIndex === i}
          onClick={() => onSeatClick(desk.id, i, studentId)}
        />
      ))}
    </div>
  );
}
