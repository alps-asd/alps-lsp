import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    TextDocumentSyncKind,
    TextDocumentChangeEvent,
    Diagnostic,
    DiagnosticSeverity,
    CompletionList,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    CompletionTriggerKind,
    Logger,
    LogMessageNotification,
    Location,
    Position,
    Range,
    DefinitionParams,
    ReferenceParams,
    Hover,
    HoverParams,
    MarkupKind,
    DocumentSymbol,
    DocumentSymbolParams,
    SymbolKind,
    RenameParams,
    WorkspaceEdit,
    TextEdit,
    CodeAction,
    CodeActionKind,
    CodeActionParams,
    DocumentFormattingParams
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { provideCompletionItems } from './completionItems';
import { parseAlpsProfile, DescriptorInfo } from './alpsParser';
import { validateXML } from './ImprovedXMLValidator';
import { validateJson } from './jsonValidator';
import { provideJsonCompletionItems } from './jsonCompletion';
import { buildSemanticTokens, semanticTokensLegend } from './semanticTokens';
import { validateAlpsSemantics } from './alpsDiagnostics';
import { provideCodeActions } from './codeActions';
import { computeRenameEdits } from './renameEdits';
import { formatDocument } from './formatting';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
const documentDescriptors: Map<string, DescriptorInfo[]> = new Map();
const validationTimers: Map<string, NodeJS.Timeout> = new Map();
const documentLanguageIds: Map<string, string> = new Map();

// Create a simple logger
const logger: Logger = {
    error: (message: string) => connection.console.error(message),
    warn: (message: string) => connection.console.warn(message),
    info: (message: string) => connection.console.info(message),
    log: (message: string) => connection.console.log(message)
};

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

connection.onInitialize((params: InitializeParams) => {
    logger.info('ALPS Language Server initialized');
    return {
        capabilities: {
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['<', ' ', '"', '#', '/', '{', ':', ',']
            },
            textDocumentSync: TextDocumentSyncKind.Incremental,
            definitionProvider: true,
            referencesProvider: true,
            hoverProvider: true,
            documentSymbolProvider: true,
            renameProvider: true,
            semanticTokensProvider: {
                legend: semanticTokensLegend,
                full: true
            },
            codeActionProvider: {
                codeActionKinds: [CodeActionKind.QuickFix]
            },
            documentFormattingProvider: true,
        }
    };
});

documents.onDidOpen((event) => {
    const document = event.document;
    documentLanguageIds.set(document.uri, document.languageId);
    logger.info(`Document opened. URI: ${document.uri}, Language ID: ${document.languageId}`);
});

documents.onDidClose((event) => {
    const uri = event.document.uri;
    documentLanguageIds.delete(uri);
    documentDescriptors.delete(uri);
    const timer = validationTimers.get(uri);
    if (timer) {
        clearTimeout(timer);
        validationTimers.delete(uri);
    }
    logger.info(`Document closed. URI: ${uri}`);
});

documents.onDidChangeContent(async (change: TextDocumentChangeEvent<TextDocument>) => {
    try {
        const document = change.document;
        const uri = document.uri;
        const version = document.version;
        const languageId = documentLanguageIds.get(uri) || document.languageId;
        logger.info(`Document changed. URI: ${uri}, Language ID: ${languageId}`);
        if (languageId === 'alps-xml' || languageId === 'alps-json') {
            const existingTimer = validationTimers.get(uri);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }
            const timer = setTimeout(async () => {
                try {
                    let diagnostics: Diagnostic[] = [];
                    if (languageId === 'alps-json') {
                        diagnostics = validateJson(document);
                    } else {
                        diagnostics = validateXML(document.getText());
                    }
                    // Add semantic warnings (broken references, naming conventions)
                    // only when the document is syntactically sound
                    if (!diagnostics.some(d => d.severity === DiagnosticSeverity.Error)) {
                        diagnostics = diagnostics.concat(validateAlpsSemantics(document, languageId));
                    }
                    const immediateErrors = diagnostics.filter(d => d.severity === DiagnosticSeverity.Error);
                    connection.sendDiagnostics({ uri, diagnostics: immediateErrors });

                    // Only send full diagnostics if document hasn't changed
                    const currentDoc = documents.get(uri);
                    if (currentDoc && currentDoc.version === version) {
                        connection.sendDiagnostics({ uri, diagnostics });
                    }

                    const descriptors = await parseAlpsProfile(document.getText(), languageId);
                    documentDescriptors.set(uri, descriptors);
                    logger.info(`Updated ${descriptors.length} descriptors for ${uri}`);
                } catch (error) {
                    logger.error(`Error in validation timer: ${getErrorMessage(error)}`);
                    connection.sendDiagnostics({ uri, diagnostics: [] });
                } finally {
                    validationTimers.delete(uri);
                }
            }, 500);
            validationTimers.set(uri, timer);
        }
    } catch (error) {
        logger.error(`Error in onDidChangeContent: ${getErrorMessage(error)}`);
    }
});

connection.onCompletion((params: TextDocumentPositionParams & { context?: { triggerKind: CompletionTriggerKind, triggerCharacter?: string } }): CompletionList => {
    try {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return CompletionList.create();
        }

        const languageId = documentLanguageIds.get(document.uri) || document.languageId;
        const descriptors = documentDescriptors.get(params.textDocument.uri) || [];

        if (languageId === 'alps-json') {
            const completions = provideJsonCompletionItems(document, params, descriptors);
            logger.info(`Provided ${completions.items?.length || 0} JSON completions`);
            return completions;
        } else if (languageId === 'alps-xml') {
            const completions = provideCompletionItems(params, documents, descriptors);
            logger.info(`Provided ${completions.items?.length || 0} XML completions`);
            return completions;
        } else {
            return CompletionList.create();
        }
    } catch (error) {
        logger.error(`Error in onCompletion: ${getErrorMessage(error)}`);
        return CompletionList.create();
    }
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    if (item.kind === CompletionItemKind.Property) {
        item.detail = `ALPS property: ${item.label}`;
        item.documentation = `This is a property in the ALPS specification for ${item.label}.`;
    } else if (item.kind === CompletionItemKind.Snippet) {
        item.detail = `ALPS snippet: ${item.label}`;
        item.documentation = `This snippet provides a template for ${item.label} in ALPS.`;
    }
    logger.info(`Completion item resolved: ${JSON.stringify(item)}`);
    return item;
});

connection.onDefinition((params: DefinitionParams): Location | Location[] | null => {
    try {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            logger.warn('No document found for definition request');
            return null;
        }

        const languageId = documentLanguageIds.get(document.uri) || document.languageId;
        const offset = document.offsetAt(params.position);
        const text = document.getText();

        // Find the href reference at the cursor position
        let hrefId: string | null = null;

        if (languageId === 'alps-json') {
            // JSON format: look for "href": "#id" pattern
            const lineText = document.getText({
                start: { line: params.position.line, character: 0 },
                end: { line: params.position.line + 1, character: 0 }
            });
            const hrefMatch = lineText.match(/"href"\s*:\s*"#([^"]+)"/);
            if (hrefMatch) {
                hrefId = hrefMatch[1];
            }
        } else if (languageId === 'alps-xml') {
            // XML format: look for href="#id" pattern
            const beforeText = text.slice(Math.max(0, offset - 100), offset);
            const afterText = text.slice(offset, Math.min(text.length, offset + 100));
            const contextText = beforeText + afterText;
            const hrefMatch = contextText.match(/href\s*=\s*["']#([^"']+)["']/);
            if (hrefMatch) {
                hrefId = hrefMatch[1];
            }
        }

        if (!hrefId) {
            logger.info('No href reference found at cursor position');
            return null;
        }

        logger.info(`Looking for definition of descriptor: ${hrefId}`);

        // Find the descriptor definition
        const descriptors = documentDescriptors.get(params.textDocument.uri) || [];
        const descriptor = descriptors.find(d => d.id === hrefId);
        if (!descriptor) {
            logger.warn(`Descriptor not found: ${hrefId}`);
            return null;
        }

        if (descriptor.line === undefined || descriptor.column === undefined) {
            logger.warn(`Descriptor position not available: ${hrefId}`);
            return null;
        }

        logger.info(`Found descriptor at line ${descriptor.line}, column ${descriptor.column}`);

        // Return the location of the definition
        return Location.create(
            params.textDocument.uri,
            Range.create(
                Position.create(descriptor.line, descriptor.column),
                Position.create(descriptor.line, descriptor.column + hrefId.length)
            )
        );
    } catch (error) {
        logger.error(`Error in onDefinition: ${getErrorMessage(error)}`);
        return null;
    }
});

connection.onReferences((params: ReferenceParams): Location[] => {
    try {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            logger.warn('No document found for references request');
            return [];
        }

        const languageId = documentLanguageIds.get(document.uri) || document.languageId;
        const text = document.getText();
        const offset = document.offsetAt(params.position);

        // Find the descriptor id at the cursor position
        let descriptorId: string | null = null;

        if (languageId === 'alps-json') {
            // JSON format: look for "id": "value" pattern
            const lineText = document.getText({
                start: { line: params.position.line, character: 0 },
                end: { line: params.position.line + 1, character: 0 }
            });
            const idMatch = lineText.match(/"id"\s*:\s*"([^"]+)"/);
            if (idMatch) {
                descriptorId = idMatch[1];
            }
        } else if (languageId === 'alps-xml') {
            // XML format: look for id="value" pattern
            const beforeText = text.slice(Math.max(0, offset - 100), offset);
            const afterText = text.slice(offset, Math.min(text.length, offset + 100));
            const contextText = beforeText + afterText;
            const idMatch = contextText.match(/id\s*=\s*["']([^"']+)["']/);
            if (idMatch) {
                descriptorId = idMatch[1];
            }
        }

        if (!descriptorId) {
            logger.info('No descriptor id found at cursor position');
            return [];
        }

        logger.info(`Looking for references to descriptor: ${descriptorId}`);

        // Find all references to this descriptor
        const descriptors = documentDescriptors.get(params.textDocument.uri) || [];
        const locations: Location[] = [];
        const lines = text.split('\n');

        lines.forEach((line, lineIndex) => {
            let match;
            if (languageId === 'alps-json') {
                // Find all href references in JSON
                const regex = new RegExp(`"href"\\s*:\\s*"#${escapeRegExp(descriptorId)}"`, 'g');
                while ((match = regex.exec(line)) !== null) {
                    const start = match.index + line.substring(match.index).indexOf('#' + descriptorId);
                    locations.push(Location.create(
                        params.textDocument.uri,
                        Range.create(
                            Position.create(lineIndex, start + 1),
                            Position.create(lineIndex, start + 1 + descriptorId.length)
                        )
                    ));
                }
            } else if (languageId === 'alps-xml') {
                // Find all href references in XML
                const regex = new RegExp(`href\\s*=\\s*["']#${escapeRegExp(descriptorId)}["']`, 'g');
                while ((match = regex.exec(line)) !== null) {
                    const start = match.index + line.substring(match.index).indexOf('#' + descriptorId);
                    locations.push(Location.create(
                        params.textDocument.uri,
                        Range.create(
                            Position.create(lineIndex, start + 1),
                            Position.create(lineIndex, start + 1 + descriptorId.length)
                        )
                    ));
                }
            }
        });

        // Include the definition itself if requested
        if (params.context?.includeDeclaration) {
            const descriptor = descriptors.find(d => d.id === descriptorId);
            if (descriptor && descriptor.line !== undefined && descriptor.column !== undefined) {
                locations.unshift(Location.create(
                    params.textDocument.uri,
                    Range.create(
                        Position.create(descriptor.line, descriptor.column),
                        Position.create(descriptor.line, descriptor.column + descriptorId.length)
                    )
                ));
            }
        }

        logger.info(`Found ${locations.length} references to ${descriptorId}`);
        return locations;
    } catch (error) {
        logger.error(`Error in onReferences: ${getErrorMessage(error)}`);
        return [];
    }
});

connection.onHover((params: HoverParams): Hover | null => {
    try {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            logger.warn('No document found for hover request');
            return null;
        }

        const languageId = documentLanguageIds.get(document.uri) || document.languageId;
        const text = document.getText();
        const offset = document.offsetAt(params.position);

        // Find the descriptor id or href at the cursor position
        let descriptorId: string | null = null;
        let isReference = false;

        if (languageId === 'alps-json') {
            const lineText = document.getText({
                start: { line: params.position.line, character: 0 },
                end: { line: params.position.line + 1, character: 0 }
            });

            // Check for href reference
            const hrefMatch = lineText.match(/"href"\s*:\s*"#([^"]+)"/);
            if (hrefMatch) {
                descriptorId = hrefMatch[1];
                isReference = true;
            } else {
                // Check for id definition
                const idMatch = lineText.match(/"id"\s*:\s*"([^"]+)"/);
                if (idMatch) {
                    descriptorId = idMatch[1];
                }
            }
        } else if (languageId === 'alps-xml') {
            const beforeText = text.slice(Math.max(0, offset - 100), offset);
            const afterText = text.slice(offset, Math.min(text.length, offset + 100));
            const contextText = beforeText + afterText;

            // Check for href reference
            const hrefMatch = contextText.match(/href\s*=\s*["']#([^"']+)["']/);
            if (hrefMatch) {
                descriptorId = hrefMatch[1];
                isReference = true;
            } else {
                // Check for id definition
                const idMatch = contextText.match(/id\s*=\s*["']([^"']+)["']/);
                if (idMatch) {
                    descriptorId = idMatch[1];
                }
            }
        }

        if (!descriptorId) {
            return null;
        }

        // Find the descriptor
        const descriptors = documentDescriptors.get(params.textDocument.uri) || [];
        const descriptor = descriptors.find(d => d.id === descriptorId);
        if (!descriptor) {
            return null;
        }

        // Build hover content
        let content = `**${descriptor.id}**\n\n`;

        if (descriptor.type) {
            content += `Type: \`${descriptor.type}\`\n\n`;
        }

        if (descriptor.doc) {
            content += `${descriptor.doc}\n\n`;
        }

        if (descriptor.href) {
            content += `Href: \`${descriptor.href}\`\n\n`;
        }

        if (isReference) {
            content += `_Click to go to definition_`;
        }

        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: content
            }
        };
    } catch (error) {
        logger.error(`Error in onHover: ${getErrorMessage(error)}`);
        return null;
    }
});

connection.onDocumentSymbol((params: DocumentSymbolParams): DocumentSymbol[] => {
    try {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            logger.warn('No document found for document symbols request');
            return [];
        }

        const descriptors = documentDescriptors.get(params.textDocument.uri) || [];
        logger.info(`Providing document symbols. Found ${descriptors.length} descriptors`);

        // Convert descriptors to document symbols
        const symbols: DocumentSymbol[] = descriptors
            .filter(descriptor => descriptor.line !== undefined && descriptor.column !== undefined)
            .map(descriptor => {
                const startPos = Position.create(descriptor.line!, descriptor.column!);
                const endPos = Position.create(descriptor.line!, descriptor.column! + descriptor.id.length);

                // Determine symbol kind based on descriptor type
                let kind: SymbolKind = SymbolKind.Property;
                if (descriptor.type === 'semantic') {
                    kind = SymbolKind.Class;
                } else if (descriptor.type === 'safe' || descriptor.type === 'unsafe' || descriptor.type === 'idempotent') {
                    kind = SymbolKind.Method;
                }

                // Build detail string
                let detail = descriptor.type || 'descriptor';
                if (descriptor.href) {
                    detail += ` → ${descriptor.href}`;
                }

                return DocumentSymbol.create(
                    descriptor.id,
                    detail,
                    kind,
                    Range.create(startPos, endPos),
                    Range.create(startPos, endPos)
                );
            });

        return symbols;
    } catch (error) {
        logger.error(`Error in onDocumentSymbol: ${getErrorMessage(error)}`);
        return [];
    }
});

connection.onRenameRequest((params: RenameParams): WorkspaceEdit | null => {
    try {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            logger.warn('No document found for rename request');
            return null;
        }

        const languageId = documentLanguageIds.get(document.uri) || document.languageId;
        const text = document.getText();
        const offset = document.offsetAt(params.position);

        // Find the descriptor id at the cursor position
        let descriptorId: string | null = null;

        if (languageId === 'alps-json') {
            const lineText = document.getText({
                start: { line: params.position.line, character: 0 },
                end: { line: params.position.line + 1, character: 0 }
            });

            // Check for id definition
            const idMatch = lineText.match(/"id"\s*:\s*"([^"]+)"/);
            if (idMatch) {
                descriptorId = idMatch[1];
            } else {
                // Check for href reference
                const hrefMatch = lineText.match(/"href"\s*:\s*"#([^"]+)"/);
                if (hrefMatch) {
                    descriptorId = hrefMatch[1];
                }
            }
        } else if (languageId === 'alps-xml') {
            const beforeText = text.slice(Math.max(0, offset - 100), offset);
            const afterText = text.slice(offset, Math.min(text.length, offset + 100));
            const contextText = beforeText + afterText;

            // Check for id definition
            const idMatch = contextText.match(/id\s*=\s*["']([^"']+)["']/);
            if (idMatch) {
                descriptorId = idMatch[1];
            } else {
                // Check for href reference
                const hrefMatch = contextText.match(/href\s*=\s*["']#([^"']+)["']/);
                if (hrefMatch) {
                    descriptorId = hrefMatch[1];
                }
            }
        }

        if (!descriptorId) {
            logger.info('No descriptor id found at cursor position for rename');
            return null;
        }

        logger.info(`Renaming descriptor: ${descriptorId} to ${params.newName}`);

        // Collect all edits (definition + references)
        const descriptors = documentDescriptors.get(params.textDocument.uri) || [];
        const edits: TextEdit[] = computeRenameEdits(document, languageId, descriptors, descriptorId, params.newName);

        logger.info(`Found ${edits.length} locations to rename`);

        // Return workspace edit
        return {
            changes: {
                [params.textDocument.uri]: edits
            }
        };
    } catch (error) {
        logger.error(`Error in onRenameRequest: ${getErrorMessage(error)}`);
        return null;
    }
});

connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
    try {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            logger.warn('No document found for code action request');
            return [];
        }

        const languageId = documentLanguageIds.get(document.uri) || document.languageId;
        if (languageId !== 'alps-json' && languageId !== 'alps-xml') {
            return [];
        }

        const descriptors = documentDescriptors.get(params.textDocument.uri) || [];
        const actions = provideCodeActions(document, languageId, params.context.diagnostics, descriptors);
        logger.info(`Provided ${actions.length} code actions`);
        return actions;
    } catch (error) {
        logger.error(`Error in onCodeAction: ${getErrorMessage(error)}`);
        return [];
    }
});

connection.onDocumentFormatting((params: DocumentFormattingParams): TextEdit[] => {
    try {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            logger.warn('No document found for formatting request');
            return [];
        }

        const languageId = documentLanguageIds.get(document.uri) || document.languageId;
        if (languageId !== 'alps-json' && languageId !== 'alps-xml') {
            return [];
        }

        const edits = formatDocument(document, languageId, params.options);
        logger.info(`Provided ${edits.length} formatting edits`);
        return edits;
    } catch (error) {
        logger.error(`Error in onDocumentFormatting: ${getErrorMessage(error)}`);
        return [];
    }
});

connection.languages.semanticTokens.on((params) => {
    try {
        const document = documents.get(params.textDocument.uri);
        if (!document) {
            logger.warn('No document found for semantic tokens request');
            return { data: [] };
        }

        const languageId = documentLanguageIds.get(document.uri) || document.languageId;
        if (languageId !== 'alps-json' && languageId !== 'alps-xml') {
            return { data: [] };
        }

        return buildSemanticTokens(document, languageId);
    } catch (error) {
        logger.error(`Error in semanticTokens: ${getErrorMessage(error)}`);
        return { data: [] };
    }
});

documents.listen(connection);
connection.listen();
logger.info('ALPS Language Server is running');
