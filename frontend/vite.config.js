import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// האפליקציה מתארחת תחת chepti.com/talap/ (לא בשורש הדומיין)
export default defineConfig({
  base: '/talap/',
  plugins: [react()],
})
