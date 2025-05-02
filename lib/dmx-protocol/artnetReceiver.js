const dgram = require('dgram');
const BaseReceiver = require('./baseReceiver');

/**
 * Basic Art-Net OpDmx listener:
 *  - checks “Art-Net” header
 *  - filters opcode 0x5000 (OpDmx)
 *  - reads universe & channel data
 */
class ArtNetReceiver extends BaseReceiver {
  constructor(settings) {
    super(settings);
    this.socket = dgram.createSocket('udp4');
  }

  start() {
    this.socket.on('message', (msg) => {
      // “Art-Net” header starts with “Art-” (0x4174)
      if (msg.readUInt16BE(0) !== 0x4174) return;

      const opcode = msg.readUInt16LE(8);
      if (opcode !== 0x5000) return;  // not OpDmx

      const universe = msg.readUInt16LE(14);
      const length   = msg.readUInt16BE(16);
      const channels = Array.from(msg.slice(18, 18 + length));

      this.emit('data', { universe, channels });
    });
    // Art-Net default port
    this.socket.bind(6454, this.settings.nic);
  }

  stop() {
    this.socket.close();
  }
}

module.exports = { ArtNetReceiver };