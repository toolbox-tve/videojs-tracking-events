'use strict';

class Buffering {
  constructor(player) {
    this.player = player;
    this.timer = null;
    this.scrubbing = false;
    this.bufferPosition = false;
    this.bufferStart = false;
    this.bufferEnd = false;
    this.bufferCount = 0;
    this.readyState = false;

    player.on('dispose', this.reset.bind(this));
    player.on('loadstart', this.reset.bind(this));
    player.on('ended', this.reset.bind(this));
    player.on('pause', this.onPause.bind(this));
    player.on('waiting', this.onPlayerWaiting.bind(this));
    player.on('seeking', this.onSeeking.bind(this));
    player.on('canplaythrough', this.onCanPlayThrough.bind(this));
  }

  reset() {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.scrubbing = false;
    this.bufferPosition = false;
    this.bufferStart = false;
    this.bufferEnd = false;
    this.bufferCount = 0;
    this.readyState = false;
  }

  onPause() {
    this.bufferStart = false;
    this.scrubbing = this.player.scrubbing();
  }

  onPlayerWaiting() {
    if (this.bufferStart === false && this.player.currentTime() > 0) {
      this.bufferStart = new Date();
      this.bufferPosition = +this.player.currentTime().toFixed(0);
      this.readyState = +this.player.readyState();
    }
  }

  onSeeking() {
    this.scrubbing = true;
  }

  onCanPlayThrough() {
    const curTime = +this.player.currentTime().toFixed(0);
    const buffered = this.player.tech_ && this.player.tech_.el_ && this.player.tech_.el_.buffered;

    if (buffered && buffered.length > 0) {
      this.bufferPosition = +buffered.end(0).toFixed(0);
    }

    if (this.bufferStart && curTime !== this.bufferPosition) {
      this.bufferEnd = new Date();

      const secondsToLoad = ((this.bufferEnd - this.bufferStart) / 1000);

      this.bufferStart = false;
      this.bufferPosition = false;
      this.bufferCount++;

      this.player.trigger('buffered', {
        currentTime: curTime,
        readyState: this.readyState,
        secondsToLoad: +secondsToLoad.toFixed(3),
        bufferCount: this.bufferCount,
        scrubbing: this.scrubbing
      });

      // console.log(`buffered (${this.bufferCount}) [${this.scrubbing}] - ${secondsToLoad.toFixed(3)}`);
    }

    if (this.bufferStart === false) {
      this.scrubbing = false;
    }
  }
}

export default Buffering;