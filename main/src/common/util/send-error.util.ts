import { HttpException, type ArgumentsHost } from "@nestjs/common";

export async function sendError(host: ArgumentsHost, resObj: any, originalError: unknown): Promise<any> {
    const contextType = host.getType();

    switch (contextType) {
        case "http": {
            const http = host.switchToHttp();
            const res = http.getResponse();
            const status = originalError instanceof HttpException ? originalError.getStatus() : 500;
            res.status(status).send(resObj);
            break;
        }
        case "rpc":
            const rxjs = await import("rxjs");
            return rxjs.throwError(() => resObj);
        case "ws":
            const ws = host.switchToWs();
            const client = ws.getClient();
            client.emit("error", resObj);
            break;
    }
}
