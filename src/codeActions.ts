import { CodeAction, CodeActionKind, Diagnostic, Position, Range, TextEdit } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as jsonc from 'jsonc-parser';
import { DescriptorInfo } from './alpsParser';
import {
    BrokenReferenceData,
    CODE_BROKEN_REFERENCE,
    CODE_NAMING_CONVENTION,
    NamingConventionData
} from './alpsDiagnostics';
import { computeRenameEdits } from './renameEdits';

/**
 * Provides quick fixes for ALPS semantic diagnostics:
 * - broken local reference -> create the missing descriptor
 * - naming convention violation -> rename the descriptor and all references
 */
export function provideCodeActions(
    document: TextDocument,
    languageId: string,
    diagnostics: Diagnostic[],
    descriptors: DescriptorInfo[]
): CodeAction[] {
    const actions: CodeAction[] = [];

    for (const diagnostic of diagnostics) {
        if (diagnostic.code === CODE_BROKEN_REFERENCE) {
            const data = diagnostic.data as BrokenReferenceData | undefined;
            const missingId = data?.missingId ?? document.getText(diagnostic.range);
            if (!missingId) {
                continue;
            }
            const edits = createDescriptorEdits(document, languageId, missingId);
            if (edits.length > 0) {
                actions.push({
                    title: `Create descriptor '${missingId}'`,
                    kind: CodeActionKind.QuickFix,
                    diagnostics: [diagnostic],
                    edit: { changes: { [document.uri]: edits } }
                });
            }
        } else if (diagnostic.code === CODE_NAMING_CONVENTION) {
            const data = diagnostic.data as NamingConventionData | undefined;
            if (!data?.id || !data.suggestedId) {
                continue;
            }
            const edits = computeRenameEdits(document, languageId, descriptors, data.id, data.suggestedId);
            if (edits.some(edit => rangesEqual(edit.range, diagnostic.range))) {
                actions.push({
                    title: `Rename to '${data.suggestedId}'`,
                    kind: CodeActionKind.QuickFix,
                    diagnostics: [diagnostic],
                    edit: { changes: { [document.uri]: edits } }
                });
            }
        }
    }

    return actions;
}

function rangesEqual(a: Range, b: Range): boolean {
    return a.start.line === b.start.line
        && a.start.character === b.start.character
        && a.end.line === b.end.line
        && a.end.character === b.end.character;
}

/** Inserts a minimal descriptor at the end of the top-level descriptor list. */
function createDescriptorEdits(document: TextDocument, languageId: string, id: string): TextEdit[] {
    if (languageId === 'alps-json') {
        return createJsonDescriptorEdits(document, id);
    }
    if (languageId === 'alps-xml') {
        return createXmlDescriptorEdits(document, id);
    }
    return [];
}

function createJsonDescriptorEdits(document: TextDocument, id: string): TextEdit[] {
    const text = document.getText();
    const root = jsonc.parseTree(text);
    if (!root) {
        return [];
    }
    const descriptorNode = jsonc.findNodeAtLocation(root, ['alps', 'descriptor']);
    if (!descriptorNode || descriptorNode.type !== 'array') {
        return [];
    }

    // Append { "id": "<id>" } to the end of the top-level descriptor array
    const edits = jsonc.modify(text, ['alps', 'descriptor', -1], { id }, {
        isArrayInsertion: true,
        formattingOptions: detectJsonFormatting(text)
    });
    return edits.map(edit => TextEdit.replace(
        {
            start: document.positionAt(edit.offset),
            end: document.positionAt(edit.offset + edit.length)
        },
        edit.content
    ));
}

function detectJsonFormatting(text: string): jsonc.FormattingOptions {
    const indentMatch = text.match(/^([ \t]+)\S/m);
    const indent = indentMatch ? indentMatch[1] : '  ';
    return {
        insertSpaces: !indent.startsWith('\t'),
        tabSize: indent.startsWith('\t') ? 1 : indent.length,
        eol: text.includes('\r\n') ? '\r\n' : '\n'
    };
}

function createXmlDescriptorEdits(document: TextDocument, id: string): TextEdit[] {
    const text = document.getText();
    const closeTagOffset = text.lastIndexOf('</alps>');
    if (closeTagOffset < 0) {
        return [];
    }

    // Match the indentation of existing top-level descriptors (default: two spaces)
    const indentMatch = text.match(/^([ \t]+)<descriptor\b/m);
    const indent = indentMatch ? indentMatch[1] : '  ';

    const newDescriptor = `${indent}<descriptor id="${id}"/>\n`;
    const lineStartOffset = text.lastIndexOf('\n', closeTagOffset - 1) + 1;
    const beforeOnLine = text.slice(lineStartOffset, closeTagOffset);
    if (beforeOnLine.trim() === '') {
        // </alps> starts its own line: insert the new descriptor line above it
        const insertPosition: Position = document.positionAt(lineStartOffset);
        return [TextEdit.insert(insertPosition, newDescriptor)];
    }
    // </alps> shares a line with other content: break the line before it
    const insertPosition: Position = document.positionAt(closeTagOffset);
    return [TextEdit.insert(insertPosition, `\n${newDescriptor}`)];
}
