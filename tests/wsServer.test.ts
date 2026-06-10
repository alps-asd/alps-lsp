import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AddressInfo } from 'net';
import WebSocket, { WebSocketServer } from 'ws';
import { startWebSocketServer } from '../src/wsServer';

interface JsonRpcMessage {
    jsonrpc: string;
    id?: number;
    method?: string;
    result?: {
        capabilities?: Record<string, unknown>;
    };
}

function openSocket(port: number): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(`ws://127.0.0.1:${port}`);
        socket.on('open', () => resolve(socket));
        socket.on('error', reject);
    });
}

/** Sends a request and resolves with the response carrying the same id. */
function sendRequest(socket: WebSocket, id: number, method: string, params: unknown): Promise<JsonRpcMessage> {
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            clearTimeout(timer);
            socket.off('message', onMessage);
            socket.off('error', onError);
            socket.off('close', onClose);
        };
        const fail = (error: Error) => {
            cleanup();
            reject(error);
        };
        const timer = setTimeout(() => fail(new Error(`Timed out waiting for response to ${method}`)), 5000);
        const onMessage = (data: WebSocket.RawData) => {
            const message = JSON.parse(data.toString()) as JsonRpcMessage;
            // Skip server notifications (e.g. window/logMessage)
            if (message.id === id) {
                cleanup();
                resolve(message);
            }
        };
        const onError = (error: Error) => fail(error);
        const onClose = () => fail(new Error(`Socket closed before response to ${method}`));
        socket.on('message', onMessage);
        socket.on('error', onError);
        socket.on('close', onClose);
        socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
}

describe('wsServer', () => {
    let server: WebSocketServer;
    let port: number;

    beforeAll(async () => {
        server = startWebSocketServer(0); // ephemeral port
        await new Promise<void>((resolve) => server.on('listening', () => resolve()));
        port = (server.address() as AddressInfo).port;
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('should bind to localhost only', () => {
        expect((server.address() as AddressInfo).address).toBe('127.0.0.1');
    });

    it('should respond to an LSP initialize request', async () => {
        const socket = await openSocket(port);
        try {
            const response = await sendRequest(socket, 1, 'initialize', {
                processId: null,
                rootUri: null,
                capabilities: {}
            });

            expect(response.id).toBe(1);
            expect(response.result?.capabilities).toBeDefined();
            expect(response.result?.capabilities).toMatchObject({
                definitionProvider: true,
                documentFormattingProvider: true
            });
        } finally {
            socket.close();
        }
    });

    it('should serve multiple connections independently', async () => {
        const socketA = await openSocket(port);
        const socketB = await openSocket(port);
        try {
            const [responseA, responseB] = await Promise.all([
                sendRequest(socketA, 11, 'initialize', { processId: null, rootUri: null, capabilities: {} }),
                sendRequest(socketB, 22, 'initialize', { processId: null, rootUri: null, capabilities: {} })
            ]);

            expect(responseA.id).toBe(11);
            expect(responseA.result?.capabilities).toBeDefined();
            expect(responseB.id).toBe(22);
            expect(responseB.result?.capabilities).toBeDefined();
        } finally {
            socketA.close();
            socketB.close();
        }
    });
});
