import videojs from "video.js";
import merge from "deepmerge";
import { version as VERSION } from "../package.json";
import { events as EVENTS, quartiles as QUARTILES } from "./events.json";
import { drmDetect, playbackData } from './drmDetect';
import play from './tracking/play';
import buffering from './tracking/buffering';

const Plugin = videojs.getPlugin('plugin');

const STREAMING_PROGRESS_TIMER = 300000; // 300000 in ms = 5 min
const QUARTILE_CONFIG = {
  ALWAYS: 0,
  NO_SKIP: 1,
  ONLY_ONCE: 2
}

const noSkipNetworks = ["hbo"];

// Default options for the plugin.
const defaults = {
  url: "http://localhost:8889",
  contentId: "content1234",
  profileId: "prof1234",
  request: {
    headers: {
      Authorization: "JWT 1234"
    }
  }
};
class TrackEvents extends Plugin {
  /**
   * Creates an instance of TrackEvents.
   * @param {videojs} player
   * @param {Object} options
   * @memberof TrackEvents
   */
  constructor(player, options) {
    // the parent class will add player under this.player
    super(player);
    // Merged with default options
    this.options = videojs.mergeOptions(defaults, options);
    // Saves last time
    this.lastTime = 0;
    // Playback Start Date
    this.startDate = Date.now();
    // Array with events already sent
    this.eventsSent = [];
    // Event number - sequence
    this.eventNumber = 1;
    // Current Source
		this.currentSrc = player.currentSource();
		// Seeking boolean
    this.seeking = false;
    // Quartile config always, noSkip, OnlyOnce [default: Always]
    this.quartileConfig = QUARTILE_CONFIG.ALWAYS;
    // If the content was paused and not resumed
    this.paused = false;
    // first play
    this.isFirstPlay = true;

    this.bindedEvents = {};
    this.onBeforeUnload= this.onBeforeUnload.bind(this);

    this._play = new play(this.player);
    this._buffering = new buffering(this.player);

    this.init();
  }

  /**
   * Function to invoke when the player is ready.
   *
   * @memberof TrackEvents
   */
  onLoadedMetadata() {
    this.currentSrc = this.player.currentSource();

    if (this.currentSrc && noSkipNetworks.includes(this.currentSrc.network)) {
      this.quartileConfig = QUARTILE_CONFIG.NO_SKIP;
    }

    this.sendEvent(EVENTS.START);

    if (!this.intervalID) {
      this.intervalID = setInterval(this.sendEvent.bind(this, EVENTS.STREAMING_PROGRESS), STREAMING_PROGRESS_TIMER);
    }
  }

  onBuffered(e, data) {
    this.sendEvent(EVENTS.RE_BUFFERING, data);
  }

  onError(e, data) {
    const error = data ? data : this.player.error();
    this.sendEvent(EVENTS.PLAYBACKERROR, error.message);
  }

  onFirstPlay(e, data) {
    this.sendEvent(EVENTS.START_BUFFERING, data);
  }

  /**
   * Function to invoke when the event pause is triggered.
   *
   * @memberof TrackEvents
   */
  onPauseEvent() {
		if(this.player.currentTime() === this.player.duration()) {
			return;
		} else if (this.player.seeking && this.player.seeking()) {
			this.seeking = true;
			return;
		}

    this.sendEvent(EVENTS.PAUSE);
    this.paused = true;
  }

  /**
   * Function to invoke when the event play is triggered.
   *
   * @memberof TrackEvents
   */
  onResumeEvent() {
    if (this.isFirstPlay && this.player.startTime) {
      this.isFirstPlay = false;
    } else if(this.seeking) {
			this.seeking = false;
			return;
		} else if(!this.paused) {
      return;
    }

    this.sendEvent(EVENTS.RESUME);
    // Content was resumed
    this.paused = false;
  }

  /**
   * Function to invoke when the event ended is triggered.
   *
   * @memberof TrackEvents
   */
  onEndedEvent() {
    this.clearInterval(this.intervalID);
  }

  /**
   * Function to invoke when the event dispose is triggered.
   *
   * @memberof TrackEvents
   */
  onDisposeEvent() {
    onBeforeUnload({});
    this.clearInterval(this.intervalID);
  }

  /**
   * Function to invoke when the event onbeforeunload is triggered.
   *
   * @memberof TrackEvents
   */
  onBeforeUnload(event) {
    if (!navigator || !navigator.sendBeacon) {
      this.sendEvent(EVENTS.CLOSE);
    }

    const types = drmDetect(this.player);
    const pbData = playbackData(this.player);
    const url = this.options.url.includes('?') ? `${this.options.url}&beacon=true` : `${this.options.url}?beacon=true`;
    const jwt = this.options.request && this.options.request.headers && this.options.request.headers.Authorization;

    navigator.sendBeacon(url, JSON.stringify({
      content: {
        id: this.options.contentId,
        drmType: types.drmType,
        formatType: types.formatType,
        playbackUrl: this.player.currentSrc && this.player.currentSrc()
      },
      events: this.getEventObject(EVENTS.CLOSE, null),
      playback: {
        position: Math.round(this.player.currentTime()),
        timeSpent: Math.round((Date.now() - this.startDate) / 1000),
        bitrate: pbData.bitrate,
        resolution: pbData.resolution
      },
      user: {
        profileId: this.options.profileId,
      },
      playerID: this.player.playerID || this.player._playerID || '',
      hboAuthzToken: window.tbxHboAuthzToken || null,
      jwt,
      version: 2
    }));
  }

  /**
   * Function to invoke when the event timeupdate is triggered.
   *
   * @memberof TrackEvents
   */
  onTimeUpdate() {
    let data;

    if (this.currentSrc && this.currentSrc.isBroadcast) {
      return;
    }

    const percentage = Math.round(
      this.player.currentTime() / this.player.duration() * 100
    );

    if (this.lastTime > this.player.currentTime()) {
      // Clean quartile events sent
      this.cleanEventsSent(percentage);
    }

    // Check quartiles
    //const event = getQuartileEvent(percentage);0
    const event = this.getAllQuartileEvents(percentage);

    if (event && event.length > 0) {
      this.sendEvent(event, data);
    }

    // Set lastTime with currentTime for quartile reset
    this.lastTime = this.player.currentTime();
  }

  onChangeSource() {
    this.reset();
  }

  reset() {
    this.lastTime = 0;
    this.startDate = Date.now();
    this.eventsSent = [];
    this.eventNumber = 1;
		this.currentSrc = this.player.currentSource();
    this.seeking = false;
    // this.quartileConfig = QUARTILE_CONFIG.ALWAYS;
    this.paused = false;
    this.isFirstPlay = true;
  }

  /**
   *
   *
   * @param {any} id
   * @memberof TrackEvents
   */
  clearInterval(id) {
    if (id) {
      clearInterval(id);
    }
  }

  /**
   * Sends event with player data
   *
   * @param {String} event
   * @memberof TrackEvents
   */
  sendEvent(event, data) {
    const types = drmDetect(this.player);
    const pbData = playbackData(this.player);

    const content = (this.player.tbx && this.player.tbx.content) || {};

    const playerData = {
      content: {
        id: content.id,
        drmType: types.drmType,
        formatType: types.formatType,
        playbackUrl: this.player.currentSrc && this.player.currentSrc()
      },
      events: this.getEventObject(event, data),
      playback: {
        position: Math.round(this.player.currentTime()),
        timeSpent: Math.round((Date.now() - this.startDate) / 1000),
        bitrate: pbData.bitrate,
        resolution: pbData.resolution
      },
      user: {
        profileId: this.options.profileId,
      },
      playerID: this.player.playerId || this.player._playerID || '',
      hboAuthzToken: window.tbxHboAuthzToken || null,
      version: 2
    };

    if (data && (event === EVENTS.START_BUFFERING || event === EVENTS.RE_BUFFERING)) {
      playerData.bufferStats = data;
    }

    this.makeRequest(this.options.url, playerData, this.options.request);
  }


  /**
   * Returns event object with name & number of event
   *
   * @param {any} event
   * @returns
   * @memberof TrackEvents
   */
  getEventObject(event, data) {
    let events = [];

    if (Array.isArray(event)) {
      event.map(singleEvent => {
        let obj = {
          name: singleEvent.name || singleEvent,
          number: this.eventNumber++
        };

        if (data && (singleEvent === EVENTS.PLAYBACKERROR || singleEvent === EVENTS.PROGRESSMARK)) {
          obj.value = data;
        } else if (singleEvent.value) {
          obj.value = singleEvent.value;
        }

        events.push(obj);
      });
    } else {
      let obj = {
        name: event.name || event,
        number: this.eventNumber++
      };

      if(data && (event === EVENTS.PLAYBACKERROR || event === EVENTS.PROGRESSMARK)) {
        obj.value = data;
      } else if (event.value) {
        obj.value = event.value;
      }

      events.push(obj);
    }
    return events;
  }

  /**
   * Function to send request through videojs xhr.
   *
   * @param {any} url
   * @param {any} body
   * @param {any} request
   * @memberof TrackEvents
   */
  makeRequest(url, body, request) {
    let defRequest = {
      body: JSON.stringify(body),
      url,
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    };

    let req = merge(request, defRequest);
    videojs.xhr(req, (err, res, body) => {
      //idk
    });
  }

  /**
   * Returns quartile event if any
   *
   * @param {any} percentage
   * @returns
   * @memberof TrackEvents
   */
  getQuartileEvent(percentage) {
    let filter;

    if (this.quartileConfig === QUARTILE_CONFIG.NO_SKIP ) {
      filter = quartile => percentage === quartile.value && !this.eventsSent.includes(quartile.value)
    } else {
      filter = quartile => percentage >= quartile.value && !this.eventsSent.includes(quartile.value)
    }

    return QUARTILES.filter(filter);
  }

  /**
   * Returns all quartile events
   *
   * @param {any} percentage
   * @returns
   * @memberof TrackEvents
   */
  getAllQuartileEvents(percentage) {
    let events = [];

    let quartiles = this.getQuartileEvent(percentage);
    if (quartiles && quartiles.length > 0) {
      quartiles.map(quartile => {
        events.push(quartile);
        // Add event to array of events sent
        this.eventsSent.push(quartile.value);
      });
    }

    return events;
  }

  /**
   * Clears events on rewind
   *
   * @param {any} percentage
   * @memberof TrackEvents
   */
  cleanEventsSent(percentage) {
    this.eventsSent = this.eventsSent.filter(quartileNumber => {
      return percentage > quartileNumber;
    });
  }

  /**
   * Hooks player events
   *
   * @memberof TrackEvents
   */
  hook(playerEvent, callback) {
    if (!this.bindedEvents[playerEvent]) {
      this.bindedEvents[playerEvent] = [];
    }

    const bindedCallback = callback.bind(this);
    // Stores binded callbacks
    this.bindedEvents[playerEvent].push(bindedCallback);

    this.player.on(playerEvent, bindedCallback);
  }

  /**
   * Init
   *
   * @memberof TrackEvents
   */
  init() {
    this.hook("loadedmetadata", this.onLoadedMetadata);
    this.hook("timeupdate", this.onTimeUpdate);
    this.hook("pause", this.onPauseEvent);
    this.hook("play", this.onResumeEvent);
    this.hook("ended", this.onEndedEvent);
    this.hook("dispose", this.onDisposeEvent);
    this.hook("buffered", this.onBuffered);
    this.hook("start-buffering", this.onFirstPlay);
    this.hook("error", this.onError);
    this.hook('changesource', this.onChangeSource);
    window.addEventListener("beforeunload", this.onBeforeUnload);
  }

  dispose() {
    if (this && this.player) {
      Object.keys(this.bindedEvents).map(key => {
        this.bindedEvents[key].map(callback => {
          this.player.off(key, callback);
        })
      });

      this._play.dispose();
      this._buffering.dispose();
      this.clearInterval(this.intervalID);
      window.removeEventListener("beforeunload", this.onBeforeUnload);
    }
    super.dispose();
  }
}

// Cross-compatibility for Video.js 5 and 6.
const registerPlugin = videojs.registerPlugin || videojs.plugin;
const getPlugin = videojs.getPlugin || videojs.plugin;
// const dom = videojs.dom || videojs;

/**
 * A video.js plugin.
 *
 * In the plugin function, the value of `this` is a video.js `Player`
 * instance. You cannot rely on the player being in a "ready" state here,
 * depending on how the plugin is invoked. This may or may not be important
 * to you; if not, remove the wait for "ready"!
 *
 * @function trackingEvents
 * @param    {Object} [options={}]
 *           An object of options left to the plugin author to define.
 */
// const trackingEvents = function(options) {
//     const trackEvents = new TrackEvents(this, videojs.mergeOptions(defaults, options));
// };

// Register the plugin with video.js.
if (typeof getPlugin('eventTracking') === 'undefined') {
  registerPlugin("trackingEvents", TrackEvents);
}

// Define default values for the plugin's `state` object here.
TrackEvents.defaultState = {};

// Include the version number.
TrackEvents.VERSION = VERSION;

export default TrackEvents;
