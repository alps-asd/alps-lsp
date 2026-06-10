import { WebSocketServer, WebSocket, RawData } from 'ws';
import {
    AbstractMessageReader,
    AbstractMessageWriter,
    createConnection,
    DataCallback,
    Disposable,
    Message,
    MessageReader,
    MessageWriter
} from 'vscode-languageserver/node';
import { startServer } from './server';

/**
 * Bridges incoming WebSocket frames to LSP messages. Each frame is expected
 * to carry one complete JSON-RPC message (no Content-Length framing).
 */
class WebSocketMessageReader extends AbstractMessageReader implements MessageReader {
    private callback: DataCallback | undefined;
    private pending: Message[] = [];

    constructor(socket: WebSocket) {
        super();
        socket.on('message', (data: RawData) => {
            try {
                const message = JSON.parse(data.toString()) as Message;
                if (this.callback) {
                    this.callback(message);
                } else {
                    // Buffer messages that arrive before the connection starts listening
                    this.pending.push(message);
                }
            } catch (error) {
                this.fireError(error);
            }
        });
        socket.on('error', (error) => this.fireError(error));
        socket.on('close', () => this.fireClose());
    }

    listen(callback: DataCallback): Disposable {
        this.callback = callback;
        for (const message of this.pending) {
            callback(message);
        }
        this.pending = [];
        return Disposable.create(() => {
            this.callback = undefined;
        });
    }
}

/** Writes each LSP message as one JSON-encoded WebSocket frame. */
class WebSocketMessageWriter extends AbstractMessageWriter implements MessageWriter {
    constructor(private readonly socket: WebSocket) {
        super();
    }

    write(message: Message): Promise<void> {
        return new Promise((resolve, reject) => {
            this.socket.send(JSON.stringify(message), (error) => {
                if (error) {
                    this.fireError(error);
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    end(): void {
        // Socket shutdown is handled by the WebSocket server
    }
}

/**
 * Starts a WebSocket server that bridges browser editors to the ALPS LSP.
 * Each WebSocket connection gets its own language server instance.
 * Pass port 0 to listen on an ephemeral port (see server.address()).
 */
export function startWebSocketServer(port: number): WebSocketServer {
    const webSocketServer = new WebSocketServer({ port });
    webSocketServer.on('connection', (socket: WebSocket) => {
        const reader = new WebSocketMessageReader(socket);
        const writer = new WebSocketMessageWriter(socket);
        const connection = createConnection(reader, writer);
        startServer(connection);
    });
    return webSocketServer;
}
