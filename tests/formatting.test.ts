import { describe, it, expect } from 'vitest';
import { FormattingOptions } from 'vscode-languageserver/node';
import { formatDocument } from '../src/formatting';
import { TextDocument } from 'vscode-languageserver-textdocument';

const TWO_SPACES: FormattingOptions = { tabSize: 2, insertSpaces: true };
const FOUR_SPACES: FormattingOptions = { tabSize: 4, insertSpaces: true };
const TABS: FormattingOptions = { tabSize: 4, insertSpaces: false };

function createDocument(content: string, languageId: string): TextDocument {
    const uri = languageId === 'alps-json' ? 'file:///test.alps.json' : 'file:///test.alps.xml';
    return TextDocument.create(uri, languageId, 1, content);
}

function format(content: string, languageId: string, options: FormattingOptions = TWO_SPACES): string {
    const document = createDocument(content, languageId);
    const edits = formatDocument(document, languageId, options);
    return TextDocument.applyEdits(document, edits);
}

describe('formatting', () => {
    describe('JSON documents', () => {
        it('should format compact JSON honoring tabSize', () => {
            const content = `{"alps":{"version":"1.0","descriptor":[{"id":"user","type":"semantic"}]}}`;
            expect(format(content, 'alps-json')).toBe(`{
  "alps": {
    "version": "1.0",
    "descriptor": [
      {
        "id": "user",
        "type": "semantic"
      }
    ]
  }
}`);
        });

        it('should honor insertSpaces=false (tabs)', () => {
            const content = `{"alps":{"version":"1.0"}}`;
            const result = format(content, 'alps-json', TABS);
            expect(result).toContain('\t"alps"');
            expect(result).toContain('\t\t"version"');
        });

        it('should honor a different tab size', () => {
            const content = `{"alps":{"version":"1.0"}}`;
            const result = format(content, 'alps-json', FOUR_SPACES);
            expect(result).toContain('    "alps"');
            expect(result).toContain('        "version"');
        });

        it('should return no edits for invalid JSON', () => {
            const document = createDocument('{ "alps": ', 'alps-json');
            expect(formatDocument(document, 'alps-json', TWO_SPACES)).toHaveLength(0);
        });

        it('should be idempotent', () => {
            const content = `{"alps":{"descriptor":[{"id":"user"},{"id":"goUser","type":"safe","rt":"#user"}]}}`;
            const once = format(content, 'alps-json');
            const twice = format(once, 'alps-json');
            expect(twice).toBe(once);
        });
    });

    describe('XML documents', () => {
        it('should indent nested elements', () => {
            const content = `<?xml version="1.0" encoding="UTF-8"?>
<alps version="1.0">
<descriptor id="user" type="semantic">
<descriptor href="#userName"/>
</descriptor>
<descriptor id="userName" type="semantic"/>
</alps>
`;
            expect(format(content, 'alps-xml')).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<alps version="1.0">
  <descriptor id="user" type="semantic">
    <descriptor href="#userName" />
  </descriptor>
  <descriptor id="userName" type="semantic" />
</alps>
`);
        });

        it('should keep single-line text content inline and preserve it exactly', () => {
            const content = `<alps>
      <descriptor id="user" type="semantic">
            <doc>Represents a  user</doc>
      </descriptor>
</alps>`;
            expect(format(content, 'alps-xml')).toBe(`<alps>
  <descriptor id="user" type="semantic">
    <doc>Represents a  user</doc>
  </descriptor>
</alps>`);
        });

        it('should preserve attribute order and values', () => {
            const content = `<alps>
<descriptor   rt="#user"    type="safe"   id="goUser"/>
</alps>`;
            expect(format(content, 'alps-xml')).toBe(`<alps>
  <descriptor rt="#user" type="safe" id="goUser" />
</alps>`);
        });

        it('should preserve comments', () => {
            const content = `<alps>
<!-- Semantic descriptors -->
<descriptor id="user"/>
</alps>`;
            expect(format(content, 'alps-xml')).toBe(`<alps>
  <!-- Semantic descriptors -->
  <descriptor id="user" />
</alps>`);
        });

        it('should keep multi-line text content verbatim', () => {
            const content = `<alps>
  <doc format="text">
    Line one.
    Line two.
  </doc>
</alps>`;
            const result = format(content, 'alps-xml');
            expect(result).toContain('    Line one.');
            expect(result).toContain('    Line two.');
        });

        it('should honor insertSpaces=false (tabs)', () => {
            const content = `<alps>
<descriptor id="user"/>
</alps>`;
            expect(format(content, 'alps-xml', TABS)).toBe(`<alps>
\t<descriptor id="user" />
</alps>`);
        });

        it('should return no edits for XML that fails to parse', () => {
            const document = createDocument('<alps>\n  <descriptor id="user">\n</alps>', 'alps-xml');
            expect(formatDocument(document, 'alps-xml', TWO_SPACES)).toHaveLength(0);
        });

        it('should return no edits for an empty document', () => {
            const document = createDocument('', 'alps-xml');
            expect(formatDocument(document, 'alps-xml', TWO_SPACES)).toHaveLength(0);
        });

        it('should be idempotent', () => {
            const content = `<?xml version="1.0"?>
<alps version="1.0">
<!-- states -->
<descriptor id="user" type="semantic"><doc>A user</doc>
<descriptor href="#userName"/></descriptor>
<descriptor id="userName"/>
<doc format="text">
  Multi line
  documentation
</doc>
</alps>
`;
            const once = format(content, 'alps-xml');
            const twice = format(once, 'alps-xml');
            expect(twice).toBe(once);
        });

        it('should return no edits when the document is already formatted', () => {
            const content = `<alps>
  <descriptor id="user" />
</alps>
`;
            const document = createDocument(content, 'alps-xml');
            expect(formatDocument(document, 'alps-xml', TWO_SPACES)).toHaveLength(0);
        });
    });
});
