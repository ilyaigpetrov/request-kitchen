'use strict';

window.apis = {};

window.Bexer.installErrorReporter({
  submissionOpts: {
    sendReportsToEmail: 'ilyaigpetrov+request-kitchen@gmail.com',
    sendReportsInLanguages: ['en', 'ru'],
  }
});


console.log('Extension started.');

chrome.browserAction.disable(); // Enable context menu on left click too.
chrome.browserAction.setBadgeBackgroundColor({
    color: 'ffffff',
  },
  Bexer.Utils.getOrDie(),
);

