import videojs from 'video.js';
import merge from 'deepmerge';
import { version as VERSION } from '../package.json';
import { percentage as PERCENTAGE, events as EVENTS } from './events.json';

// Default options for the plugin.
const defaults = {
  url: 'http://localhost:9999',
  contentId: 'content1234',
  profileId: 'prof1234',
  request: {
    headers: {
      Authorization: 'JWT 1234'
    }
  }
};

// Cross-compatibility for Video.js 5 and 6.
const registerPlugin = videojs.registerPlugin || videojs.plugin;
// const dom = videojs.dom || videojs;

// Saves last time
let lastTime = 0;
// Playback Start Date
let startDate = null;
// Array with events already sent
let eventsSent = [];

/**
 * Function to invoke when the player is ready.
 *
 * @param    {videojs} player
 * @param    {Object} [options={}]
 */
const onLoadedMetadata = (player, options) => {
  sendEvent(EVENTS.START, player, options);
};

/**
 * Function to invoke when the event pause is triggered.
 * 
 * @param {videojs} player
 * @param {Object} options
 */
const onPauseEvent = (player, options) => {
  sendEvent(EVENTS.PAUSE, player, options);
};

/**
 * Function to invoke when the event play is triggered.
 * 
 * @param {videojs} player
 * @param {Object} options
 */
const onResumeEvent = (player, options) => {
  sendEvent(EVENTS.RESUME, player, options);
};

/**
 * Function to invoke when the event onbeforeunload is triggered.
 * 
 * @param {videojs} player
 * @param {Object} options
 */
const onBeforeUnload = (player, options) => {
  sendEvent(EVENTS.CLOSE, player, options);
};

/**
 * Function to invoke when the event timeupdate is triggered.
 * 
 * @param {videojs} player
 * @param {Object} options 
 */
const onTimeUpdate = (player, options) => {
  const percentage = Math.round((player.currentTime() / player.duration()) * 100);

  if (lastTime > player.currentTime()) {
    // Clean quartile events sent
    cleanEventsSent(percentage);
  }

  // Check quartiles
  //const event = getQuartileEvent(percentage);
  const event = getAllQuartileEvents(percentage);

  if (event && event.length > 0) {
    sendEvent(event, player, options);
  }
  
  // Set lastTime with currentTime for quartile reset
  lastTime = player.currentTime();
};

/**
 * Sends event with player data
 * 
 * @param {String} event 
 * @param {videojs} player 
 */
function sendEvent(event, player, options) {
  const playerData = {
    position: Math.round(player.currentTime()),
    timeSpent: Math.round((Date.now() - startDate) / 1000),
    event,
    contentId: options.contentId,
    profileId: options.profileId
  };

  console.log(playerData);
  makeRequest(options.url, playerData, options.request)
}

/**
 * Function to send request through videojs xhr.
 * 
 * @param {String} url 
 * @param {Object} data 
 */
function makeRequest(url, body, request) {
  let defRequest = {
    body: JSON.stringify(body),
    url,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }

  let req = merge(request, defRequest);
  videojs.xhr(req, (err, res, body) => {
    console.log('RESPONSE');
  });
}

/**
 * Returns quartile event if any
 * 
 * @param {integer} percentage 
 */
function getQuartileEvent(percentage) {
  if (percentage >= PERCENTAGE.FIRSTQUARTILE && !eventsSent.includes(EVENTS.FIRSTQUARTILE)) {
    return EVENTS.FIRSTQUARTILE;
  } else if (percentage >= PERCENTAGE.MIDPOINT && !eventsSent.includes(EVENTS.MIDPOINT)) {
    return EVENTS.MIDPOINT;
  } else if (percentage >= PERCENTAGE.THIRDQUARTILE && !eventsSent.includes(EVENTS.THIRDQUARTILE)) {
    return EVENTS.THIRDQUARTILE;
  } else if (percentage >= PERCENTAGE.COMPLETE && !eventsSent.includes(EVENTS.COMPLETE)) {
    return EVENTS.COMPLETE;
  }
  return null;
}

function getAllQuartileEvents(percentage) {
  let events = [];
  let event = null;

  do {
    event = getQuartileEvent(percentage);
    if (event) {
      events.push(event);
      // Add event to array of events sent
      eventsSent.push(event);
    }
  } while(event !== null)

  return events;
}

/**
 * Clears events on rewind
 * 
 * @param {integer} percentage 
 */
function cleanEventsSent(percentage) {
  eventsSent = eventsSent.filter(event => {
    return percentage > PERCENTAGE[event.toUpperCase()];
  });
}

/**
 * Hooks player events
 *
 * @param {videojs} player
 * @param {Object} options
 */
const hookPlayerEvents = (player, options) => {
  player.on('loadedmetadata', onLoadedMetadata.bind(null, player, options));
  player.on('timeupdate', onTimeUpdate.bind(null, player, options));
  player.on('pause', onPauseEvent.bind(null, player, options));
  player.on('play', onResumeEvent.bind(null, player, options));
  window.addEventListener('beforeunload', onBeforeUnload.bind(null, player, options));
};

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
const trackingEvents = function(options) {
  this.ready(() => {
    startDate = Date.now();
    hookPlayerEvents(this, videojs.mergeOptions(defaults, options));
  });
};

// Register the plugin with video.js.
registerPlugin('trackingEvents', trackingEvents);

// Include the version number.
trackingEvents.VERSION = VERSION;

export default trackingEvents;
