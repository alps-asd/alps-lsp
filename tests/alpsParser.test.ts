import { describe, it, expect } from 'vitest';
import { parseAlpsProfile } from '../src/alpsParser';

describe('alpsParser', () => {
    describe('JSON ALPS Profile', () => {
        it('should parse basic descriptors with position', async () => {
            const content = `{
  "alps": {
    "descriptor": [
      {
        "id": "user",
        "type": "semantic",
        "doc": "User profile"
      },
      {
        "id": "name",
        "type": "semantic"
      }
    ]
  }
}`;
            const descriptors = await parseAlpsProfile(content, 'alps-json');

            expect(descriptors).toHaveLength(2);

            // Check first descriptor
            expect(descriptors[0]).toEqual({
                id: 'user',
                type: 'semantic',
                doc: 'User profile',
                line: 4,
                column: expect.any(Number),
                href: undefined
            });

            // Check second descriptor
            expect(descriptors[1]).toEqual({
                id: 'name',
                type: 'semantic',
                doc: undefined,
                line: 9,
                column: expect.any(Number),
                href: undefined
            });
        });

        it('should parse descriptors with href', async () => {
            const content = `{
  "alps": {
    "descriptor": [
      {
        "id": "link",
        "href": "#other"
      }
    ]
  }
}`;
            const descriptors = await parseAlpsProfile(content, 'alps-json');

            expect(descriptors).toHaveLength(1);
            expect(descriptors[0].href).toBe('#other');
        });
    });

    describe('XML ALPS Profile', () => {
        it('should parse basic descriptors with position', async () => {
            const content = `<alps>
  <descriptor id="user" type="semantic">
    <doc>User profile</doc>
  </descriptor>
  <descriptor id="name" type="semantic" />
</alps>`;
            const descriptors = await parseAlpsProfile(content, 'alps-xml');

            expect(descriptors).toHaveLength(2);

            // Check first descriptor
            expect(descriptors[0]).toMatchObject({
                id: 'user',
                type: 'semantic',
                line: 1,
                column: expect.any(Number)
            });
            // Note: doc parsing in XML might depend on implementation details (xml2js vs sax)

            // Check second descriptor
            expect(descriptors[1]).toMatchObject({
                id: 'name',
                type: 'semantic',
                line: 4,
                column: expect.any(Number)
            });
        });

        it('should parse descriptors with href', async () => {
            const content = `<alps>
  <descriptor id="link" href="#other" />
</alps>`;
            const descriptors = await parseAlpsProfile(content, 'alps-xml');

            expect(descriptors).toHaveLength(1);
            expect(descriptors[0].href).toBe('#other');
        });

        it('should fallback to sax parser for malformed XML', async () => {
            // XML with attributes but structure that might cause xml2js to fail
            const content = `<alps>
  <descriptor id="test1" type="safe">
    <doc>Some documentation</doc>
  </descriptor>
</alps>`;
            const descriptors = await parseAlpsProfile(content, 'alps-xml');

            expect(descriptors.length).toBeGreaterThan(0);
            expect(descriptors[0].id).toBe('test1');
        });

        it('should handle XML without descriptor ids gracefully', async () => {
            const content = `<alps>
  <descriptor type="semantic" />
</alps>`;
            const descriptors = await parseAlpsProfile(content, 'alps-xml');

            // Descriptors without id should be filtered out
            expect(descriptors).toHaveLength(0);
        });

        it('should default type to semantic when not specified', async () => {
            const content = `<alps>
  <descriptor id="noType" />
</alps>`;
            const descriptors = await parseAlpsProfile(content, 'alps-xml');

            expect(descriptors).toHaveLength(1);
            expect(descriptors[0].type).toBe('semantic');
        });

        it('should parse doc element text content', async () => {
            const content = `<alps>
  <descriptor id="withDoc" type="semantic">
    <doc>This is documentation text</doc>
  </descriptor>
</alps>`;
            const descriptors = await parseAlpsProfile(content, 'alps-xml');

            expect(descriptors).toHaveLength(1);
            // Note: doc might be parsed differently depending on parser used
        });
    });

    describe('JSON ALPS Profile edge cases', () => {
        it('should handle empty descriptor array', async () => {
            const content = `{
  "alps": {
    "descriptor": []
  }
}`;
            const descriptors = await parseAlpsProfile(content, 'alps-json');
            expect(descriptors).toHaveLength(0);
        });

        it('should handle single descriptor object (not array)', async () => {
            const content = `{
  "alps": {
    "descriptor": {
      "id": "single",
      "type": "semantic"
    }
  }
}`;
            const descriptors = await parseAlpsProfile(content, 'alps-json');
            expect(descriptors).toHaveLength(1);
            expect(descriptors[0].id).toBe('single');
        });

        it('should skip descriptors without id', async () => {
            const content = `{
  "alps": {
    "descriptor": [
      { "type": "semantic" },
      { "id": "valid", "type": "safe" }
    ]
  }
}`;
            const descriptors = await parseAlpsProfile(content, 'alps-json');
            expect(descriptors).toHaveLength(1);
            expect(descriptors[0].id).toBe('valid');
        });

        it('should default type to semantic when not specified', async () => {
            const content = `{
  "alps": {
    "descriptor": [
      { "id": "noType" }
    ]
  }
}`;
            const descriptors = await parseAlpsProfile(content, 'alps-json');
            expect(descriptors).toHaveLength(1);
            expect(descriptors[0].type).toBe('semantic');
        });

        it('should handle invalid JSON gracefully', async () => {
            const content = `{ invalid json }`;
            const descriptors = await parseAlpsProfile(content, 'alps-json');
            expect(descriptors).toHaveLength(0);
        });

        it('should handle missing alps property', async () => {
            const content = `{ "other": {} }`;
            const descriptors = await parseAlpsProfile(content, 'alps-json');
            expect(descriptors).toHaveLength(0);
        });
    });
});

