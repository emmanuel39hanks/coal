#!/usr/bin/env node
/**
 * Post-build fixup: TypeScript emits `"use strict";` before our `'use client';`
 * directive when targeting CommonJS, which defeats Next.js's client-component
 * detection (it expects `'use client';` to be the first statement).
 *
 * This script rewrites dist/index.js so that `'use client';` is the very first
 * line, followed by `"use strict";`, followed by the rest of the module. No
 * other changes. Keeps the build output byte-identical otherwise.
 */

const fs = require('node:fs');
const path = require('node:path');

const target = path.resolve(__dirname, '..', 'dist', 'index.js');

let content;
try {
    content = fs.readFileSync(target, 'utf8');
} catch (err) {
    console.error(`[fix-use-client] Cannot read ${target}: ${err.message}`);
    process.exit(1);
}

// Strip any existing `'use client';` lines anywhere in the file so we can
// guarantee exactly one copy, at the top.
const withoutClient = content.replace(/^\s*['"]use client['"];?\s*\n/gm, '');

const fixed = `'use client';\n${withoutClient}`;

fs.writeFileSync(target, fixed);
console.log(`[fix-use-client] Hoisted 'use client' to top of ${path.relative(process.cwd(), target)}`);
