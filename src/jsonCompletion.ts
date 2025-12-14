import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    TextDocumentPositionParams,
    CompletionList,
    Position,
    Range,
    TextEdit
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as jsonc from 'jsonc-parser';
import { DescriptorInfo } from './alpsParser';
import { semanticTerms } from './semanticTerms';

export function provideJsonCompletionItems(
    document: TextDocument,
    params: TextDocumentPositionParams,
    descriptors: DescriptorInfo[]
): CompletionList {
    const text = document.getText();
    const offset = document.offsetAt(params.position);
    let items: CompletionItem[] = [];

    // Don't show completions immediately after comma on the same line
    // This allows editor to handle Enter key for newline naturally
    const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
    const currentLineBeforeCursor = text.substring(lineStart, offset);
    if (currentLineBeforeCursor.trimEnd().endsWith(',')) {
        return CompletionList.create([], false);
    }

    const location = jsonc.getLocation(text, offset);
    const path = location.path;
    const parsedTree = jsonc.parseTree(text);
    const node = parsedTree ? jsonc.findNodeAtOffset(parsedTree, offset) : undefined;

    const isInsideString = node?.type === 'string';
    const isStartOfObject = (node?.type === 'object' && (node.offset === offset - 1 || node.offset === offset));
    const isAfterComma = isAfterCommaAtEndOfLine(text, offset);

    // Get existing properties in current object to filter duplicates
    const existingProperties = getExistingProperties(node, text);

    if (isAfterComma && path[1] === 'descriptor' && typeof path[2] === 'number') {
        items = getAutoInsertCompletions(document, params.position);
    } else if (isStartOfObject) {
        const range = Range.create(params.position, params.position);
        items = getObjectCompletions(path, existingProperties, range);
    } else if (isInsideString && node) {
        // Calculate the range inside the string (excluding quotes)
        const stringStart = node.offset + 1; // after opening quote
        const stringEnd = node.offset + node.length - 1; // before closing quote
        const range = Range.create(
            document.positionAt(stringStart),
            document.positionAt(stringEnd)
        );
        items = getStringCompletions(path, descriptors, range);
    } else if (node?.type === 'property') {
        items = getPropertyValueCompletions(path);
    } else if (location.isAtPropertyKey) {
        // Create insertion range at cursor position
        const range = Range.create(params.position, params.position);
        items = getPropertyKeyCompletions(path, existingProperties, range);
    }

    return CompletionList.create(items, false);
}

function getExistingProperties(node: jsonc.Node | undefined, text: string): string[] {
    if (!node) return [];

    // Find the nearest parent object node
    let current: jsonc.Node | undefined = node;
    while (current) {
        if (current.type === 'object') {
            // Extract property names from this object
            const properties: string[] = [];
            if (current.children) {
                for (const child of current.children) {
                    if (child.type === 'property' && child.children && child.children[0]) {
                        const keyNode = child.children[0];
                        if (keyNode.type === 'string') {
                            const keyText = text.substring(keyNode.offset, keyNode.offset + keyNode.length);
                            // Remove quotes from property name
                            const propertyName = keyText.replace(/^["']|["']$/g, '');
                            properties.push(propertyName);
                        }
                    }
                }
            }
            return properties;
        }
        current = current.parent;
    }

    return [];
}

function isAfterCommaAtEndOfLine(text: string, offset: number): boolean {
    if (offset < 1) return false;

    // Check if we are on a new line (whitespace only or empty)
    const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
    const currentLine = text.slice(lineStart, offset);

    if (currentLine.trim().length === 0) {
        // We are on a new/empty line, check the previous line
        if (lineStart > 0) {
            const previousLineEnd = lineStart - 1;
            const previousLineStart = text.lastIndexOf('\n', previousLineEnd - 1) + 1;
            const previousLine = text.slice(previousLineStart, previousLineEnd);
            return previousLine.trim().endsWith(',') || (previousLine.trim().endsWith('}') && !previousLine.trim().endsWith('},'));
            // Note: Originally purely checking for comma. 
            // CodeRabbit suggested: `previousLine.endsWith('},') (or previousLine.endsWith(',') and endsWith('}')`
            // Actually, if it ends with comma, we generally want to allow new property.
            // If it ends with }, that implies end of object, so usually expect comma if we are adding another object.
            // Let's stick to the core requirement: check previous line for trailing comma.
            // Simplified: return previousLine.trim().endsWith(',');
        }
        return false;
    }

    // Existing logic for same-line check
    const charBefore = text[offset - 1];
    if (charBefore === ',') {
        return true;
    }

    // Check if we are physically after a comma even if there is whitespace
    const textBefore = text.slice(0, offset);
    return textBefore.trimEnd().endsWith(',');
}

function getAutoInsertCompletions(document: TextDocument, position: Position): CompletionItem[] {
    const text = document.getText();
    const lineStart = text.lastIndexOf('\n', document.offsetAt(position) - 1) + 1;
    const currentLineText = text.substring(lineStart, document.offsetAt(position));
    const indentation = currentLineText.match(/^\s*/)?.[0] || '';

    const insertText = `{$0}`;
    const range = Range.create(position, position);

    return [
        {
            label: 'New Descriptor',
            kind: CompletionItemKind.Snippet,
            insertText: insertText,
            insertTextFormat: InsertTextFormat.Snippet,
            textEdit: TextEdit.insert(position, insertText),
            additionalTextEdits: [TextEdit.insert(position, `\n${indentation}`)],
            command: { title: 'Trigger Suggest', command: 'editor.action.triggerSuggest' }
        }
    ];
}

function getObjectCompletions(path: jsonc.JSONPath, existingProperties: string[], range: Range): CompletionItem[] {
    let items: CompletionItem[] = [];

    if (path.length === 0) {
        items = [createCompletionItem('alps', CompletionItemKind.Property, '"alps": {$1}', range)];
    } else if (path[0] === 'alps' && path.length === 1) {
        items = [
            createCompletionItem('version', CompletionItemKind.Property, '"version": "$1"', range),
            createCompletionItem('doc', CompletionItemKind.Property, '"doc": {$1}', range),
            createCompletionItem('descriptor', CompletionItemKind.Property, '"descriptor": [\n    {$1}\n  ]', range)
        ];
    } else if (path[1] === 'descriptor' && typeof path[2] === 'number') {
        items = getDescriptorPropertyCompletions(range);
    } else if (path[path.length - 1] === 'doc') {
        items = [
            createCompletionItem('value', CompletionItemKind.Property, '"value": "$1"', range),
            createCompletionItem('format', CompletionItemKind.Property, '"format": "$1"', range),
            createCompletionItem('href', CompletionItemKind.Property, '"href": "$1"', range),
            createCompletionItem('contentType', CompletionItemKind.Property, '"contentType": "$1"', range)
        ];
    }

    // Filter out existing properties
    return items.filter(item => !existingProperties.includes(item.label));
}

function getStringCompletions(path: jsonc.JSONPath, descriptors: DescriptorInfo[], range: Range): CompletionItem[] {
    const lastPath = path[path.length - 1];

    const createItem = (label: string, kind: CompletionItemKind, documentation?: string): CompletionItem => ({
        label,
        kind,
        documentation,
        textEdit: TextEdit.replace(range, label)
    });

    if (lastPath === 'type') {
        return [
            createItem('semantic', CompletionItemKind.EnumMember),
            createItem('safe', CompletionItemKind.EnumMember),
            createItem('unsafe', CompletionItemKind.EnumMember),
            createItem('idempotent', CompletionItemKind.EnumMember)
        ];
    } else if (lastPath === 'href') {
        return descriptors.map(descriptor =>
            createItem(`#${descriptor.id}`, CompletionItemKind.Reference, `Reference to ${descriptor.type} descriptor with id ${descriptor.id}`)
        );
    } else if (lastPath === 'rt') {
        // rt (return type) should only reference semantic descriptors
        return descriptors
            .filter(descriptor => descriptor.type === 'semantic')
            .map(descriptor =>
                createItem(`#${descriptor.id}`, CompletionItemKind.Reference, `Reference to semantic descriptor with id ${descriptor.id}`)
            );
    } else if (lastPath === 'id') {
        return semanticTerms.map(term =>
            createItem(term, CompletionItemKind.Text, `Semantic term: ${term}`)
        );
    } else if (path[path.length - 2] === 'doc' && lastPath === 'format') {
        return [
            createItem('text', CompletionItemKind.EnumMember),
            createItem('html', CompletionItemKind.EnumMember),
            createItem('asciidoc', CompletionItemKind.EnumMember),
            createItem('markdown', CompletionItemKind.EnumMember)
        ];
    } else if (path[path.length - 2] === 'doc' && lastPath === 'contentType') {
        return [
            createItem('text/plain', CompletionItemKind.EnumMember),
            createItem('text/html', CompletionItemKind.EnumMember),
            createItem('text/asciidoc', CompletionItemKind.EnumMember),
            createItem('text/markdown', CompletionItemKind.EnumMember)
        ];
    }
    return [];
}

function getPropertyValueCompletions(path: jsonc.JSONPath): CompletionItem[] {
    const lastPath = path[path.length - 1];
    if (lastPath === 'descriptor') {
        return [
            createCompletionItem('descriptor array', CompletionItemKind.Snippet, '[\n  {\n    "id": "$1",\n    "type": "$2"\n  }\n]')
        ];
    }
    return [];
}

function getPropertyKeyCompletions(path: jsonc.JSONPath, existingProperties: string[], range: Range): CompletionItem[] {
    let items: CompletionItem[] = [];

    if (path[0] === 'alps') {
        // Top level of alps object (path is ['alps'] or ['alps', ''])
        if (path.length === 1 || (path.length === 2 && path[1] === '')) {
            items = [
                createCompletionItem('version', CompletionItemKind.Property, '"version": "$1"', range),
                createCompletionItem('doc', CompletionItemKind.Property, '"doc": {$1}', range),
                createCompletionItem('descriptor', CompletionItemKind.Property, '"descriptor": [\n    {$1}\n  ]', range)
            ];
        } else if (path[1] === 'descriptor' && typeof path[2] === 'number') {
            items = getDescriptorPropertyCompletions(range);
        } else if (path[1] === 'doc' && (path.length === 2 || (path.length === 3 && path[2] === ''))) {
            items = [
                createCompletionItem('value', CompletionItemKind.Property, '"value": "$1"', range),
                createCompletionItem('format', CompletionItemKind.Property, '"format": "$1"', range),
                createCompletionItem('href', CompletionItemKind.Property, '"href": "$1"', range),
                createCompletionItem('contentType', CompletionItemKind.Property, '"contentType": "$1"', range)
            ];
        }
    }

    // Filter out existing properties
    return items.filter(item => !existingProperties.includes(item.label));
}

function getDescriptorPropertyCompletions(range: Range): CompletionItem[] {
    return [
        createCompletionItem('id', CompletionItemKind.Property, '"id": "$1"', range),
        createCompletionItem('href', CompletionItemKind.Property, '"href": "$1"', range),
        createCompletionItem('name', CompletionItemKind.Property, '"name": "$1"', range),
        createCompletionItem('title', CompletionItemKind.Property, '"title": "$1"', range),
        createCompletionItem('type', CompletionItemKind.Property, '"type": "$1"', range),
        createCompletionItem('rt', CompletionItemKind.Property, '"rt": "$1"', range),
        createCompletionItem('rel', CompletionItemKind.Property, '"rel": "$1"', range),
        createCompletionItem('def', CompletionItemKind.Property, '"def": "http://schema.org/$1"', range),
        createCompletionItem('doc', CompletionItemKind.Property, '"doc": {"format": "$1", "value": "$2"}', range),
        createCompletionItem('descriptor', CompletionItemKind.Property, '"descriptor": [\n    {$1}\n]', range)
    ];
}

function createCompletionItem(label: string, kind: CompletionItemKind, insertText: string, range?: Range): CompletionItem {
    const item: CompletionItem = {
        label,
        kind,
        insertText,
        insertTextFormat: InsertTextFormat.Snippet
    };

    // If range is provided, use textEdit to specify exact insertion position
    if (range) {
        item.textEdit = TextEdit.insert(range.start, insertText);
    }

    return item;
}
