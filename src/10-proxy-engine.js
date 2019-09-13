'use strict';

{
  // Port 9 is discarded, see https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers#Well-known_ports
  const blackholeHostname = 'localhost';
  const blackholePort = 9;

  let dispatchEvent, mayDispatchEvent;
  let __TOR_PROXIES__;
  let __BLACKHOLE__;

  const webRequestEventPrefix = 'WEBREQUEST_';
  const addWebRequestEventListener = (eventCamel, handler) => {

    handler = Bexer.Utils.timeouted(handler);
    chrome.webRequest[eventCamel].addListener(
      handler,
      {urls: ['<all_urls>']},
    );
    return () => chrome.webRequest[eventCamel].removeListener(handler);
  };

  const applyProxyFilters = (proxyFilters, handler, requestDetails, proxyObjects) => {

    console.log(requestDetails.ip, proxyFilters, proxyObjects, requestDetails);
    if (proxyObjects.some(
      (proxyObj) => proxyObj.host && proxyObj.host === requestDetails.hostname,
    )) {
      // URL is located at some proxy, e.g. localhost.
      // Don't show that proxy is active.
      return;
    }
    const filteredProxyObjects = proxyObjects.filter(
      (proxyObj) => proxyFilters.some((filter) => {

        let result = true;
        if (filter.hosts && proxyObj.host) {
          result = result && filter.hosts.includes(proxyObj.host);
        }
        if (filter.ips && proxyObj.ip) {
          result = result && filter.ips.includes(proxyObj.ip);
        }
        if (filter.types && proxyObj.type) {
          result = result && filter.types.includes(proxyObj.type);
        }
        return result;
      }),
    );
    if (filteredProxyObjects.length) {
      handler(requestDetails, filteredProxyObjects);
    }
  };
  const addProxyEventListener = async (typeUpper, handler, proxyFilters) => {

    console.log('ADD PR', typeUpper, proxyFilters);
    if (!typeUpper.startsWith('PROXY')) {
      return;
    }
    switch (typeUpper) {
      case 'PROXY':
        const proxyIpToHosts = {
          '127.0.0.1': ['localhost'],
          '::1': ['localhost'],
        };
        if (proxyFilters) {
          proxyFilters
            .filter((filter) => filter.hosts)
            .map((filter) => {

              const hostsPromises = filter.hosts.map(async (host) => {

                let ipsPromises;
                if (host === 'localhost') {
                  ipsPromises = ['127.0.0.1', '::1'];
                } else {
                  const types = [1, 28];
                  ipsPromises = types.map((type) =>
                    fetch(`https://dns.google.com/resolve?type=${type}&name=${host}`)
                      .then((res) => res.json())
                      .then((res) => res.data) // TODO: handle errors.
                  );
                }
                return Promise.all(ipsPromises)
                  .then((ips) => ips.forEach(
                    (ip) => {

                      if (!proxyIpToHosts[ip]) {
                        proxyIpToHosts = [host];
                      } else {
                        proxyIpToHosts[ip].push(host);
                      }
                    }
                  ));
              });
              return Promise.all(hostsPromises);
            })
        }
        return addWebRequestEventListener('onResponseStarted', (requestDetails) => {

          const { ip } = requestDetails;
          if (!ip) {
            return;
          }
          let proxyObjects = [];
          const hosts = proxyIpToHosts[ip];
          if (hosts) {
            proxyObjects = hosts.map((host) => ({ host, ip }));
          } else {
            const ifIpInFilters = proxyFilters.some((f) => f.ips && f.ips.includes(ip));
            if (ifIpInFilters) {
              proxyObjects = [{ ip }];
            }
          }
          handler(requestDetails, proxyObjects);
          return;
        });
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
      ) {
        return handler(requestDetails);
      }
    });
  };

  const tryAddingWebRequestListeners = (typeUpper, handler, ...args) => {

    console.log('TRY WR', typeUpper)
    const ifWebRequest = typeUpper.startsWith(webRequestEventPrefix);
    if (!ifWebRequest) {
      return;
    }
    if (!chrome.webRequest) {
      throw new TypeError('No chrome.webRequest API detecetd! Check your permissions.');
    }
    const wrEventName = typeUpper.replace(webRequestEventPrefix, '');
    if (wrEventName === 'BLOCK') {
      return addBlockEventListener(handler, ...args);
    }
    const ifProxy = wrEventName.startsWith('PROXY');
    if (ifProxy) {
      return addProxyEventListener(wrEventName, handler, ...args);
    }
    return addWebRequestEventListener(typeUpper, handler, ...args);
    
  };

  const tryAddingSpecialListeners = (typeUpper, handler, proxyFilters) => {

    if (typeUpper === 'PROXY') {
      if (proxyFilters) {
        const oldHandler = handler;
        handler = (requestDetails, proxyObjects) =>
          applyProxyFilters(proxyFilters, oldHandler, requestDetails, proxyObjects);
      }
      if (chrome.proxy.onRequest) {
        return [null, handler];
      }
      typeUpper = webRequestEventPrefix + 'PROXY';
    }
    return [tryAddingWebRequestListeners(typeUpper, handler, proxyFilters), handler];
  }

  const proxyChooser = (memory, requestDetails) => {

    const hostname = requestDetails.hostname = requestDetails.host || new URL(requestDetails.url).hostname;
    console.log('PROXY CHOOSER FOR', hostname);
    let suffix;
    if (
      memory.some((hostnameSuffix) =>
        hostname.endsWith(hostnameSuffix),
      )
    ) {
      console.log('RETURNING TOR PROXY FOR', hostname);
      mayDispatchEvent('PROXY', requestDetails, __TOR_PROXIES__);
      return __TOR_PROXIES__;
    }
    dispatchEvent('DIRECT', requestDetails);
  };

  if (chrome.proxy.onRequest) {
    // Firefox.
    __TOR_PROXIES__ = [
      { type: 'socks', host: 'localhost', port: 9050 },
      { type: 'socks', host: 'localhost', port: 9150 },
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
        dispatchEvent = (typeUpper, ...plainObjects) =>
          (eventTypeUpperToHandlers[typeUpper] || [])
            .forEach((h) => h(...plainObjects));
        mayDispatchEvent = dispatchEvent;

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

      addEventListener(typeUpper, handler, ...args) {

        const [specialRemover, spHandler] = tryAddingSpecialListeners(typeUpper, handler, ...args);
        if (specialRemover) {
          return specialRemover;
        }
        if (!eventTypeUpperToHandlers[typeUpper]) {
          eventTypeUpperToHandlers[typeUpper] = [spHandler];
        } else {
          eventTypeUpperToHandlers[typeUpper].push(spHandler);
        }
        const removeListener = () => {
          eventTypeUpperToHandlers[typeUpper] = eventTypeUpperToHandlers[typeUpper]
            .filter((h) => h !== spHandler);
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
  constructor(typeUpper, ...plainObjects) {
    const msg = JSON.stringify(plainObjects);
    super(msg);
    this.name = ${'`EVENT_${typeUpper}`'};
    Error.captureStackTrace(this, this.constructor);
  }
}

const dispatchEvent = (typeUpper, ...plainObjects) => {
  throw new ErrorWhichIsEvent(typeUpper, ...plainObjects);
};
const mayDispatchEvent = () => {};

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

      addEventListener(typeUpper, handler, ...args) {

        const [specialRemover, spHandler] = tryAddingSpecialListeners(typeUpper, handler, ...args);
        if (specialRemover) {
          return specialRemover;
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
            spHandler(...JSON.parse(rest.join(':')));
          }
        });
      },

    };

  }

}
