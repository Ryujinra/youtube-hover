'use strict';

var iframe;
var config = {
  'relative-x': 0,
  'relative-y': 0,
  'center-x': 0,
  'center-y': 0,
  'delay': 1000,
  'width': 500,
  'mode': 0,
  'strike': true,
  'history': true,
  'scroll': true,
  'smooth': true,
  'dark': false
};
chrome.storage.local.get(config, prefs => config = prefs);
chrome.storage.onChanged.addListener(prefs => {
  Object.keys(prefs).forEach(name => {
    config[name] = prefs[name].newValue;
  });
});

var smoothScroll = (function () {
  let timeLapsed = 0;
  let id, sx, sy, dx, dy, callback;

  let easingPattern = time => time < 0.5 ? 8 * time * time * time * time : 1 - 8 * (--time) * time * time * time;

  function step () {
    timeLapsed += 16;
    let percentage = timeLapsed / 400;
    if (percentage > 1) {
      window.scrollTo(sx + dx, sy + dy);
      return callback();
    }
    window.scrollTo(
      Math.floor(sx + (dx * easingPattern(percentage))),
      Math.floor(sy + (dy * easingPattern(percentage)))
    );
    id = window.setTimeout(step, 16);
  }

  return function (x, y, c) {
    window.clearTimeout(id);
    callback = c;
    timeLapsed = 0;
    sx = document.body.scrollLeft + document.documentElement.scrollLeft;
    sy = document.body.scrollTop + document.documentElement.scrollTop;
    dx = Math.max(0, x - sx);
    dy = Math.max(0, y - sy);
    if (dx === 0 && dy === 0) {
      return c();
    }
    step();
  };
})();

var youtube = {
  play: (id, rect, shared) => {
    iframe = document.createElement('iframe');
    iframe.setAttribute('width', config.width);
    iframe.setAttribute('height', config.width * 180 / 320);

    function play () {
      if (shared) {
        chrome.runtime.sendMessage({
          cmd: 'find-id',
          url: 'https://www.youtube.com/shared?ci=' + id
        }, id => {
          if (id) {
            iframe.setAttribute('src', `https://www.youtube.com/embed/${id}?autoplay=1`);
          }
          else {
            iframe.dataset.error = true;
          }
        });
      }
      else {
        iframe.setAttribute('src', `https://www.youtube.com/embed/${id}?autoplay=1`);
      }
    }

    if (config.mode === 1) { // center of screen
      iframe.setAttribute('style', `
        position: fixed;
        left: calc(50% - ${config.width / 2 - config['center-x']}px);
        top: calc(50% - ${config.width * 180 / 320 / 2 - config['center-y']}px);
      `);
      play();
    }
    else {
      let x1 = Math.max(0, rect.left + document.body.scrollLeft +
        document.documentElement.scrollLeft + config['relative-x']);
      let y1 = Math.max(0, rect.top + rect.height + document.body.scrollTop +
        document.documentElement.scrollTop + config['relative-y']);
      let x2 = x1 + config.width;
      let y2 = y1 + config.width * 180 / 320;
      let vw = document.documentElement.scrollWidth;
      let vh = document.documentElement.scrollHeight;

      let left = x1;
      let top = y1;
      if (x2 > vw - 10) {
        left = vw - config.width - 10;
      }
      if (y2 > vh - 10) {
        top = vh - config.width * 180 / 320 - 10;
      }
      if (config.scroll) {
        let x = Math.max(
          document.body.scrollLeft,
          left + config.width - document.documentElement.clientWidth + 10
        );
        let y = Math.max(
          document.body.scrollTop,
          top + config.width * 180 / 320 - document.documentElement.clientHeight + 10
        );
        if (config.smooth) {
          smoothScroll(x, y, play);
        }
        else {
          window.scrollTo(x, y);
          play();
        }
      }
      else {
        play();
      }

      iframe.setAttribute('style', `
        position: absolute;
        left: ${left}px;
        top: ${top}px;
      `);

    }
    iframe.setAttribute('class', 'ihvyoutube');
    iframe.dataset.dark = config.dark;
    document.body.appendChild(iframe);
  }
};

var timer;
document.addEventListener('mouseover', e => {
  let target = e.target;
  if (target) {
    let link = target.closest('a');
    if (link) {
      let href = link.href;
      if (!href || iframe) {
        return;
      }
      let shared = false;
      if (
        href.indexOf('youtube.com/shared') !== -1 ||
        href.indexOf('youtube.com/attribution_link') !== -1 ||
        href.indexOf('youtube.com/watch') !== -1 ||
        href.indexOf('//youtu.be/') !== -1
      ) {
        let id;
        if (href.indexOf('youtube.com/watch') !== -1) {
          id = href.match(/v\=([^\&]+)/);
        }
        else if (href.indexOf('//youtu.be/') !== -1) {
          id = href.match(/\.be\/([^\&]+)/);
        }
        else if (href.indexOf('youtube.com/attribution_link') !== -1) {
          id = decodeURIComponent(href).match(/v\=([^\&]+)/);
        }
        else if (href.indexOf('youtube.com/shared') !== -1) {
          shared = true;
          id = href.match(/ci\=([^\&]+)/);
        }

        if (id && id.length) {
          window.clearTimeout(timer);
          timer = window.setTimeout((link) => {
            let activeLink = [...document.querySelectorAll(':hover')].pop();
            if (link === activeLink) {
              let rect = link.getBoundingClientRect();
              youtube.play(id[1], rect, shared);
              if (config.strike) {
                [...document.querySelectorAll(`a[href="${href}"]`), link].
                  forEach(l => l.style['text-decoration'] = 'line-through');
              }
              if (config.history) {
                chrome.runtime.sendMessage({
                  url: href,
                  cmd: 'history'
                });
              }
            }
          }, config.delay, link);
        }
      }
    }
  }
});
document.addEventListener('click', () => {
  if (iframe) {
    [...document.querySelectorAll('.ihvyoutube')].forEach(f => f.parentNode.removeChild(f));
    iframe = null;
  }
});
