import { describe, it, expect } from 'vitest';
import { DiagnosticSeverity } from 'vscode-languageserver/node';
import {
    validateAlpsSemantics,
    CODE_BROKEN_REFERENCE,
    CODE_NAMING_CONVENTION
} from '../src/alpsDiagnostics';
import { TextDocument } from 'vscode-languageserver-textdocument';

function createDocument(content: string, languageId: string): TextDocument {
    const uri = languageId === 'alps-json' ? 'file:///test.alps.json' : 'file:///test.alps.xml';
    return TextDocument.create(uri, languageId, 1, content);
}

function validate(content: string, languageId: string) {
    return validateAlpsSemantics(createDocument(content, languageId), languageId);
}

describe('alpsDiagnostics', () => {
    describe('broken references', () => {
        it('should warn on broken href reference in XML', () => {
            const content = `<alps>
  <descriptor id="user" type="semantic"/>
  <descriptor href="#missing"/>
</alps>`;
            const diagnostics = validate(content, 'alps-xml');

            expect(diagnostics).toHaveLength(1);
            expect(diagnostics[0].code).toBe(CODE_BROKEN_REFERENCE);
            expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Warning);
            expect(diagnostics[0].message).toContain('#missing');
            expect(diagnostics[0].data).toEqual({ missingId: 'missing' });
            // Range covers the fragment id (without the '#')
            expect(diagnostics[0].range.start).toEqual({ line: 2, character: 21 });
            expect(diagnostics[0].range.end).toEqual({ line: 2, character: 28 });
        });

        it('should warn on broken rt reference in XML', () => {
            const content = `<alps>
  <descriptor id="goHome" type="safe" rt="#Home"/>
</alps>`;
            const diagnostics = validate(content, 'alps-xml');

            expect(diagnostics).toHaveLength(1);
            expect(diagnostics[0].code).toBe(CODE_BROKEN_REFERENCE);
            expect(diagnostics[0].data).toEqual({ missingId: 'Home' });
        });

        it('should warn on broken href reference in JSON', () => {
            const content = `{
  "alps": {
    "descriptor": [
      { "id": "user", "type": "semantic" },
      { "href": "#missing" }
    ]
  }
}`;
            const diagnostics = validate(content, 'alps-json');

            expect(diagnostics).toHaveLength(1);
            expect(diagnostics[0].code).toBe(CODE_BROKEN_REFERENCE);
            expect(diagnostics[0].data).toEqual({ missingId: 'missing' });
            expect(diagnostics[0].range.start.line).toBe(4);
        });

        it('should not warn on valid local references', () => {
            const content = `<alps>
  <descriptor id="user" type="semantic"/>
  <descriptor id="goUser" type="safe" rt="#user">
    <descriptor href="#user"/>
  </descriptor>
</alps>`;
            expect(validate(content, 'alps-xml')).toHaveLength(0);
        });

        it('should not warn on external references', () => {
            const content = `<alps>
  <descriptor href="http://alps.io/profile#name"/>
</alps>`;
            expect(validate(content, 'alps-xml')).toHaveLength(0);
        });

        it('should resolve references to nested descriptors', () => {
            const content = `{
  "alps": {
    "descriptor": [
      { "id": "Blog", "descriptor": [
        { "id": "title", "type": "semantic" }
      ] },
      { "href": "#title" }
    ]
  }
}`;
            expect(validate(content, 'alps-json')).toHaveLength(0);
        });
    });

    describe('naming conventions', () => {
        it('should warn when a safe descriptor id does not start with "go"', () => {
            const content = `<alps>
  <descriptor id="home" type="safe"/>
</alps>`;
            const diagnostics = validate(content, 'alps-xml');

            expect(diagnostics).toHaveLength(1);
            expect(diagnostics[0].code).toBe(CODE_NAMING_CONVENTION);
            expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Warning);
            expect(diagnostics[0].data).toEqual({ id: 'home', suggestedId: 'goHome' });
        });

        it('should warn when an unsafe descriptor id does not start with "do"', () => {
            const content = `{
  "alps": {
    "descriptor": [
      { "id": "createUser", "type": "unsafe" }
    ]
  }
}`;
            const diagnostics = validate(content, 'alps-json');

            expect(diagnostics).toHaveLength(1);
            expect(diagnostics[0].code).toBe(CODE_NAMING_CONVENTION);
            expect(diagnostics[0].data).toEqual({ id: 'createUser', suggestedId: 'doCreateUser' });
        });

        it('should warn when an idempotent descriptor id does not start with "do"', () => {
            const content = `<alps>
  <descriptor id="updateUser" type="idempotent"/>
</alps>`;
            const diagnostics = validate(content, 'alps-xml');

            expect(diagnostics).toHaveLength(1);
            expect(diagnostics[0].data).toEqual({ id: 'updateUser', suggestedId: 'doUpdateUser' });
        });

        it('should not warn on conforming transition names', () => {
            const content = `<alps>
  <descriptor id="goHome" type="safe"/>
  <descriptor id="doCreateUser" type="unsafe"/>
  <descriptor id="doUpdateUser" type="idempotent"/>
</alps>`;
            expect(validate(content, 'alps-xml')).toHaveLength(0);
        });

        it('should not warn on semantic descriptors', () => {
            const content = `<alps>
  <descriptor id="user" type="semantic"/>
  <descriptor id="noType"/>
</alps>`;
            expect(validate(content, 'alps-xml')).toHaveLength(0);
        });
    });

    it('should return no diagnostics for an empty document', () => {
        expect(validate('', 'alps-xml')).toHaveLength(0);
        expect(validate('', 'alps-json')).toHaveLength(0);
    });
});
