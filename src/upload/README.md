# upload

## Raw uploads

Import `UploadModule` and decorate upload handlers with `@RawUpload({ maxSize })`
from `@dre44/nestjs-kit/upload`. `@Body()` receives a Node `Readable`, including
for empty uploads. `maxSize` is a non-negative byte limit applied per route;
both declared length and actual streamed bytes are checked. Upload content
types (including JSON and text) are passed through as bytes, not parsed.
Ordinary routes retain JSON/text parsing and their body-size limits.

```ts
@Post("file")
@RawUpload({ maxSize: 10 * 1024 * 1024 })
async upload(@Body() file: Readable) {
    try {
        await pipeline(file, destination);
        return { uploaded: true };
    } finally {
        file.destroy();
    }
}
```

Handlers must consume the stream to completion or explicitly abandon it with
`file.destroy()`, and propagate stream/storage errors to Nest's error handling.
`file.destroy()` in `finally` remains recommended: it is idempotent, releases
stream resources, and promptly stops reads on failure. It does **not** destroy
the HTTP socket. The package owns transport cleanup, including guard/validation
rejections before the handler or stream consumer runs.

Uploads stream with bounded buffering and backpressure. Fully consumed requests
retain normal HTTP keep-alive. If a response is sent while the request payload
is unread, the package stops the upload wrapper and marks the response
`Connection: close`; Node flushes the response before closing the connection.
It does not drain an unbounded rejected body or immediately reset the socket.
The handler/framework's response status and error body are preserved. Client
disconnects fail active stream consumers.

This lifecycle uses Fastify's normal request/reply hooks and HTTP/1.x connection
semantics; hijacked replies/raw socket writes and HTTP/2 are not covered.
Handlers must finish or fail their work and produce a response: destroying a
stream does not itself send an error or impose an application processing timeout.
Normal server/socket timeouts still apply to clients that stop reading responses.
Clients that continue writing after an early response may also observe a
transport error (such as `EPIPE` or `ECONNRESET`); the package does not drain an
unbounded body to prevent that. Clients should stop sending when they receive
the response and handle transport errors during an interrupted upload.
