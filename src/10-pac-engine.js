'use strict';

window.apis.pacEnginePromise = new Promise((resolveEngine) => {

  const blackhole = '-*-kill..all..ads-*-.invalid';

  const pacEngine = {

    async installAsync(data = [], cb) {

      const config = {
        mode: 'pac_script',
        pacScript: {
          data: `
class ErrorWhichIsEvent extends Error {
  constructor(type, obj) {
    const msg = JSON.stringify(obj);
    super(msg);
    this.name = ${'`EVENT_${type.toUpperCase()}`'};
    Error.captureStackTrace(this, this.constructor);
  }
}

const data = ${JSON.stringify(data, null, 2)};

function FindProxyForURL(url, host) {
  let suffix;
  if (data.some((hostname) => {
    suffix = hostname;
    return host.endsWith(hostname);
  })) {
    //return 'PROXY ${blackhole}';
    throw new ErrorWhichIsEvent('INFORM', { host, url, suffix });
  }
  return 'DIRECT';
}
          `,
        }
      };
      await new Promise((resolve) =>
        chrome.proxy.settings.set(
          {
            value: config,
            scope: 'regular',
          },
          Bexer.Utils.getOrDie(resolve),
        )
      );
      cb && cb();

    },

    async setDataAsync(data, cb) {

      return this.installAsync(data, cb);
    },

    addEventListener(type, handler) {

      return window.Bexer.addGlobalHandler((errType, errEvent) => {
        if (
          errType === 'pac-error'
          && errEvent.error === 'net::ERR_PAC_SCRIPT_FAILED'
        ) {
          const [_, line, uncaught, ...rest] = errEvent.details.split(':');
          if (!uncaught.includes(`EVENT_${type.toUpperCase()}`)) {
            return;
          }
          handler(JSON.parse(rest.join(':')));
        }
      });
    },

  };
  chrome.proxy.settings.clear({}, Bexer.Utils.getOrDie(() => resolveEngine(pacEngine)));

});

