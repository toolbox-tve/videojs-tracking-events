'use strict';

class NetTime {
  constructor(player) {
    this.player = player;
    this.time = 0;
    this.startPosition = 0;
    this.lastPosition = 0;
    this.scrubbing = false;

    this.reset = this.reset.bind(this);
    this.onPause = this.onPause.bind(this);
    this.onSeeking = this.onSeeking.bind(this);
    this.onPlay = this.onPlay.bind(this);
    this.onTimeUpdate = this.onTimeUpdate.bind(this);

    player.on('loadstart', this.reset);
    player.on('pause', this.onPause);
    player.on('seeking', this.onSeeking);
    player.on('play', this.onPlay);
    player.on('timeupdate', this.onTimeUpdate);
  }

  dispose() {
    if (this && this.player) {
      this.player.off('dispose', this.reset);
      this.player.off('loadstart', this.reset);
      this.player.off('pause', this.onPause);
      this.player.off('seeking', this.onSeeking);
      this.player.off('timeupdate', this.onTimeUpdate);
    }
  }

  reset() {
    this.time = 0;
    this.startPosition = 0;
    this.lastPosition = 0;
    this.scrubbing = false;
  }

  onPlay() {
    this.scrubbing = false;
    this.lastPosition = this.startPosition = Math.floor(this.player.currentTime());
  }

  onPause() {
    console.log("lastPosition: ", this.lastPosition);
    console.log("startPosition: ", this.startPosition);
    this.time += this.lastPosition - this.startPosition;
    console.log('time: ', this.time);
  }

  onSeeking() {
    this.scrubbing = true;
  }

  onTimeUpdate() {
    if(!this.player.scrubbing()) {
      this.lastPosition = Math.floor(this.player.currentTime());
    }
  }
}

export default NetTime;