import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/__tests__/**/*.test.ts'],
        environment: 'node',
        // coal-react's server + next surfaces only need Node's built-in fetch +
        // vitest assertions. React component rendering is covered by the
        // example app build, not here.
    },
});
