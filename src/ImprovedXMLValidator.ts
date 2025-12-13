import * as sax from 'sax';
import { Diagnostic, DiagnosticSeverity, Position, Range } from 'vscode-languageserver/node';

export function validateXML(content: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const parser = sax.parser(true);
    const openTags: string[] = [];

    parser.onerror = (error) => {
        const { line, column } = parser;
        const range = Range.create(Position.create(line - 1, column), Position.create(line - 1, column + 1));
        diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range,
            message: `XML syntax error: ${error.message}`,
            source: 'ALPS XML Validator'
        });
        parser.resume();
    };

    parser.onopentag = (node) => {
        openTags.push(node.name);
    };

    parser.onclosetag = (tagName) => {
        const expected = openTags[openTags.length - 1];
        if (expected !== tagName) {
            const { line, column } = parser;
            const line0 = line - 1;
            const startCol = Math.max(0, column - tagName.length - 2);
            const endCol = column;
            const range = Range.create(Position.create(line0, startCol), Position.create(line0, endCol));
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range,
                message: `Mismatched closing tag: expected </${expected || 'unknown'}>, found </${tagName}>`,
                source: 'ALPS XML Validator'
            });
            return;
        }
        openTags.pop();
    };

    parser.write(content).close();

    // 閉じていないタグを警告として追加
    if (openTags.length > 0) {
        diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: Range.create(Position.create(parser.line - 1, parser.column), Position.create(parser.line - 1, parser.column + 1)),
            message: `Unclosed tags: ${openTags.join(', ')}`,
            source: 'ALPS XML Validator'
        });
    }

    return diagnostics;
}
