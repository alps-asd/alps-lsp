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

    it('should provide id completions with semantic terms', () => {
        const content = `{
  "alps": {
    "descriptor": [
      { "id": "" }
    ]
  }
}`;
        const document = createDocument(content);
        // Position inside the id value
        const position = Position.create(3, 14);

        const result = provideJsonCompletionItems(document, {
            textDocument: { uri: document.uri },
            position
        }, []);

        // Should provide semantic terms
        expect(result.items.length).toBeGreaterThan(0);
        expect(result.items[0].kind).toBe(CompletionItemKind.Text);
    });

    it('should provide format completions for doc object', () => {
        const content = `{
  "alps": {
    "doc": {
      "format": ""
    }
  }
}`;
        const document = createDocument(content);
        // Position inside the format value
        const position = Position.create(3, 17);

        const result = provideJsonCompletionItems(document, {
            textDocument: { uri: document.uri },
            position
        }, []);

        const labels = result.items.map(i => i.label);
        expect(labels).toContain('text');
        expect(labels).toContain('html');
        expect(labels).toContain('markdown');
    });

    it('should provide contentType completions for doc object', () => {
        const content = `{
  "alps": {
    "doc": {
      "contentType": ""
    }
  }
}`;
        const document = createDocument(content);
        // Position inside the contentType value
        const position = Position.create(3, 21);

        const result = provideJsonCompletionItems(document, {
            textDocument: { uri: document.uri },
            position
        }, []);

        const labels = result.items.map(i => i.label);
        expect(labels).toContain('text/plain');
        expect(labels).toContain('text/html');
    });

    it('should provide property key completions at root object', () => {
        const content = `{

}`;
        const document = createDocument(content);
        // Position on empty line inside root object
        const position = Position.create(1, 2);

        const result = provideJsonCompletionItems(document, {
            textDocument: { uri: document.uri },
            position
        }, []);

        // At root level, should get general completions or empty
        // This tests the fallback path
        expect(result.items).toBeDefined();
    });

    it('should provide name and title property completions for descriptor', () => {
        const content = `{
  "alps": {
    "descriptor": [
      { "id": "test", "type": "semantic",  }
    ]
  }
}`;
        const document = createDocument(content);
        // Position after second comma (before closing brace)
        const position = Position.create(3, 47);

        const result = provideJsonCompletionItems(document, {
            textDocument: { uri: document.uri },
            position
        }, []);

        const labels = result.items.map(i => i.label);
        // Should get other descriptor property suggestions
        expect(labels).toContain('name');
        expect(labels).toContain('title');
        expect(labels).toContain('def');
    });


    it('should provide property value completions for descriptor array', () => {
        const content = `{
  "alps": {
    "descriptor":
  }
}`;
        const document = createDocument(content);
        // Position after "descriptor": (at property value position)
        const position = Position.create(2, 18);

        const result = provideJsonCompletionItems(document, {
            textDocument: { uri: document.uri },
            position
        }, []);

        // Should suggest array snippet
        expect(result.items.length).toBeGreaterThan(0);
        expect(result.items[0].kind).toBe(CompletionItemKind.Snippet);
    });


    it('should not provide completions immediately after comma', () => {
        const content = `{
  "alps": {
    "descriptor": [
      { "href": "#user" }
    ],
  }
}`;
        const document = createDocument(content);
        // Position immediately after comma (with whitespace)
        const position = Position.create(4, 6);

        const result = provideJsonCompletionItems(document, {
            textDocument: { uri: document.uri },
            position
        }, []);

        // Should return empty list to let editor handle newline naturally
        expect(result.items).toHaveLength(0);
    });

    it('should provide completions at top level of alps object', () => {
        const content = `{
  "alps": {

  }
}`;
        const document = createDocument(content);
        // Position on empty line inside alps object
        const position = Position.create(2, 4);

        const result = provideJsonCompletionItems(document, {
            textDocument: { uri: document.uri },
            position
        }, []);

        const labels = result.items.map(i => i.label);
        expect(labels).toContain('version');
        expect(labels).toContain('doc');
        expect(labels).toContain('descriptor');
    });

});

