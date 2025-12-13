import { describe, it, expect } from 'vitest';
import { getOpenTag } from '../src/utils';

describe('utils', () => {
    describe('getOpenTag', () => {
        it('should find the open tag at current position', () => {
            const text = '<alps><descriptor></';
            const result = getOpenTag(text, text.length);
            expect(result).toBe('descriptor');
        });

        it('should find nested open tag', () => {
            const text = '<alps><descriptor><doc></';
            const result = getOpenTag(text, text.length);
            expect(result).toBe('doc');
        });

        it('should skip closed tags', () => {
            const text = '<alps><descriptor></descriptor></';
            const result = getOpenTag(text, text.length);
            expect(result).toBe('alps');
        });

        it('should handle self-closing tags', () => {
            const text = '<alps><descriptor id="x" /></';
            const result = getOpenTag(text, text.length);
            expect(result).toBe('alps');
        });

        it('should return null when no open tag found', () => {
            const text = '</';
            const result = getOpenTag(text, text.length);
            expect(result).toBeNull();
        });

        it('should handle multiple nested levels', () => {
            const text = '<alps><descriptor><doc>content</doc><link></';
            const result = getOpenTag(text, text.length);
            expect(result).toBe('link');
        });

        it('should handle tags with hyphens', () => {
            const text = '<foo-bar></';
            const result = getOpenTag(text, text.length);
            expect(result).toBe('foo-bar');
        });

        it('should handle tags with namespaces', () => {
            const text = '<ns:tag></';
            const result = getOpenTag(text, text.length);
            expect(result).toBe('ns:tag');
        });

        it('should handle tags with very long attributes', () => {
            const text = '<descriptor id="very-long-id" type="semantic" href="http://example.com/very/long/url/path" title="A very long title that goes on and on" name="anotherAttribute" custom="moredata"></';
            const result = getOpenTag(text, text.length);
            expect(result).toBe('descriptor');
        });
    });
});

