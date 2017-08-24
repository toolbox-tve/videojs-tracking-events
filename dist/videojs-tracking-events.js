/**
 * videojs-tracking-events
 * @version 0.0.3
 * @copyright 2017 lribelle@tbxnet.com <lribelle@tbxnet.com>
 * @license UNLICENSED
 */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('video.js')) :
	typeof define === 'function' && define.amd ? define(['video.js'], factory) :
	(global.videojsTrackingEvents = factory(global.videojs));
}(this, (function (videojs) { 'use strict';

videojs = 'default' in videojs ? videojs['default'] : videojs;

var index$2 = function isMergeableObject(value) {
	return isNonNullObject(value) && isNotSpecial(value)
};

function isNonNullObject(value) {
	return !!value && typeof value === 'object'
}

function isNotSpecial(value) {
	var stringValue = Object.prototype.toString.call(value);

	return stringValue !== '[object RegExp]'
		&& stringValue !== '[object Date]'
}

function emptyTarget(val) {
    return Array.isArray(val) ? [] : {}
}

function cloneIfNecessary(value, optionsArgument) {
    var clone = optionsArgument && optionsArgument.clone === true;
    return (clone && index$2(value)) ? deepmerge(emptyTarget(value), value, optionsArgument) : value
}

function defaultArrayMerge(target, source, optionsArgument) {
    var destination = target.slice();
    source.forEach(function(e, i) {
        if (typeof destination[i] === 'undefined') {
            destination[i] = cloneIfNecessary(e, optionsArgument);
        } else if (index$2(e)) {
            destination[i] = deepmerge(target[i], e, optionsArgument);
        } else if (target.indexOf(e) === -1) {
            destination.push(cloneIfNecessary(e, optionsArgument));
        }
    });
    return destination
}

function mergeObject(target, source, optionsArgument) {
    var destination = {};
    if (index$2(target)) {
        Object.keys(target).forEach(function(key) {
            destination[key] = cloneIfNecessary(target[key], optionsArgument);
        });
    }
    Object.keys(source).forEach(function(key) {
        if (!index$2(source[key]) || !target[key]) {
            destination[key] = cloneIfNecessary(source[key], optionsArgument);
        } else {
            destination[key] = deepmerge(target[key], source[key], optionsArgument);
        }
    });
    return destination
}

function deepmerge(target, source, optionsArgument) {
    var sourceIsArray = Array.isArray(source);
    var targetIsArray = Array.isArray(target);
    var options = optionsArgument || { arrayMerge: defaultArrayMerge };
    var sourceAndTargetTypesMatch = sourceIsArray === targetIsArray;

    if (!sourceAndTargetTypesMatch) {
        return cloneIfNecessary(source, optionsArgument)
    } else if (sourceIsArray) {
        var arrayMerge = options.arrayMerge || defaultArrayMerge;
        return arrayMerge(target, source, optionsArgument)
    } else {
        return mergeObject(target, source, optionsArgument)
    }
}

deepmerge.all = function deepmergeAll(array, optionsArgument) {
    if (!Array.isArray(array) || array.length < 2) {
        throw new Error('first argument should be an array with at least two elements')
    }

    // we are sure there are at least 2 values, so it is safe to have no initial value
    return array.reduce(function(prev, next) {
        return deepmerge(prev, next, optionsArgument)
    })
};

var index = deepmerge;

var cjs = index;

var version = "0.0.3";

var events = { "LOAD": "Load", "START": "Start", "PROGRESS": "Progress", "FIRSTQUARTILE": "FirstQuartile", "MIDPOINT": "Midpoint", "THIRDQUARTILE": "ThirdQuartile", "COMPLETE": "Complete", "PAUSE": "Pause", "RESUME": "Resume", "CLOSE": "Close", "ENDED": "Ended" };
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
 * Function to invoke when the event ended is triggered.
 * 
 * @param {videojs} player
 * @param {Object} options
 */
var onEndedEvent = function onEndedEvent(player, options) {
  sendEvent(events.ENDED, player, options);
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
  var drmType = null;
  var formartType = null;

  var playerData = {
    position: Math.round(player.currentTime()),
    timeSpent: Math.round((Date.now() - startDate) / 1000),
    event: event,
    contentId: options.contentId,
    profileId: options.profileId,
    drmType: player.drmType || null,
    formatType: player.currentSource().type
  };

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

  var req = cjs(request, defRequest);
  videojs.xhr(req, function (err, res, body) {
    //idk
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
  player.on('ended', onEndedEvent.bind(null, player, options));
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

return trackingEvents;

})));
