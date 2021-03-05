import videojs from "video.js";

const HLS = 'application/x-mpegurl',
 DASH = 'application/dash+xml',
 SMOOTH_STREAMING = 'application/vnd.ms-sstr+xml',
 FAIRPLAY = 'com.apple.fps.1_0',
 WIDEVINE = 'com.widevine.alpha',
 PLAYREADY = 'com.microsoft.playready';

export function drmDetect(player) {
  let drmType = null;
  let formatType = null;
  const browserDRM = player && player.supportedDRM;
  const src = player && player.currentSource();

  if (src) {
    formatType = src.type;

    if (src.protected) {
      if (formatType === DASH) {
        drmType = getDashDRM(player, browserDRM);
      } else if (formatType === HLS && videojs.browser.IS_SAFARI) {
        drmType = FAIRPLAY;
      } else if (formatType === SMOOTH_STREAMING) {
        drmType = PLAYREADY;
      }
    }
  }

  return { formatType, drmType };
}

function getDashDRM(player, browserDRM) {
    const src = player.currentSource();
    if (videojs.browser.IS_EDGE || videojs.browser.IE_VERSION > 0) {
        return PLAYREADY;
    } else if (src.keySystemOptions && src.keySystemOptions.length > 0) {
        for(let i = 0; src.keySystemOptions.length > i; i++) {
          if (browserDRM.includes(src.keySystemOptions[i].name)) {
            return src.keySystemOptions[i].name;
          }
        }
        return src.keySystemOptions[0].name;
    }
    return null;
}

export function playbackData(player) {
  const resolution = getResolution(player);

  if (player) {
    if(player.tech_ && player.tech_.shakaPlayer) {
      const shakaStats = player.tech_.shakaPlayer.getStats();
      return {
        bitrate: shakaStats.streamBandwidth,
        resolution: resolution || {
          width: shakaStats.width,
          height: shakaStats.height
        }
      };
    } else if (player.tech_ && player.tech_.hls) {
      const hls = player.tech_.hls;
      const hlsStats = hls.playlists && hls.playlists.media();
      return {
        bitrate: hlsStats.attributes.BANDWIDTH,
        resolution: resolution || hlsStats.attributes.RESOLUTION
      }
    }
  }

  return {
    bitrate: null,
    resolution: resolution
  }
}

function getResolution(player) {
  if (!player || !player.tech_ || !player.tech_.el_) {
    return null;
  }

  const videoTag = player.tech_.el_;
  return {
    width: videoTag.videoWidth,
    height: videoTag.videoHeight,
  };
}
