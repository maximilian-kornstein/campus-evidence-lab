import { randomBytes } from "node:crypto";
import net from "node:net";

function parseWsUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "ws:") throw new Error(`Only local ws:// DevTools URLs are supported, got ${value}`);
  return {
    host: url.hostname,
    port: Number(url.port || 80),
    path: `${url.pathname}${url.search}`
  };
}

function frameText(payload) {
  const data = Buffer.from(payload);
  const mask = randomBytes(4);
  const headerLength = data.length < 126 ? 6 : data.length <= 0xffff ? 8 : 14;
  const frame = Buffer.alloc(headerLength + data.length);
  frame[0] = 0x81;
  if (data.length < 126) {
    frame[1] = 0x80 | data.length;
    mask.copy(frame, 2);
    for (let index = 0; index < data.length; index += 1) frame[6 + index] = data[index] ^ mask[index % 4];
    return frame;
  }
  if (data.length <= 0xffff) {
    frame[1] = 0x80 | 126;
    frame.writeUInt16BE(data.length, 2);
    mask.copy(frame, 4);
    for (let index = 0; index < data.length; index += 1) frame[8 + index] = data[index] ^ mask[index % 4];
    return frame;
  }
  frame[1] = 0x80 | 127;
  frame.writeBigUInt64BE(BigInt(data.length), 2);
  mask.copy(frame, 10);
  for (let index = 0; index < data.length; index += 1) frame[14 + index] = data[index] ^ mask[index % 4];
  return frame;
}

function parseFrames(buffer) {
  const messages = [];
  let offset = 0;

  while (buffer.length - offset >= 2) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    let length = second & 0x7f;
    let headerLength = 2;

    if (length === 126) {
      if (buffer.length - offset < 4) break;
      length = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127) {
      if (buffer.length - offset < 10) break;
      length = Number(buffer.readBigUInt64BE(offset + 2));
      headerLength = 10;
    }

    const masked = Boolean(second & 0x80);
    const maskLength = masked ? 4 : 0;
    const frameLength = headerLength + maskLength + length;
    if (buffer.length - offset < frameLength) break;

    const payloadStart = offset + headerLength + maskLength;
    const payload = Buffer.from(buffer.subarray(payloadStart, payloadStart + length));
    if (masked) {
      const mask = buffer.subarray(offset + headerLength, offset + headerLength + 4);
      for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
    }

    if (opcode === 0x1) messages.push(payload.toString("utf8"));
    offset += frameLength;
  }

  return {
    messages,
    remaining: buffer.subarray(offset)
  };
}

export class ChromeDevToolsClient {
  constructor(webSocketDebuggerUrl) {
    this.webSocketDebuggerUrl = webSocketDebuggerUrl;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    const { host, port, path } = parseWsUrl(this.webSocketDebuggerUrl);
    const key = randomBytes(16).toString("base64");
    this.socket = net.createConnection({ host, port });

    await new Promise((resolve, reject) => {
      this.socket.once("connect", resolve);
      this.socket.once("error", reject);
    });

    this.socket.write(
      [
        `GET ${path} HTTP/1.1`,
        `Host: ${host}:${port}`,
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Key: ${key}`,
        "Sec-WebSocket-Version: 13",
        "\r\n"
      ].join("\r\n")
    );

    await new Promise((resolve, reject) => {
      let handshake = Buffer.alloc(0);
      const onData = (chunk) => {
        handshake = Buffer.concat([handshake, chunk]);
        const headerEnd = handshake.indexOf("\r\n\r\n");
        if (headerEnd === -1) return;
        this.socket.off("data", onData);
        const header = handshake.subarray(0, headerEnd).toString("utf8");
        if (!/^HTTP\/1\.1 101\b/.test(header)) {
          reject(new Error(`DevTools WebSocket handshake failed: ${header.split("\r\n")[0]}`));
          return;
        }
        const rest = handshake.subarray(headerEnd + 4);
        if (rest.length) this.handleData(rest);
        resolve();
      };
      this.socket.on("data", onData);
      this.socket.once("error", reject);
    });

    this.socket.on("data", (chunk) => this.handleData(chunk));
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const parsed = parseFrames(this.buffer);
    this.buffer = parsed.remaining;
    for (const message of parsed.messages) {
      const payload = JSON.parse(message);
      if (!payload.id) continue;
      const pending = this.pending.get(payload.id);
      if (!pending) continue;
      this.pending.delete(payload.id);
      if (payload.error) pending.reject(new Error(payload.error.message ?? JSON.stringify(payload.error)));
      else pending.resolve(payload);
    }
  }

  call(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const message = JSON.stringify({ id, method, params });
    this.socket.write(frameText(message));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  async evaluate(expression) {
    const response = await this.call("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (response.result?.exceptionDetails) {
      const details = response.result.exceptionDetails;
      throw new Error(
        [
          details.text ?? "Runtime.evaluate failed",
          details.exception?.description,
          details.exception?.value,
          details.stackTrace?.callFrames
            ?.map((frame) => `${frame.functionName || "(anonymous)"}@${frame.url || "eval"}:${frame.lineNumber}:${frame.columnNumber}`)
            .join("\n")
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
    return response.result?.result?.value;
  }

  close() {
    this.socket?.end();
  }
}

export async function createChromeTarget(remoteDebuggingUrl, url) {
  const endpoint = `${remoteDebuggingUrl.replace(/\/$/, "")}/json/new?${encodeURIComponent(url)}`;
  const response = await fetch(endpoint, { method: "PUT" });
  if (!response.ok) throw new Error(`Could not create Chrome target: HTTP ${response.status}`);
  return response.json();
}

export async function closeChromeTarget(remoteDebuggingUrl, targetId) {
  const endpoint = `${remoteDebuggingUrl.replace(/\/$/, "")}/json/close/${targetId}`;
  await fetch(endpoint).catch(() => {});
}
