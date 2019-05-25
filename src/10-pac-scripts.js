'use strict';

{
  const blackhole = '-*-kill..all..ads-*-.invalid';

  const config = {
    mode: 'pac_script',
    pacScript: {
      data: `
function FindProxyForURL(url, host) {
  if (host.endsWith('google.com')) {
    return 'PROXY ${blackhole}';
  }
  return 'DIRECT';
}
      `,
    }
  };
  chrome.proxy.settings.set(
    {
      value: config,
      scope: 'regular',
    },
    Bexer.Utils.getOrDie(),
  );
}
