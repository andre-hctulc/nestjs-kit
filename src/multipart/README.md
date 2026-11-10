# Multipart decorators

NestJS parameter decorators for [`@fastify/multipart`](https://github.com/fastify/fastify-multipart). Register the plugin with a Fastify-backed Nest app:

```ts
await app.register(multipart);
```

| Factory | Uses | Injects |
| --- | --- | --- |
| `FilePart(options)` | `req.file()` | First `MultipartFile` or `null` |
| `FileParts(options?)` | `req.files()` | `AsyncIterableIterator<MultipartFile>` or `null` |
| `Parts(options)` | `req.parts()` | `AsyncIterableIterator<Multipart>` or `null` |

Each factory returns a parameter decorator:

```ts
const Upload = FilePart({ required: true });

@Post()
async upload(@Upload() file: MultipartFile) {
    await pipeline(file.file, createWriteStream(destination));
}
```

Consume file streams as you iterate; otherwise Fastify cannot finish parsing
the request. Use `pipeline` to stream to storage, or `await file.toBuffer()` to
load a file into memory. Avoid using an untrusted filename as a storage path.

All factories accept Fastify multipart/Busboy options, including `limits`.
`required: true` rejects non-multipart requests; for `FilePart` it also rejects
requests with no file. For `FileParts` and `Parts`, it only requires a
multipart request. Otherwise, each returns `null` for a non-multipart request.

`Parts` yields field and file parts; discriminate using `part.type`:

```ts
const UploadParts = Parts({ limits: { fileSize: 5 * 1024 * 1024 } });

@Post()
async upload(@UploadParts() parts: AsyncIterableIterator<Multipart> | null) {
    if (!parts) return;

    for await (const part of parts) {
        if (part.type === "file") {
            await pipeline(part.file, createWriteStream(destination));
        } else {
            console.log(part.fieldname, part.value);
        }
    }
}
```
