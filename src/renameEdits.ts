import { Position, Range, TextEdit } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DescriptorInfo } from './alpsParser';

function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Computes the text edits required to rename a descriptor: its id definition
 * and all `href="#id"` references. Shared by the rename request handler and
 * the naming convention quick fix.
 */
export function computeRenameEdits(
    document: TextDocument,
    languageId: string,
    descriptors: DescriptorInfo[],
    descriptorId: string,
    newName: string
): TextEdit[] {
    const text = document.getText();
    const edits: TextEdit[] = [];
    const lines = text.split('\n');

    // Find the definition
    const descriptor = descriptors.find(d => d.id === descriptorId);
    if (descriptor && descriptor.line !== undefined) {
        if (languageId === 'alps-json') {
            // Find and replace id definition in JSON
            const line = lines[descriptor.line];
            const idPattern = new RegExp(`("id"\\s*:\\s*")(${escapeRegExp(descriptorId)})(")`);
            const match = line.match(idPattern);
            if (match && match.index !== undefined) {
                const startChar = match.index + match[1].length;
                edits.push(TextEdit.replace(
                    Range.create(
                        Position.create(descriptor.line, startChar),
                        Position.create(descriptor.line, startChar + descriptorId.length)
                    ),
                    newName
                ));
            }
        } else if (languageId === 'alps-xml') {
            // Find and replace id definition in XML
            const line = lines[descriptor.line];
            const idPattern = new RegExp(`(id\\s*=\\s*["'])(${escapeRegExp(descriptorId)})(["'])`);
            const match = line.match(idPattern);
            if (match && match.index !== undefined) {
                const startChar = match.index + match[1].length;
                edits.push(TextEdit.replace(
                    Range.create(
                        Position.create(descriptor.line, startChar),
                        Position.create(descriptor.line, startChar + descriptorId.length)
                    ),
                    newName
                ));
            }
        }
    }

    // Find all references
    lines.forEach((line, lineIndex) => {
        let match;
        if (languageId === 'alps-json') {
            // Find all href references in JSON
            const regex = new RegExp(`("href"\\s*:\\s*"#)(${escapeRegExp(descriptorId)})(")`, 'g');
            while ((match = regex.exec(line)) !== null) {
                const startChar = match.index + match[1].length;
                edits.push(TextEdit.replace(
                    Range.create(
                        Position.create(lineIndex, startChar),
                        Position.create(lineIndex, startChar + descriptorId.length)
                    ),
                    newName
                ));
            }
        } else if (languageId === 'alps-xml') {
            // Find all href references in XML
            const regex = new RegExp(`(href\\s*=\\s*["']#)(${escapeRegExp(descriptorId)})(["'])`, 'g');
            while ((match = regex.exec(line)) !== null) {
                const startChar = match.index + match[1].length;
                edits.push(TextEdit.replace(
                    Range.create(
                        Position.create(lineIndex, startChar),
                        Position.create(lineIndex, startChar + descriptorId.length)
                    ),
                    newName
                ));
            }
        }
    });

    return edits;
}
