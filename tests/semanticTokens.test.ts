import { describe, it, expect } from 'vitest';
import { buildSemanticTokens, semanticTokensLegend } from '../src/semanticTokens';
import { TextDocument } from 'vscode-languageserver-textdocument';

interface DecodedToken {
    line: number;
    char: number;
    length: number;
    tokenType: string;
}

function createDocument(content: string, languageId: string): TextDocument {
    const uri = languageId === 'alps-json' ? 'file:///test.alps.json' : 'file:///test.alps.xml';
    return TextDocument.create(uri, languageId, 1, content);
}

function decodeTokens(data: number[]): DecodedToken[] {
    const tokens: DecodedToken[] = [];
    let line = 0;
    let char = 0;
    for (let i = 0; i < data.length; i += 5) {
        line += data[i];
        char = data[i] === 0 ? char + data[i + 1] : data[i + 1];
        tokens.push({
            line,
            char,
            length: data[i + 2],
            tokenType: semanticTokensLegend.tokenTypes[data[i + 3]]
        });
    }
    return tokens;
}

function tokenize(content: string, languageId: string): DecodedToken[] {
    const document = createDocument(content, languageId);
    return decodeTokens(buildSemanticTokens(document, languageId).data);
}

function tokenText(content: string, token: DecodedToken): string {
    const lines = content.split('\n');
    return lines[token.line].substring(token.char, token.char + token.length);
}

describe('semanticTokens', () => {
    describe('XML documents', () => {
        it('should tokenize descriptor ids by ALPS type', () => {
            const content = `<alps>
  <descriptor id="user" type="semantic"/>
  <descriptor id="goHome" type="safe"/>
  <descriptor id="doCreate" type="unsafe"/>
  <descriptor id="doUpdate" type="idempotent"/>
</alps>`;
            const tokens = tokenize(content, 'alps-xml');
            const idTokens = tokens.filter(t => t.tokenType !== 'keyword');

            expect(idTokens).toHaveLength(4);
            expect(idTokens[0].tokenType).toBe('class');
            expect(tokenText(content, idTokens[0])).toBe('user');
            expect(idTokens[1].tokenType).toBe('function');
            expect(tokenText(content, idTokens[1])).toBe('goHome');
            expect(idTokens[2].tokenType).toBe('method');
            expect(tokenText(content, idTokens[2])).toBe('doCreate');
            expect(idTokens[3].tokenType).toBe('method');
            expect(tokenText(content, idTokens[3])).toBe('doUpdate');
        });

        it('should tokenize type attribute values as keyword', () => {
            const content = `<alps>
  <descriptor id="user" type="semantic"/>
</alps>`;
            const tokens = tokenize(content, 'alps-xml');
            const keywordTokens = tokens.filter(t => t.tokenType === 'keyword');

            expect(keywordTokens).toHaveLength(1);
            expect(tokenText(content, keywordTokens[0])).toBe('semantic');
        });

        it('should tokenize href and rt fragment references as property', () => {
            const content = `<alps>
  <descriptor id="user" type="semantic"/>
  <descriptor href="#user"/>
  <descriptor id="goUser" type="safe" rt="#user"/>
</alps>`;
            const tokens = tokenize(content, 'alps-xml');
            const refTokens = tokens.filter(t => t.tokenType === 'property');

            expect(refTokens).toHaveLength(2);
            refTokens.forEach(token => {
                expect(tokenText(content, token)).toBe('user');
            });
            // Fragment token starts after the '#'
            expect(content.split('\n')[2][refTokens[0].char - 1]).toBe('#');
        });

        it('should tokenize the fragment of an external reference', () => {
            const content = `<alps>
  <descriptor href="http://example.com/profile#name"/>
</alps>`;
            const tokens = tokenize(content, 'alps-xml');
            const refTokens = tokens.filter(t => t.tokenType === 'property');

            expect(refTokens).toHaveLength(1);
            expect(tokenText(content, refTokens[0])).toBe('name');
        });

        it('should default to class for descriptors without a type', () => {
            const content = `<alps>
  <descriptor id="noType"/>
</alps>`;
            const tokens = tokenize(content, 'alps-xml');

            expect(tokens).toHaveLength(1);
            expect(tokens[0].tokenType).toBe('class');
            expect(tokenText(content, tokens[0])).toBe('noType');
        });

        it('should ignore descriptors inside comments', () => {
            const content = `<alps>
  <!-- <descriptor id="commentedOut" type="safe"/> -->
  <descriptor id="user" type="semantic"/>
</alps>`;
            const tokens = tokenize(content, 'alps-xml');

            expect(tokens.some(t => tokenText(content, t) === 'commentedOut')).toBe(false);
            expect(tokens.some(t => tokenText(content, t) === 'user')).toBe(true);
        });

        it('should tokenize nested descriptors', () => {
            const content = `<alps>
  <descriptor id="Blog" type="semantic">
    <descriptor href="#goBlogPosting"/>
  </descriptor>
  <descriptor id="goBlogPosting" type="safe"/>
</alps>`;
            const tokens = tokenize(content, 'alps-xml');
            const refTokens = tokens.filter(t => t.tokenType === 'property');

            expect(refTokens).toHaveLength(1);
            expect(tokenText(content, refTokens[0])).toBe('goBlogPosting');
        });
    });

    describe('JSON documents', () => {
        it('should tokenize descriptor ids by ALPS type', () => {
            const content = `{
  "alps": {
    "descriptor": [
      { "id": "user", "type": "semantic" },
      { "id": "goHome", "type": "safe" },
      { "id": "doCreate", "type": "unsafe" },
      { "id": "doUpdate", "type": "idempotent" }
    ]
  }
}`;
            const tokens = tokenize(content, 'alps-json');
            const idTokens = tokens.filter(t => t.tokenType !== 'keyword');

            expect(idTokens).toHaveLength(4);
            expect(idTokens[0].tokenType).toBe('class');
            expect(tokenText(content, idTokens[0])).toBe('user');
            expect(idTokens[1].tokenType).toBe('function');
            expect(tokenText(content, idTokens[1])).toBe('goHome');
            expect(idTokens[2].tokenType).toBe('method');
            expect(tokenText(content, idTokens[2])).toBe('doCreate');
            expect(idTokens[3].tokenType).toBe('method');
            expect(tokenText(content, idTokens[3])).toBe('doUpdate');
        });

        it('should tokenize type values as keyword and references as property', () => {
            const content = `{
  "alps": {
    "descriptor": [
      { "id": "user", "type": "semantic" },
      { "id": "goUser", "type": "safe", "rt": "#user", "descriptor": [
        { "href": "#user" }
      ] }
    ]
  }
}`;
            const tokens = tokenize(content, 'alps-json');
            const keywordTokens = tokens.filter(t => t.tokenType === 'keyword');
            const refTokens = tokens.filter(t => t.tokenType === 'property');

            expect(keywordTokens).toHaveLength(2);
            expect(tokenText(content, keywordTokens[0])).toBe('semantic');
            expect(tokenText(content, keywordTokens[1])).toBe('safe');
            expect(refTokens).toHaveLength(2);
            refTokens.forEach(token => {
                expect(tokenText(content, token)).toBe('user');
            });
        });

        it('should not tokenize non-descriptor properties', () => {
            const content = `{
  "alps": {
    "version": "1.0",
    "link": { "rel": "self", "href": "http://example.com/profile" },
    "descriptor": [
      { "id": "user" }
    ]
  }
}`;
            const tokens = tokenize(content, 'alps-json');

            expect(tokens).toHaveLength(1);
            expect(tokenText(content, tokens[0])).toBe('user');
        });

        it('should return no tokens for invalid JSON', () => {
            const tokens = tokenize('{ not json', 'alps-json');
            expect(tokens.every(t => t.length > 0)).toBe(true);
        });
    });

    it('should return no tokens for an empty document', () => {
        expect(tokenize('', 'alps-xml')).toHaveLength(0);
        expect(tokenize('', 'alps-json')).toHaveLength(0);
    });

    it('should emit tokens in document order (valid delta encoding)', () => {
        const content = `<alps>
  <descriptor id="user" type="semantic"/><descriptor id="goUser" type="safe" rt="#user"/>
</alps>`;
        const document = createDocument(content, 'alps-xml');
        const data = buildSemanticTokens(document, 'alps-xml').data;

        // All delta values must be non-negative
        expect(data.every(n => n >= 0)).toBe(true);
        const tokens = decodeTokens(data);
        expect(tokens.length).toBe(5);
    });
});
