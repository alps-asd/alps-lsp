import { describe, it, expect } from 'vitest';
import { provideJsonCompletionItems } from '../src/jsonCompletion';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Position, CompletionItemKind } from 'vscode-languageserver/node';
import { DescriptorInfo } from '../src/alpsParser';

function createDocument(content: string): TextDocument {
    return TextDocument.create('file:///test.alps.json', 'alps-json', 1, content);
}

describe('jsonCompletion', () => {
    const descriptors: DescriptorInfo[] = [
        { id: 'user', type: 'semantic' },
        { id: 'createUser', type: 'unsafe' }
    ];

    it('should provide type value completions', () => {
        const content = `{
  "alps": {
    "descriptor": [
      { "id": "test", "type": "" }
    ]
  }
}`;
        const document = createDocument(content);
        // Position inside the type value (empty string)
        const position = Position.create(3, 30);

        const result = provideJsonCompletionItems(document, {
            textDocument: { uri: document.uri },
            position
        }, descriptors);

        const labels = result.items.map(i => i.label);
        expect(labels).toContain('semantic');
        expect(labels).toContain('safe');
        expect(labels).toContain('unsafe');
        expect(labels).toContain('idempotent');
    });

    it('should provide href completions with descriptor references', () => {
        const content = `{
  "alps": {
    "descriptor": [
      { "id": "test", "href": "" }
    ]
  }
}`;
        const document = createDocument(content);
        // Position inside the href value
        const position = Position.create(3, 31);

        const result = provideJsonCompletionItems(document, {
            textDocument: { uri: document.uri },
            position
        }, descriptors);

        const labels = result.items.map(i => i.label);
        expect(labels).toContain('#user');
        expect(labels).toContain('#createUser');
    });

    it('should provide property key completions inside descriptor object', () => {
        const content = `{
  "alps": {
    "descriptor": [
      { }
    ]
  }
}`;
        const document = createDocument(content);
        // Position inside the empty object
        const position = Position.create(3, 8);

        const result = provideJsonCompletionItems(document, {
            textDocument: { uri: document.uri },
            position
        }, []);

        const labels = result.items.map(i => i.label);
        // Should suggest descriptor properties
        expect(labels.length).toBeGreaterThan(0);
    });

    it('should provide rt completions with semantic descriptors only', () => {
        const content = `{
  "alps": {
    "descriptor": [
      { "id": "goUser", "type": "safe", "rt": "" }
    ]
  }
}`;
        const document = createDocument(content);
        // Position inside the rt value (between the quotes of "")
        const position = Position.create(3, 47);

        const result = provideJsonCompletionItems(document, {
            textDocument: { uri: document.uri },
            position
        }, descriptors);

        const labels = result.items.map(i => i.label);
        // Only semantic descriptors should appear in rt completions
        expect(labels).toContain('#user');
        // unsafe descriptor should not appear
        expect(labels).not.toContain('#createUser');
    });
});

