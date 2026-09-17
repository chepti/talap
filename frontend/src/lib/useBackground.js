import { useEffect, useState } from 'react';

// שתי תמונות רקע — אחת מתאימה למסך צר/אנכי (טאבלט זקוף), השנייה לרחב/אופקי.
// בוחר אוטומטית לפי יחס המסך הנוכחי ומתעדכן אם הטאבלט מסתובב.
export function useAppBackground() {
  const pick = () => (window.matchMedia('(orientation: landscape)').matches ? 'login-bg-wide.jpg' : 'login-bg.png');
  const [src, setSrc] = useState(pick());

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const handler = () => setSrc(pick());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return src;
}
