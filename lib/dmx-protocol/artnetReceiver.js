// lib/dmx-protocol/artnetReceiver.js
const dgram = require('dgram');
const BaseReceiver = require('./baseReceiver');

/**
 * Art-Net OpDmx listener.
 * Emits `data` events: { universe, channels }.
 */
class ArtNetReceiver extends BaseReceiver {
  constructor(settings) {
    super(settings);
    this.port   = settings.port || 6454;
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  }

  start() {
    this.socket.on('error', err => {
      console.error('[Art-Net] UDP socket error:', err);
    });

    // Bind on all interfaces
    this.socket.bind(this.port, () => {
      console.log(`[Art-Net] Listening on 0.0.0.0:${this.port}`);
    });

    this.socket.on('message', packet => {
      // 1) Check the ASCII header "Art-Net\0"
      const header = packet.toString('ascii', 0, 7);
      if (header !== 'Art-Net\0'.slice(0,7)) return;

      // 2) OpCode is at bytes 8–9, little-endian
      const opcode = packet.readUInt16LE(8);
      if (opcode !== 0x5000) return; // not OpDmx

      // 3) Universe at bytes 14–15, little-endian
      const universe = packet.readUInt16LE(14);

      // 4) Data length at bytes 16–17, big-endian
      const length = packet.readUInt16BE(16);
      if (packet.length < 18 + length) {
        console.warn(`[Art-Net] Dropping short frame (len=${packet.length})`);
        return;
      }

      // 5) Extract DMX channels
      const channels = Array.from(packet.slice(18, 18 + length));

      // 6) Emit for setupReceivers() to broadcast
      this.emit('data', { universe, channels });
    });
  }

  stop() {
    this.socket.close();
  }
}

module.exports = { ArtNetReceiver };