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
});

