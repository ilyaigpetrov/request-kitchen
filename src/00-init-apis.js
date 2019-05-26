'use strict';

{
  window.apis = {
    platform: {
      ifFirefox: navigator.userAgent.toLowerCase().includes('firefox'),
    },
  };

  window.Bexer.installErrorReporter({
    submissionOpts: {
      sendReportsToEmail: 'ilyaigpetrov+request-kitchen@gmail.com',
      sendReportsInLanguages: ['en', 'ru'],
    },
    // Ignore errors related to ads blocking.
    ifToNotifyAboutAsync: (errType, errEvent) =>
      errEvent.error !== 'net::ERR_PROXY_CONNECTION_FAILED'
      && !(errEvent.details || '').includes('EVENT_'),
  });

  console.log('Extension started.');

  if (window.apis.platform.ifFirefox) {
    chrome.browserAction.setBadgeTextColor({
      color: '#ffffff',
    });
    /*
    chrome.browserAction.onClicked.addListener(Bexer.Utils.workOrDie(() =>
      alert('Click me with a left button!'),
    ));
    */
    chrome.browserAction.setPopup({
        popup: chrome.extension.getURL('./pages/popup/index.html'),
      },
      Bexer.Utils.workOrDie(),
    );
  } else {
    // Chromium-like.
    chrome.browserAction.disable(); // Enable context menu on left click too.
  }
  chrome.browserAction.setBadgeBackgroundColor({
      color: '#4285f4',
    },
    Bexer.Utils.workOrDie(),
  );
  chrome.browserAction.setBadgeText({
      text: '?',
    },
    Bexer.Utils.workOrDie(),
  );
}
