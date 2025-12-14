import { describe, it, expect } from 'vitest';
import { provideCompletionItems } from '../src/completionItems';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItemKind, Position, TextDocuments } from 'vscode-languageserver/node';
import { DescriptorInfo } from '../src/alpsParser';

// Mock TextDocuments
class MockTextDocuments extends TextDocuments<TextDocument> {
    private documents = new Map<string, TextDocument>();

    constructor() {
        super(TextDocument);
    }

    get(uri: string): TextDocument | undefined {
        return this.documents.get(uri);
    }

    set(uri: string, document: TextDocument) {
        this.documents.set(uri, document);
    }
}

describe('completionItems', () => {
    const documents = new MockTextDocuments();
    const descriptors: DescriptorInfo[] = [
        { id: 'user', type: 'semantic' },
        { id: 'create', type: 'unsafe' }
    ];

    function setupDocument(content: string, position: Position) {
        const uri = 'file:///test.xml';
        const document = TextDocument.create(uri, 'xml', 1, content);
        documents.set(uri, document);
        return {
            textDocument: { uri },
            position
        };
    }

    it('should provide tag completion', () => {
        const content = '<';
        const params = setupDocument(content, Position.create(0, 1));

        const result = provideCompletionItems(params, documents, []);

        expect(result.items).toEqual(expect.arrayContaining([
            expect.objectContaining({ label: 'descriptor' }),
            expect.objectContaining({ label: 'doc' }),
            expect.objectContaining({ label: 'ext' }),
            expect.objectContaining({ label: 'link' })
        ]));
    });

    it('should provide type attribute values', () => {
        const content = '<descriptor type="';
        const params = setupDocument(content, Position.create(0, 18));

        const result = provideCompletionItems(params, documents, []);

        expect(result.items).toEqual(expect.arrayContaining([
            expect.objectContaining({ label: 'semantic', kind: CompletionItemKind.EnumMember }),
            expect.objectContaining({ label: 'safe', kind: CompletionItemKind.EnumMember }),
            expect.objectContaining({ label: 'unsafe', kind: CompletionItemKind.EnumMember }),
            expect.objectContaining({ label: 'idempotent', kind: CompletionItemKind.EnumMember })
        ]));
    });

    it('should provide href completion with descriptors', () => {
        const content = '<descriptor href="';
        const params = setupDocument(content, Position.create(0, 18));

        const result = provideCompletionItems(params, documents, descriptors);

        expect(result.items).toEqual(expect.arrayContaining([
            expect.objectContaining({ label: '#user', kind: CompletionItemKind.Reference }),
            expect.objectContaining({ label: '#create', kind: CompletionItemKind.Reference })
        ]));
    });

    it('should provide rt completion with semantic descriptors only', () => {
        const content = '<descriptor rt="';
        const params = setupDocument(content, Position.create(0, 16));

        const result = provideCompletionItems(params, documents, descriptors);

        // Only 'semantic' descriptors should be suggested for 'rt'
        expect(result.items).toHaveLength(1);
        expect(result.items).toEqual(expect.arrayContaining([
            expect.objectContaining({ label: '#user', kind: CompletionItemKind.Reference })
        ]));
    });

    it('should provide id attribute completions with semantic terms', () => {
        const content = '<descriptor id="';
        const params = setupDocument(content, Position.create(0, 16));

        const result = provideCompletionItems(params, documents, []);

        // Should provide semantic terms for id attribute
        expect(result.items.length).toBeGreaterThan(0);
        expect(result.items[0].kind).toBe(CompletionItemKind.Text);
    });

    it('should provide attribute completions after space', () => {
        const content = '<descriptor ';
        const params = setupDocument(content, Position.create(0, 12));

        const result = provideCompletionItems(params, documents, []);

        // Should provide common descriptor attributes
        const labels = result.items.map(i => i.label);
        expect(labels).toContain('id');
        expect(labels).toContain('type');
        expect(labels).toContain('href');
        expect(labels).toContain('rt');
    });

    it('should filter out already used attributes', () => {
        const content = '<descriptor id="test" ';
        const params = setupDocument(content, Position.create(0, 22));

        const result = provideCompletionItems(params, documents, []);

        // 'id' should not be suggested since it's already used
        const labels = result.items.map(i => i.label);
        expect(labels).not.toContain('id');
        expect(labels).toContain('type');
    });

    it('should provide closing tag completion', () => {
        const content = '<alps><descriptor></';
        const params = setupDocument(content, Position.create(0, 20));

        const result = provideCompletionItems(params, documents, []);

        expect(result.items).toHaveLength(1);
        expect(result.items[0].label).toBe('descriptor');
    });

    it('should provide doc tag attribute completions', () => {
        const content = '<doc ';
        const params = setupDocument(content, Position.create(0, 5));

        const result = provideCompletionItems(params, documents, []);

        // Should provide doc attributes
        const labels = result.items.map(i => i.label);
        expect(labels).toContain('format');
        expect(labels).toContain('contentType');
        expect(labels).toContain('href');
    });

    it('should provide format attribute values for doc element', () => {
        const content = '<doc format="';
        const params = setupDocument(content, Position.create(0, 13));

        const result = provideCompletionItems(params, documents, []);

        const labels = result.items.map(i => i.label);
        expect(labels).toContain('text');
        expect(labels).toContain('html');
        expect(labels).toContain('asciidoc');
        expect(labels).toContain('markdown');
    });

    it('should provide contentType attribute values for doc element', () => {
        const content = '<doc contentType="';
        const params = setupDocument(content, Position.create(0, 18));

        const result = provideCompletionItems(params, documents, []);

        const labels = result.items.map(i => i.label);
        expect(labels).toContain('text/plain');
        expect(labels).toContain('text/html');
        expect(labels).toContain('text/markdown');
    });

    it('should return empty items for unknown document', () => {
        const params = {
            textDocument: { uri: 'file:///unknown.xml' },
            position: Position.create(0, 0)
        };

        const result = provideCompletionItems(params, documents, []);

        expect(result.items).toHaveLength(0);
    });
});

