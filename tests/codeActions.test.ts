import { describe, it, expect } from 'vitest';
import { provideCodeActions } from '../src/codeActions';
import { validateAlpsSemantics } from '../src/alpsDiagnostics';
import { parseAlpsProfile } from '../src/alpsParser';
import { TextDocument } from 'vscode-languageserver-textdocument';

function createDocument(content: string, languageId: string): TextDocument {
    const uri = languageId === 'alps-json' ? 'file:///test.alps.json' : 'file:///test.alps.xml';
    return TextDocument.create(uri, languageId, 1, content);
}

async function getActions(content: string, languageId: string) {
    const document = createDocument(content, languageId);
    const diagnostics = validateAlpsSemantics(document, languageId);
    const descriptors = await parseAlpsProfile(content, languageId);
    return { document, actions: provideCodeActions(document, languageId, diagnostics, descriptors) };
}

function applyActionEdits(document: TextDocument, action: { edit?: { changes?: Record<string, import('vscode-languageserver/node').TextEdit[]> } }): string {
    const edits = action.edit?.changes?.[document.uri] ?? [];
    return TextDocument.applyEdits(document, edits);
}

describe('codeActions', () => {
    describe('create missing descriptor (broken reference)', () => {
        it('should create the missing descriptor in XML', async () => {
            const content = `<alps>
  <descriptor id="user" type="semantic"/>
  <descriptor href="#missing"/>
</alps>`;
            const { document, actions } = await getActions(content, 'alps-xml');

            expect(actions).toHaveLength(1);
            expect(actions[0].title).toBe("Create descriptor 'missing'");
            expect(actions[0].kind).toBe('quickfix');
            expect(actions[0].diagnostics).toHaveLength(1);

            const result = applyActionEdits(document, actions[0]);
            expect(result).toBe(`<alps>
  <descriptor id="user" type="semantic"/>
  <descriptor href="#missing"/>
  <descriptor id="missing"/>
</alps>`);

            // The fix resolves the diagnostic
            const fixedDocument = createDocument(result, 'alps-xml');
            expect(validateAlpsSemantics(fixedDocument, 'alps-xml')).toHaveLength(0);
        });

        it('should create the missing descriptor in JSON', async () => {
            const content = `{
  "alps": {
    "descriptor": [
      { "id": "user", "type": "semantic" },
      { "href": "#missing" }
    ]
  }
}`;
            const { document, actions } = await getActions(content, 'alps-json');

            expect(actions).toHaveLength(1);
            expect(actions[0].title).toBe("Create descriptor 'missing'");

            const result = applyActionEdits(document, actions[0]);
            const parsed = JSON.parse(result);
            expect(parsed.alps.descriptor).toHaveLength(3);
            expect(parsed.alps.descriptor[2]).toEqual({ id: 'missing' });

            // The fix resolves the diagnostic
            const fixedDocument = createDocument(result, 'alps-json');
            expect(validateAlpsSemantics(fixedDocument, 'alps-json')).toHaveLength(0);
        });

        it('should return no create action when JSON has no descriptor array', async () => {
            const content = `{
  "alps": {
    "descriptor": { "href": "#missing" }
  }
}`;
            const { actions } = await getActions(content, 'alps-json');
            expect(actions).toHaveLength(0);
        });
    });

    describe('rename to naming convention', () => {
        it('should rename a safe descriptor and its references in XML', async () => {
            const content = `<alps>
  <descriptor id="home" type="safe"/>
  <descriptor id="Index" type="semantic">
    <descriptor href="#home"/>
  </descriptor>
</alps>`;
            const { document, actions } = await getActions(content, 'alps-xml');

            expect(actions).toHaveLength(1);
            expect(actions[0].title).toBe("Rename to 'goHome'");
            expect(actions[0].kind).toBe('quickfix');

            const result = applyActionEdits(document, actions[0]);
            expect(result).toContain('<descriptor id="goHome" type="safe"/>');
            expect(result).toContain('<descriptor href="#goHome"/>');
            expect(result).not.toContain('"#home"');

            const fixedDocument = createDocument(result, 'alps-xml');
            expect(validateAlpsSemantics(fixedDocument, 'alps-xml')).toHaveLength(0);
        });

        it('should rename an unsafe descriptor and its references in JSON', async () => {
            const content = `{
  "alps": {
    "descriptor": [
      { "id": "createUser", "type": "unsafe" },
      { "id": "UserList", "type": "semantic", "descriptor": [
        { "href": "#createUser" }
      ] }
    ]
  }
}`;
            const { document, actions } = await getActions(content, 'alps-json');

            expect(actions).toHaveLength(1);
            expect(actions[0].title).toBe("Rename to 'doCreateUser'");

            const result = applyActionEdits(document, actions[0]);
            const parsed = JSON.parse(result);
            expect(parsed.alps.descriptor[0].id).toBe('doCreateUser');
            expect(parsed.alps.descriptor[1].descriptor[0].href).toBe('#doCreateUser');
        });
    });

    it('should produce one action per fixable diagnostic', async () => {
        const content = `<alps>
  <descriptor id="home" type="safe" rt="#Missing"/>
</alps>`;
        const { actions } = await getActions(content, 'alps-xml');

        const titles = actions.map(a => a.title).sort();
        expect(titles).toEqual(["Create descriptor 'Missing'", "Rename to 'goHome'"]);
    });

    it('should ignore diagnostics without a known code', async () => {
        const content = `<alps>
  <descriptor id="user" type="semantic"/>
</alps>`;
        const document = createDocument(content, 'alps-xml');
        const descriptors = await parseAlpsProfile(content, 'alps-xml');
        const actions = provideCodeActions(document, 'alps-xml', [{
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
            message: 'Some other diagnostic'
        }], descriptors);

        expect(actions).toHaveLength(0);
    });
});
