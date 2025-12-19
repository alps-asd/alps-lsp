import { describe, it, expect } from 'vitest';
import { validateJson } from '../src/jsonValidator';
import { TextDocument } from 'vscode-languageserver-textdocument';

function createDocument(content: string): TextDocument {
    return TextDocument.create('file:///test.alps.json', 'alps-json', 1, content);
}

describe('jsonValidator', () => {
    it('should return no errors for valid ALPS JSON', () => {
        const content = `{
  "alps": {
    "version": "1.0",
    "descriptor": [
      { "id": "user", "type": "semantic" }
    ]
  }
}`;
        const document = createDocument(content);
        const errors = validateJson(document);
        expect(errors).toHaveLength(0);
    });

    it('should detect invalid JSON syntax - missing comma', () => {
        const content = `{
  "alps": {
    "descriptor": [
      { "id": "user" "type": "semantic" }
    ]
  }
}`;
        const document = createDocument(content);
        const errors = validateJson(document);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].message).toContain('expected');
    });

    it('should detect missing closing brace', () => {
        const content = `{
  "alps": {
    "descriptor": [
      { "id": "user" }
    ]
  }`;
        const document = createDocument(content);
        const errors = validateJson(document);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should allow trailing comma (JSONC feature)', () => {
        // Note: jsonc-parser allows trailing commas by default
        const content = `{
  "alps": {
    "descriptor": [
      { "id": "user", "type": "semantic", }
    ]
  }
}`;
        const document = createDocument(content);
        const errors = validateJson(document);
        // Trailing comma is allowed in our configuration
        expect(errors).toHaveLength(0);
    });

    it('should detect unclosed string', () => {
        const content = `{
  "alps": {
    "descriptor": [
      { "id": "user }
    ]
  }
}`;
        const document = createDocument(content);
        const errors = validateJson(document);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid number format', () => {
        const content = `{ "value": 123abc }`;
        const document = createDocument(content);
        const errors = validateJson(document);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect property name expected', () => {
        const content = `{ 123: "value" }`;
        const document = createDocument(content);
        const errors = validateJson(document);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect value expected', () => {
        const content = `{ "key": }`;
        const document = createDocument(content);
        const errors = validateJson(document);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect colon expected', () => {
        const content = `{ "key" "value" }`;
        const document = createDocument(content);
        const errors = validateJson(document);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect closing bracket expected', () => {
        const content = `{ "arr": [1, 2, 3 }`;
        const document = createDocument(content);
        const errors = validateJson(document);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid character', () => {
        const content = `{ "key": @value }`;
        const document = createDocument(content);
        const errors = validateJson(document);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid escape character', () => {
        const content = `{ "key": "value\\q" }`;
        const document = createDocument(content);
        const errors = validateJson(document);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid unicode', () => {
        const content = `{ "key": "\\uGGGG" }`;
        const document = createDocument(content);
        const errors = validateJson(document);
        expect(errors.length).toBeGreaterThan(0);
    });

    it('should detect end of file expected', () => {
        const content = `{ "key": "value" } extra`;
        const document = createDocument(content);
        const errors = validateJson(document);
        expect(errors.length).toBeGreaterThan(0);
    });
});

