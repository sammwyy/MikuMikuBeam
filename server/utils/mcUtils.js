// Adapted from: https://github.com/Cryptkeeper/mcping-js/
import { createTcpClient } from "./clientUtils.js";

class MinecraftProtocol {
  static writeVarInt(val) {
    // "VarInts are never longer than 5 bytes"
    // https://wiki.vg/Data_types#VarInt_and_VarLong
    const buf = Buffer.alloc(5);
    let written = 0;

    while (true) {
      if ((val & 0xffffff80) === 0) {
        buf.writeUInt8(val, written++);
        break;
      } else {
        buf.writeUInt8((val & 0x7f) | 0x80, written++);
        val >>>= 7;
      }
    }

    return buf.slice(0, written);
  }

  static writeString(val) {
    return Buffer.from(val, "UTF-8");
  }

  static writeUShort(val) {
    return Buffer.from([val >> 8, val & 0xff]);
  }

  static concat(chunks) {
    let length = 0;

    for (const chunk of chunks) {
      length += chunk.length;
    }

    const buf = [MinecraftProtocol.writeVarInt(length), ...chunks];

    return Buffer.concat(buf);
  }
}

class MinecraftBufferReader {
  constructor(buffer) {
    this._buffer = buffer;
    this._offset = 0;
  }

  readVarInt() {
    let val = 0;
    let count = 0;

    while (true) {
      const b = this._buffer.readUInt8(this._offset++);

      val |= (b & 0x7f) << (count++ * 7);

      if ((b & 0x80) != 128) {
        break;
      }
    }

    return val;
  }

  readString() {
    const length = this.readVarInt();
    const val = this._buffer.toString(
      "UTF-8",
      this._offset,
      this._offset + length
    );

    // Advance the reader index forward by the string length
    this._offset += length;

    return val;
  }

  offset() {
    return this._offset;
  }
}

export function pingMinecraftServer(host, port, proxy) {
  return new Promise((resolve, reject) => {
    const socket = createTcpClient(proxy, { host, port });

    const timeoutTask = setTimeout(() => {
      socket.emit("error", new Error("Socket timeout"));
    }, 5000);

    const closeSocket = () => {
      socket.destroy();
      clearTimeout(timeoutTask);
    };

    let didFireError = false;

    const handleErr = (err) => {
      closeSocket();
      if (!didFireError) {
        didFireError = true;
        reject(err);
      }
    };

    socket.setNoDelay(true);

    socket.on("connect", () => {
      const handshake = MinecraftProtocol.concat([
        MinecraftProtocol.writeVarInt(0),
        MinecraftProtocol.writeVarInt(340),
        MinecraftProtocol.writeVarInt(host.length),
        MinecraftProtocol.writeString(host),
        MinecraftProtocol.writeUShort(port),
        MinecraftProtocol.writeVarInt(1),
      ]);

      socket.write(handshake);

      const request = MinecraftProtocol.concat([
        MinecraftProtocol.writeVarInt(0),
      ]);

      socket.write(request);
    });

    let incomingBuffer = Buffer.alloc(0);

    socket.on("data", (data) => {
      incomingBuffer = Buffer.concat([incomingBuffer, data]);

      if (incomingBuffer.length < 5) {
        return;
      }

      const bufferReader = new MinecraftBufferReader(incomingBuffer);
      const length = bufferReader.readVarInt();

      if (incomingBuffer.length - bufferReader.offset() < length) {
        return;
      }

      const id = bufferReader.readVarInt();

      if (id === 0) {
        const reply = bufferReader.readString();

        try {
          const message = JSON.parse(reply);
          resolve(message);
          closeSocket();
        } catch (err) {
          handleErr(err);
        }
      } else {
        handleErr(new Error("Received unexpected packet"));
      }
    });

    socket.on("error", handleErr);
  });
}
