import { describe, it, expect } from 'vitest';
import { validateXML } from '../src/ImprovedXMLValidator';

describe('ImprovedXMLValidator', () => {
    it('should return no errors for valid ALPS XML', () => {
        const content = `<?xml version="1.0" encoding="UTF-8"?>
<alps version="1.0">
  <descriptor id="user" type="semantic">
    <doc>User profile</doc>
  </descriptor>
</alps>`;
        const errors = validateXML(content);
        expect(errors).toHaveLength(0);
    });

    it('should detect unclosed tag', () => {
        const content = `<alps>
  <descriptor id="user">
</alps>`;
        const errors = validateXML(content);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect mismatched tags', () => {
        const content = `<alps>
  <descriptor id="user">
  </doc>
</alps>`;
        const errors = validateXML(content);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid attribute syntax', () => {
        const content = `<alps>
  <descriptor id="user" type=>
  </descriptor>
</alps>`;
        const errors = validateXML(content);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle self-closing tags', () => {
        const content = `<alps>
  <descriptor id="user" type="semantic" />
</alps>`;
        const errors = validateXML(content);
        expect(errors).toHaveLength(0);
    });

    it('should detect unclosed tags at end of document', () => {
        const content = `<alps>
  <descriptor id="user">`;
        const errors = validateXML(content);
        expect(errors.length).toBeGreaterThan(0);
        // Should mention unclosed tags
        expect(errors.some(e => e.message.includes('Unclosed'))).toBe(true);
    });

    it('should handle deeply nested tags', () => {
        const content = `<alps>
  <descriptor id="outer">
    <doc>
      <ext>nested content</ext>
    </doc>
  </descriptor>
</alps>`;
        const errors = validateXML(content);
        expect(errors).toHaveLength(0);
    });

    it('should detect multiple unclosed tags', () => {
        const content = `<alps>
  <descriptor>
    <doc>`;
        const errors = validateXML(content);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle empty document', () => {
        const content = ``;
        const errors = validateXML(content);
        expect(errors).toHaveLength(0);
    });

    it('should detect mismatched nested tags', () => {
        const content = `<alps>
  <descriptor>
    <doc>content</descriptor>
  </doc>
</alps>`;
        const errors = validateXML(content);
        expect(errors.length).toBeGreaterThan(0);
    });
});

