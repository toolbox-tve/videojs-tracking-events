'use strict';

class Play {
  constructor(player) {
    this.player = player;
    this.firstPlay = false;
    this.loadStart = 0;
    this.loadEnd = 0;
    this.secondsToLoad = 0;

    player.on('dispose', this.reset.bind(this));
    player.on('loadstart', this.onLoadStart.bind(this));
    player.on('loadeddata', this.onLoadedData.bind(this));
    player.on('playing', this.onPlaying.bind(this));
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