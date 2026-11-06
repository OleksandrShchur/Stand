import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Tests do not create HTTPS certificates or start the Vite development server.
export default defineConfig({
    plugins: [react()],
    test: {
        projects: [
            { test: { name: 'unit', environment: 'node', include: ['tests/*.test.mjs'] } },
            { extends: true, test: { name: 'integration', environment: 'jsdom', include: ['tests/integration/**/*.test.tsx'] } },
        ],
        coverage: {
            provider: 'v8',
            // All non-UI application logic, including files no test imports.
            include: ['src/api/**/*.ts', 'src/utils/**/*.ts', 'src/hooks/**/*.ts', 'src/features/**/*.ts'],
            exclude: ['src/api/types.ts', 'src/features/booking/mockBookingData.ts'],
            reporter: ['text', 'html', 'json-summary', 'lcov'],
            thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
        },
    },
});
