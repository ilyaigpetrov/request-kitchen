'use strict';

{
  // Port 9 is discarded, see https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers#Well-known_ports
  const blackholeHostname = '-*-kill..all..ads-*-.invalid';
  const blackholePort = 9;

  let dispatchEvent;
  let TOR_PROXIES;
  let BLACKHOLE;

  const proxyChooser = (memory, requestDetails) => {

    const host = requestDetails.host || new URL(requestDetails.url).hostname;
    console.log('PROXY CHOOSER FOR', host);
    let suffix;
    if (memory.some((hostname) => {
      suffix = hostname;
      return host.endsWith(hostname);
    })) {
      console.log('RETURNING TOR PROXY FOR', host);
      return TOR_PROXIES;
    }
    dispatchEvent('DIRECT', requestDetails);
  };

  if (chrome.proxy.onRequest) {
    // Firefox.
    TOR_PROXIES = [
      { type: 'socks', host: 'localhost', port: 9150 },
      { type: 'socks', host: 'localhost', port: 9050 },
    ];
    BLACKHOLE = { type: 'proxy', host: blackholeHostname, port: blackholePort };
    const eventTypeUpperToHandlers = {};
    let memory = [];
    window.apis.proxyEngine = {

      async installAsync(memoryInit, cb) {

        if (typeof memoryInit === 'function') {
          cb = memoryInit;
          memoryInit = undefined;
        }
        if (memoryInit) {
          memory = memoryInit;
        }
        dispatchEvent = (typeUpper, plainObj) =>
          (eventTypeUpperToHandlers[typeUpper] || [])
            .forEach((h) => h(plainObj));

        console.log('ADDING LISTENER TO BEFORE REQUEST');
        browser.proxy.onRequest.addListener(
          (requestDetails) => proxyChooser(memory, requestDetails),
          { urls: ['<all_urls>'] },
          ['requestHeaders'],
        );
        cb && cb();
      },

      async setMemoryAsync(newMemory, cb) {

        memory = newMemory;
        cb && cb();
      },

      addEventListener(typeUpper, handler) {

        if (!eventTypeUpperToHandlers[typeUpper]) {
          eventTypeUpperToHandlers[typeUpper] = [handler];
        } else {
          eventTypeUpperToHandlers[typeUpper].push(handler);
        }
        const removeListener = () => {
          eventTypeUpperToHandlers[typeUpper] = eventTypeUpperToHandlers[typeUpper]
            .filter((h) => h !== handler);
        }
        return removeListener;
      },
    };
  } else {
    // Chromium.
    TOR_PROXIES = '"SOCKS5 localhost:9150; SOCKS5 localhost:9050"';
    BLACKHOLE = `"PROXY ${blackholeHostname}:${blackholePort}"`;
    const templateContext = {
      TOR_PROXIES,
      BLACKHOLE,
    };
    window.apis.proxyEngine = {

      async installAsync(memory = [], cb) {

        const config = {
          mode: 'pac_script',
          pacScript: {
            data: `
class ErrorWhichIsEvent extends Error {
  constructor(typeUpper, obj) {
    const msg = JSON.stringify(obj);
    super(msg);
    this.name = ${'`EVENT_${typeUpper}`'};
    Error.captureStackTrace(this, this.constructor);
  }
}

const dispatchEvent = (typeUpper, plainObj) => {
  throw new ErrorWhichIsEvent(typeUpper, plainObj);
};

const memory = ${JSON.stringify(memory, null, 2)};

function FindProxyForURL(url, host) {
  const requestDetails = { url, host };
  return (${
    Object.entries(templateContext).reduce(
      (acc, [placeholder, value]) =>
        acc.replace(new RegExp(placeholder, 'g'), value),
      proxyChooser.toString(),
    )
  })(memory, requestDetails);
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
            Bexer.Utils.workOrDie(resolve),
          )
        );
        cb && cb();

      },

      async setMemoryAsync(memory, cb) {

        return this.installAsync(memory, cb);
      },

      addEventListener(typeUpper, handler) {

        return window.Bexer.addGlobalHandler((errType, errEvent) => {
          if (
            errType === Bexer.ErrorTypes.PAC_ERROR
            && errEvent.error === 'net::ERR_PAC_SCRIPT_FAILED'
          ) {
            const [_, line, uncaught, ...rest] = errEvent.details.split(':');
            if (!uncaught.includes(`EVENT_${typeUpper}`)) {
              return;
            }
            handler(JSON.parse(rest.join(':')));
          }
        });
      },

    };

  }

}