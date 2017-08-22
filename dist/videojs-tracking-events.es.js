import videojs from 'video.js';
import merge from 'deepmerge';

var version = "0.0.1";

var events = { "LOAD": "Load", "START": "Start", "PROGRESS": "Progress", "FIRSTQUARTILE": "FirstQuartile", "MIDPOINT": "Midpoint", "THIRDQUARTILE": "ThirdQuartile", "COMPLETE": "Complete", "PAUSE": "Pause", "RESUME": "Resume", "CLOSE": "Close" };
var percentage = { "FIRSTQUARTILE": 25, "MIDPOINT": 50, "THIRDQUARTILE": 75, "COMPLETE": 95 };

// Default options for the plugin.
var defaults = {
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
var registerPlugin = videojs.registerPlugin || videojs.plugin;
// const dom = videojs.dom || videojs;

// Saves last time
var lastTime = 0;
// Playback Start Date
var startDate = null;
// Array with events already sent
var eventsSent = [];

/**
 * Function to invoke when the player is ready.
 *
 * @param    {videojs} player
 * @param    {Object} [options={}]
 */
var onLoadedMetadata = function onLoadedMetadata(player, options) {
  sendEvent(events.START, player, options);
};

/**
 * Function to invoke when the event pause is triggered.
 * 
 * @param {videojs} player
 * @param {Object} options
 */
var onPauseEvent = function onPauseEvent(player, options) {
  sendEvent(events.PAUSE, player, options);
};

/**
 * Function to invoke when the event play is triggered.
 * 
 * @param {videojs} player
 * @param {Object} options
 */
var onResumeEvent = function onResumeEvent(player, options) {
  sendEvent(events.RESUME, player, options);
};

/**
 * Function to invoke when the event onbeforeunload is triggered.
 * 
 * @param {videojs} player
 * @param {Object} options
 */
var onBeforeUnload = function onBeforeUnload(player, options) {
  sendEvent(events.CLOSE, player, options);
};

/**
 * Function to invoke when the event timeupdate is triggered.
 * 
 * @param {videojs} player
 * @param {Object} options 
 */
var onTimeUpdate = function onTimeUpdate(player, options) {
  var percentage$$1 = Math.round(player.currentTime() / player.duration() * 100);

  if (lastTime > player.currentTime()) {
    // Clean quartile events sent
    cleanEventsSent(percentage$$1);
  }

  // Check quartiles
  //const event = getQuartileEvent(percentage);
  var event = getAllQuartileEvents(percentage$$1);

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
  var playerData = {
    position: Math.round(player.currentTime()),
    timeSpent: Math.round((Date.now() - startDate) / 1000),
    event: event,
    contentId: options.contentId,
    profileId: options.profileId
  };

  console.log(playerData);
  makeRequest(options.url, playerData, options.request);
}

/**
 * Function to send request through videojs xhr.
 * 
 * @param {String} url 
 * @param {Object} data 
 */
function makeRequest(url, body, request) {
  var defRequest = {
    body: JSON.stringify(body),
    url: url,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  var req = merge(request, defRequest);
  videojs.xhr(req, function (err, res, body) {
    console.log('RESPONSE');
  });
}

/**
 * Returns quartile event if any
 * 
 * @param {integer} percentage 
 */
function getQuartileEvent(percentage$$1) {
  if (percentage$$1 >= percentage.FIRSTQUARTILE && !eventsSent.includes(events.FIRSTQUARTILE)) {
    return events.FIRSTQUARTILE;
  } else if (percentage$$1 >= percentage.MIDPOINT && !eventsSent.includes(events.MIDPOINT)) {
    return events.MIDPOINT;
  } else if (percentage$$1 >= percentage.THIRDQUARTILE && !eventsSent.includes(events.THIRDQUARTILE)) {
    return events.THIRDQUARTILE;
  } else if (percentage$$1 >= percentage.COMPLETE && !eventsSent.includes(events.COMPLETE)) {
    return events.COMPLETE;
  }
  return null;
}

function getAllQuartileEvents(percentage$$1) {
  var events$$1 = [];
  var event = null;

  do {
    event = getQuartileEvent(percentage$$1);
    if (event) {
      events$$1.push(event);
      // Add event to array of events sent
      eventsSent.push(event);
    }
  } while (event !== null);

  return events$$1;
}

/**
 * Clears events on rewind
 * 
 * @param {integer} percentage 
 */
function cleanEventsSent(percentage$$1) {
  eventsSent = eventsSent.filter(function (event) {
    return percentage$$1 > percentage[event.toUpperCase()];
  });
}

/**
 * Hooks player events
 *
 * @param {videojs} player
 * @param {Object} options
 */
var hookPlayerEvents = function hookPlayerEvents(player, options) {
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
var trackingEvents = function trackingEvents(options) {
  var _this = this;

  this.ready(function () {
    startDate = Date.now();
    hookPlayerEvents(_this, videojs.mergeOptions(defaults, options));
  });
};

// Register the plugin with video.js.
registerPlugin('trackingEvents', trackingEvents);

// Include the version number.
trackingEvents.VERSION = version;

export default trackingEvents;
