const dgram = require('dgram');
const BaseReceiver = require('./baseReceiver');

/**
 * Parse sACN packet buffer into { universe, channels }.
 * Copy your existing parseSacn implementation from server.js here.
 */
function parseSacn(buffer) {
  // … your existing parseSacn code …
  // should return an object: { universe: Number, channels: Array<Number> }
}

class SACNReceiver extends BaseReceiver {
  constructor(settings) {
    super(settings);
    this.socket = dgram.createSocket('udp4');
  }

  /** Bind & forward parsed DMX frames */
  start() {
    this.socket.on('message', (msg) => {
      const { universe, channels } = parseSacn(msg);
      this.emit('data', { universe, channels });
    });
    this.socket.bind(5568, this.settings.nic);
  }

  stop() {
    this.socket.close();
  }
}

module.exports = { SACNReceiver };