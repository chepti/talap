import Desk from './Desk';

export default function DeskGrid({ classData, studentsById, dotsByStudent, editMode, selectedSeat, onSeatClick }) {
  const { rows, cols, desks } = classData;
  return (
    <div style={{
      background: 'repeating-linear-gradient(90deg, #c9955b 0 28px, #bd8a4f 28px 30px)',
      borderRadius: 18, padding: 18, position: 'relative', flex: 1,
      boxShadow: 'inset 0 0 30px rgba(0,0,0,0.12)',
    }}>
      <div style={{
        textAlign: 'center', color: '#fff', background: 'rgba(0,0,0,0.35)', borderRadius: 12,
        padding: '4px 0', marginBottom: 14, fontSize: '0.85rem', fontWeight: 600, letterSpacing: 1,
      }}>
        צד המורה
      </div>
      <div style={{
        display: 'grid',
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 10,
      }}>
        {desks.map((d) => (
          <Desk
            key={d.id}
            desk={d}
            studentsById={studentsById}
            dotsByStudent={dotsByStudent}
            editMode={editMode}
            selectedSeat={selectedSeat}
            onSeatClick={onSeatClick}
          />
        ))}
      </div>
    </div>
  );
}
