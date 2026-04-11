/**
 * Unit tests for the non-React primitives exported from the main index.
 *
 * React component rendering is NOT tested here — those are covered by the
 * example app builds (coal-react-checkout, demo-store) which import every
 * component and verify they compile/render during Next.js's static analysis
 * + SSR pass. What we test here is the pure-function security glue that
 * does not need a DOM.
 */

import { describe, it, expect } from 'vitest';
import { safeJsonForScriptTag } from '../index';

describe('safeJsonForScriptTag — XSS escape for JSON-LD', () => {
    it('escapes </script> so it cannot terminate a script tag', () => {
        const payload = { name: 'Cake</script><script>alert(1)</script>' };
        const out = safeJsonForScriptTag(payload);

        expect(out).not.toContain('</script>');
        expect(out).toContain('\\u003c');
    });

    it('escapes < in isolation', () => {
        const out = safeJsonForScriptTag({ name: 'a<b' });
        expect(out).toContain('\\u003c');
        expect(out).not.toContain('<');
    });

    it('escapes > in isolation', () => {
        const out = safeJsonForScriptTag({ name: 'a>b' });
        expect(out).toContain('\\u003e');
        expect(out).not.toContain('>');
    });

    it('escapes &', () => {
        const out = safeJsonForScriptTag({ name: 'a & b' });
        expect(out).toContain('\\u0026');
        expect(out).not.toContain(' & ');
    });

    it('escapes U+2028 and U+2029 line separators', () => {
        const lineSeparator = '\u2028';
        const paragraphSeparator = '\u2029';
        const out = safeJsonForScriptTag({
            a: `before${lineSeparator}after`,
            b: `before${paragraphSeparator}after`,
        });

        expect(out).not.toContain(lineSeparator);
        expect(out).not.toContain(paragraphSeparator);
        expect(out).toContain('\\u2028');
        expect(out).toContain('\\u2029');
    });

    it('preserves normal JSON structure', () => {
        const payload = {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: [
                { '@type': 'Product', name: 'Safe Name', price: '9.99' },
            ],
        };
        const out = safeJsonForScriptTag(payload);
        const parsed = JSON.parse(
            out
                .replace(/\\u003c/g, '<')
                .replace(/\\u003e/g, '>')
                .replace(/\\u0026/g, '&'),
        );
        expect(parsed['@context']).toBe('https://schema.org');
        expect(parsed.itemListElement[0].name).toBe('Safe Name');
    });

    it('is a no-op JSON.parse roundtrip when the payload has no dangerous chars', () => {
        const payload = { a: 1, b: 'normal string', c: [1, 2, 3] };
        const out = safeJsonForScriptTag(payload);
        expect(JSON.parse(out)).toEqual(payload);
    });

    it('remains parseable after escaping dangerous chars', () => {
        const payload = {
            name: 'Product with </script> and & < > symbols',
            other: 'plain',
        };
        const out = safeJsonForScriptTag(payload);
        // The escaped output is valid JSON — the unicode escapes are
        // interpreted back into their original characters by JSON.parse.
        const parsed = JSON.parse(out);
        expect(parsed.name).toBe('Product with </script> and & < > symbols');
        expect(parsed.other).toBe('plain');
    });

    it('does not break on empty object', () => {
        expect(safeJsonForScriptTag({})).toBe('{}');
    });

    it('does not break on arrays', () => {
        expect(safeJsonForScriptTag([1, 2, 3])).toBe('[1,2,3]');
    });

    it('handles deeply nested objects', () => {
        const payload = {
            level1: {
                level2: {
                    level3: { name: 'innocent</script>' },
                },
            },
        };
        const out = safeJsonForScriptTag(payload);
        expect(out).not.toContain('</script>');
        expect(out).toContain('\\u003c');
    });
});
