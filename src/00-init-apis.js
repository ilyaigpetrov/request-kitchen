'use strict';

{
  window.apis = {};

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

  chrome.browserAction.disable(); // Enable context menu on left click too.

  chrome.browserAction.setBadgeText({
      text: 'λ',
    },
    Bexer.Utils.workOrDie(),
  );
}
