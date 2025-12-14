import * as xml2js from 'xml2js';
import * as sax from 'sax';
import { parseJson } from './jsonParser';

export interface DescriptorInfo {
    id: string;
    type: string;
    line?: number;
    column?: number;
    doc?: string;
    href?: string;
}

function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function parseAlpsProfile(content: string, languageId: string): Promise<DescriptorInfo[]> {
    if (languageId === 'alps-json') {
        return parseJsonAlpsProfile(content);
    } else {
        return parseXmlAlpsProfile(content);
    }
}

async function parseJsonAlpsProfile(content: string): Promise<DescriptorInfo[]> {
    try {
        const jsonContent = parseJson(content) as any;
        const raw = jsonContent?.alps?.descriptor;
        const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
        const lines = content.split('\n');

        const descriptors: DescriptorInfo[] = [];

        list.forEach((desc: any) => {
            if (!desc?.id) return;

            // Find line and column position
            let line = -1;
            let column = -1;
            for (let i = 0; i < lines.length; i++) {
                const idMatch = lines[i].match(new RegExp(`"id"\\s*:\\s*"${escapeRegExp(desc.id)}"`));
                if (idMatch && idMatch.index !== undefined) {
                    line = i;
                    column = idMatch.index;
                    break;
                }
            }

            descriptors.push({
                id: desc.id,
                type: desc.type || 'semantic',
                line: line >= 0 ? line : undefined,
                column: column >= 0 ? column : undefined,
                doc: desc.doc,
                href: desc.href
            });
        });

        return descriptors;
    } catch (err) {
        return [];
    }
}

async function parseXmlAlpsProfile(content: string): Promise<DescriptorInfo[]> {
    try {
        const result = await xml2js.parseStringPromise(content, { strict: true });
        const raw = result?.alps?.descriptor;
        const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
        const lines = content.split('\n');

        const descriptors: DescriptorInfo[] = list
            .map((desc: any) => {
                const id = desc?.$?.id;
                if (!id) return null;

                // Find line and column position
                let line = -1;
                let column = -1;
                for (let i = 0; i < lines.length; i++) {
                    const idMatch = lines[i].match(new RegExp(`id\\s*=\\s*["']${escapeRegExp(id)}["']`));
                    if (idMatch && idMatch.index !== undefined) {
                        line = i;
                        column = idMatch.index;
                        break;
                    }
                }

                return {
                    id,
                    type: desc?.$?.type || 'semantic',
                    line: line >= 0 ? line : undefined,
                    column: column >= 0 ? column : undefined,
                    doc: desc.doc?.[0]?._,
                    href: desc?.$?.href
                };
            })
            .filter((d: any) => d !== null) as DescriptorInfo[];

        if (descriptors.length > 0) {
            return descriptors;
        }
        return await extractDescriptors(content);
    } catch (err) {
        return await extractDescriptors(content);
    }
}

function extractDescriptors(content: string): Promise<DescriptorInfo[]> {
    return new Promise((resolve) => {
        const parser = sax.parser(true);
        const descriptors: DescriptorInfo[] = [];
        const lines = content.split('\n');
        let currentDoc: string | undefined;
        let insideDoc = false;
        let currentDescriptor: Partial<DescriptorInfo> | undefined;

        parser.onopentag = (node) => {
            if (node.name === 'descriptor') {
                const id = node.attributes.id as string;
                const type = (node.attributes.type as string) || 'semantic';
                const href = node.attributes.href as string;

                if (id) {
                    // Find line and column position
                    let line = -1;
                    let column = -1;

                    for (let i = 0; i < lines.length; i++) {
                        const idMatch = lines[i].match(new RegExp(`id\\s*=\\s*["']${escapeRegExp(id)}["']`));
                        if (idMatch && idMatch.index !== undefined) {
                            line = i;
                            column = idMatch.index;
                            break;
                        }
                    }

                    currentDescriptor = {
                        id,
                        type,
                        line: line >= 0 ? line : undefined,
                        column: column >= 0 ? column : undefined,
                        href
                    };
                }
            } else if (node.name === 'doc') {
                insideDoc = true;
                currentDoc = undefined; // Reset before capturing doc text
            }
        };

        parser.onclosetag = (tagName) => {
            if (tagName === 'doc') {
                insideDoc = false;
            } else if (tagName === 'descriptor' && currentDescriptor) {
                currentDescriptor.doc = currentDoc;
                descriptors.push(currentDescriptor as DescriptorInfo);
                currentDescriptor = undefined;
                currentDoc = undefined;
            }
        };

        parser.ontext = (text) => {
            if (insideDoc && text.trim()) {
                currentDoc = text.trim();
            }
        };

        parser.onend = () => {
            resolve(descriptors);
        };

        parser.onerror = () => {
            parser.resume();
        };

        parser.write(content).close();
    });
}
