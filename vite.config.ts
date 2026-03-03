import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import filePersistencePlugin from './vite-plugin-file-persistence'

export default defineConfig({
  plugins: [react(), tailwindcss(), filePersistencePlugin()],
})
