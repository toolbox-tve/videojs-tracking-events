'use strict';

class NetTime {
  constructor(player) {
    this.player = player;
    this.time = 0;
    this.startPosition = 0;
    this.lastPosition = 0;

    this.reset = this.reset.bind(this);
    this.onPlay = this.onPlay.bind(this);
    this.onTimeUpdate = this.onTimeUpdate.bind(this);

    player.on('loadstart', this.reset);
    player.one('play', this.onPlay);
    player.on('timeupdate', this.onTimeUpdate);


  }

  dispose() {
    if (this && this.player) {
      this.player.off('dispose', this.reset);
      this.player.off('loadstart', this.reset);
      this.player.off('timeupdate', this.onTimeUpdate);
    }
  }

  reset() {
    this.time = 0;
    this.startPosition = 0;
    this.lastPosition = 0;
  }

  onPlay() {
    this.lastPosition = this.startPosition = Math.floor(this.player.currentTime());
  }

  onTimeUpdate() {
    const currentPosition = Math.floor(this.player.currentTime());
    const timePassed = currentPosition -this.lastPosition;

    if(timePassed != 0 && timePassed != 1) {
      this.time += this.lastPosition - this.startPosition;
      this.lastPosition = this.startPosition = currentPosition;
    } else {
      this.lastPosition = currentPosition;
    }
  }

  getTime() {
    this.time += this.lastPosition - this.startPosition;
    this.lastPosition = this.startPosition = Math.floor(this.player.currentTime());
    return this.time;
  }
}

export default NetTime;