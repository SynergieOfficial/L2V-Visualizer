// lib/dmx-protocol/sacnReceiver.js
const dgram = require('dgram');
const BaseReceiver = require('./baseReceiver');

/**
 * sACN Receiver: one multicast socket per universe.
 * Emits `data` events: { universe, channels }
 */
class SACNReceiver extends BaseReceiver {
  constructor(settings) {
    super(settings);
    this.port     = settings.port || 5568;
    this.nic      = settings.nic;
    this.universes = settings.universes || [];
    this.sockets  = {};  // map universe → socket
  }

  start() {
    this.universes.forEach(u => {
      const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      sock.on('error', err => {
        console.error(`[sACN] UDP socket error on U${u}:`, err);
      });

      sock.bind({ port: this.port, exclusive: false }, () => {
        const mcast = `239.255.${(u >> 8) & 0xff}.${u & 0xff}`;
        sock.addMembership(mcast, this.nic);
        console.log(`[sACN] Joined universe ${u} → ${mcast} on NIC ${this.nic}`);
      });

      sock.on('message', packet => {
        if (packet.length < 512) {
          console.warn(`[sACN] Dropping short packet (${packet.length} bytes) on U${u}`);
          return;
        }
        // last 512 bytes are the DMX channel data
        const dmx = Array.from(packet.slice(packet.length - 512));
        this.emit('data', { universe: u, channels: dmx });
      });

      this.sockets[u] = sock;
    });
  }

  stop() {
    Object.values(this.sockets).forEach(sock => sock.close());
    this.sockets = {};
  }
}

module.exports = { SACNReceiver };