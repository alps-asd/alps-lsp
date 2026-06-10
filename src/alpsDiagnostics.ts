import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { scanDescriptors } from './alpsScanner';

export const ALPS_DIAGNOSTIC_SOURCE = 'ALPS Validator';

/** Diagnostic code: href/rt points to a local descriptor that does not exist */
export const CODE_BROKEN_REFERENCE = 'alps-broken-reference';
/** Diagnostic code: descriptor id does not follow the goXxx/doXxx naming convention */
export const CODE_NAMING_CONVENTION = 'alps-naming-convention';

/** Attached to broken reference diagnostics via Diagnostic.data */
export interface BrokenReferenceData {
    missingId: string;
}

/** Attached to naming convention diagnostics via Diagnostic.data */
export interface NamingConventionData {
    id: string;
    suggestedId: string;
}

/** Naming convention prefix for transition descriptors: safe -> go, unsafe/idempotent -> do */
function namingPrefix(type: string): string | null {
    if (type === 'safe') {
        return 'go';
    }
    if (type === 'unsafe' || type === 'idempotent') {
        return 'do';
    }
    return null;
}

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Validates ALPS semantics beyond syntax: broken local references (`#xyz`
 * pointing to a non-existent descriptor) and transition naming conventions
 * (safe ids should start with "go", unsafe/idempotent ids with "do").
 * All diagnostics are Warning severity.
 */
export function validateAlpsSemantics(document: TextDocument, languageId: string): Diagnostic[] {
    const occurrences = scanDescriptors(document.getText(), languageId);
    const knownIds = new Set(
        occurrences.flatMap(occurrence => occurrence.id ? [occurrence.id.value] : [])
    );
    const diagnostics: Diagnostic[] = [];

    for (const occurrence of occurrences) {
        // Broken local references: href="#missing" / rt="#missing"
        for (const reference of [occurrence.href, occurrence.rt]) {
            if (!reference || !reference.value.startsWith('#')) {
                continue; // external references (URLs) are not checked
            }
            const referencedId = reference.value.slice(1);
            if (referencedId === '' || knownIds.has(referencedId)) {
                continue;
            }
            const data: BrokenReferenceData = { missingId: referencedId };
            diagnostics.push({
                severity: DiagnosticSeverity.Warning,
                range: rangeAt(document, reference.offset + 1, referencedId.length),
                message: `Reference to non-existent descriptor: '#${referencedId}'`,
                source: ALPS_DIAGNOSTIC_SOURCE,
                code: CODE_BROKEN_REFERENCE,
                data
            });
        }

        // Naming conventions for transition descriptors
        if (occurrence.id && occurrence.type) {
            const prefix = namingPrefix(occurrence.type.value);
            if (prefix && !occurrence.id.value.startsWith(prefix)) {
                const data: NamingConventionData = {
                    id: occurrence.id.value,
                    suggestedId: prefix + capitalize(occurrence.id.value)
                };
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: rangeAt(document, occurrence.id.offset, occurrence.id.value.length),
                    message: `${capitalize(occurrence.type.value)} descriptor '${occurrence.id.value}' should start with "${prefix}" (e.g. '${data.suggestedId}')`,
                    source: ALPS_DIAGNOSTIC_SOURCE,
                    code: CODE_NAMING_CONVENTION,
                    data
                });
            }
        }
    }

    return diagnostics;
}

function rangeAt(document: TextDocument, offset: number, length: number): Range {
    return Range.create(document.positionAt(offset), document.positionAt(offset + length));
}
