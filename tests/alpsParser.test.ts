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
    });
});

