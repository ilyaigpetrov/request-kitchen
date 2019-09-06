'use strict';

{
  // Port 9 is discarded, see https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers#Well-known_ports
  //const blackholeHostname = '-*-kill..all..ads-*-.invalid';
  //const blackholeHostname = 'google.com';
  const blackholeHostname = 'localhost';
  const blackholePort = 9;

  let dispatchEvent;
  let __TOR_PROXIES__;
  let __BLACKHOLE__;

  const webRequestEventPrefix = 'WEBREQUEST_';
  const addWebRequestEventListener = (eventCamel, handler) => {

    chrome.webRequest[eventCamel].addListener(
      handler,
      {urls: ['<all_urls>']}
    );
    return () => chrome.webRequest[eventCamel].removeListener(handler);
  };

  const addProxyEventListener = (typeUpper, handler) => {

    if (!typeUpper.startsWith('PROXY')) {
      return;
    }
    switch (typeUpper) {
      case 'PROXY':
        // TODO: check response ip with ips of proxies.
        return addWebRequestEventListener('onResponseStarted', handler);
      case 'PROXY_ERROR':
        // TODO: filter out non-proxy errors.
        return addWebRequestEventListener('onErrorOccurred', handler);
      default:
        throw new TypeError(`Unknown proxy event type "${typeUpper}"!`)
    }
  }

  const addBlockEventListener = (handler) => {

    addProxyEventListener('PROXY_ERROR', (requestDetails) => {

      if (
        requestDetails.error === 'net::ERR_PROXY_CONNECTION_FAILED'
        && !requestDetails.ip // A GUESS: if error happened after successfull connection then ip may be set.
      ) {
        return handler(requestDetails);
      }
    });
  };

  const tryAddingWebRequestListeners = (typeUpper, handler) => {

    const ifWebRequest = typeUpper.startsWith(webRequestEventPrefix);
    if (!ifWebRequest) {
      return;
    }
    if (!chrome.webRequest) {
      throw new TypeError('No chrome.webRequest API detecetd! Check your permissions.');
    }
    const wrEventName = typeUpper.replace(webRequestEventPrefix, '');
    if (wrEventName === 'BLOCK') {
      return addBlockEventListener(handler);
    }
    const ifProxy = wrEventName.startsWith('PROXY');
    if (ifProxy) {
      return addProxyEventListener(typeUpper, handler);
    }
    return addWebRequestEventListener(typeUpper, handler);
    
  };

  const proxyChooser = (memory, requestDetails) => {

    const host = requestDetails.host || new URL(requestDetails.url).hostname;
    console.log('PROXY CHOOSER FOR', host);
    let suffix;
    if (
      memory.some((hostname) => {

        suffix = hostname;
        return host.endsWith(hostname);
      })
    ) {
      console.log('RETURNING TOR PROXY FOR', host);
      return __BLACKHOLE__;
    }
    dispatchEvent('DIRECT', requestDetails);
  };

  if (chrome.proxy.onRequest) {
    // Firefox.
    __TOR_PROXIES__ = [
      { type: 'socks', host: 'localhost', port: 9150 },
      { type: 'socks', host: 'localhost', port: 9050 },
    ];
    __BLACKHOLE__ = { type: 'proxy', host: blackholeHostname, port: blackholePort };
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

        const remover = tryAddingWebRequestListeners(typeUpper, handler);
        if (remover) {
          return remover;
        }
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
    __TOR_PROXIES__ = '"SOCKS5 localhost:9150; SOCKS5 localhost:9050"';
    __BLACKHOLE__ = `"PROXY ${blackholeHostname}:${blackholePort}"`;
    const templateContext = {
      __TOR_PROXIES__,
      __BLACKHOLE__,
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

            `.trim(),
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

        const remover = tryAddingWebRequestListeners(typeUpper, handler);
        if (remover) {
          return remover;
        }
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
