const EventEmitter = require('events');

class BaseReceiver extends EventEmitter {
  /**
   * @param {object} settings  includes at least `.nic` (string) and other protocol options
   */
  constructor(settings) {
    super();
    this.settings = settings;
  }

  /** Start listening — must be implemented by subclasses */
  start() {
    throw new Error('start() not implemented');
  }

  /** Stop listening — must be implemented by subclasses */
  stop() {
    throw new Error('stop() not implemented');
  }
}

module.exports = BaseReceiver;