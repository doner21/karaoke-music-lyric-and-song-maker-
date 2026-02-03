# Skill: Setup Vitest Test Infrastructure

## Purpose
Install and configure vitest for the karaoke-box project so pure function unit tests can run.

## Steps

### 1. Install vitest
```bash
cd "C:\Users\donald clark\.gemini\antigravity\scratch\karaoke-box"
npm install --save-dev vitest
```

### 2. Create vitest.config.js at project root

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.js'],
    globals: true,
  },
});
```

### 3. Add scripts to package.json

Add these to the `"scripts"` section:
```json
"test": "vitest run",
"test:watch": "vitest"
```

### 4. Verify

```bash
npx vitest run
```

Should complete with 0 tests found (no tests yet) and exit 0.

## Notes
- Use `environment: 'node'` since transform functions are pure JS with no DOM dependency.
- Use `globals: true` so `describe`, `it`, `expect` are available without imports.
- Tests go in `src/editor/__tests__/` directory.
