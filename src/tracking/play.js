'use strict';

class Play {
  constructor(player) {
    this.player = player;
    this.firstPlay = false;
    this.loadStart = 0;
    this.loadEnd = 0;
    this.secondsToLoad = 0;

    this.reset = this.reset.bind(this);
    this.onLoadStart = this.onLoadStart.bind(this);
    this.onLoadedData = this.onLoadedData.bind(this)
    this.onPlaying = this.onPlaying.bind(this);

    player.on('dispose', this.reset);
    player.on('loadstart', this.onLoadStart);
    player.on('loadeddata', this.onLoadedData);
    player.on('playing', this.onPlaying);
  }

  dispose() {
    if (this && this.player) {
      this.player.off('dispose', this.reset);
      this.player.off('loadstart', this.onLoadStart);
      this.player.off('loadeddata', this.onLoadedData);
      this.player.off('playing', this.onPlaying);
    }
  }

  reset() {
    this.firstPlay = false;
    this.loadStart = 0;
    this.loadEnd = 0;
    this.secondsToLoad = 0;
  }

  onLoadStart() {
    this.reset();
    this.loadStart = new Date();
  }

  onLoadedData() {
    this.loadEnd = new Date();
    this.secondsToLoad = ((this.loadEnd - this.loadStart) / 1000);
  }

  onPlaying() {
    if (!this.firstPlay) {
      this.firstPlay = true;
      this.player.trigger('start-buffering', {secondsToLoad: +this.secondsToLoad.toFixed(3)});
      // console.log(`firstplay - secondsToLoad: ${this.secondsToLoad.toFixed(3)}`);
    }
  }
}

export default Play;