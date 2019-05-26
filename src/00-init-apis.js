'use strict';

{
  console.log('Extension started.');

  const fakeStorage = {
    ifEnabled: true,
    ifMuted: false,
  };

  window.apis = {
    platform: {
      ifFirefox: navigator.userAgent.toLowerCase().includes('firefox'),
    },
    persistedState: {
      getAsync() {

        return Promise.resolve(fakeStorage);
      },
      updateAsync(newOpts) {
        Object.assign(fakeStorage, newOpts);
        return this.getAsync();
      }
    },
    runtimeState: {
      uninstallReporterSingleton: () => {},
    },
    async setMutedTo(ifMuted = false) {
      const ifCurrentlyMuted = (await this.persistedState.getAsync()).ifMuted;
      if(ifMuted === ifCurrentlyMuted) {
        return;
      }
      await this.persistedState.updateAsync({ ifMuted });
      installReporterSingleton({ ifMuted });
    },
  };

  const installReporterSingleton = async ({ ifMuted } = {}) => {

    if (ifMuted === undefined) {
      ifMuted = (await window.apis.persistedState.getAsync()).ifMuted;
    }
    window.apis.runtimeState.uninstallReporterSingleton();

    console.log('Installing error reporter, ifMuted=', ifMuted);
    const onlyTheseErrorTypes = ifMuted
      ? [Bexer.ErrorTypes.EXT_ERROR]
      : undefined;
    console.log('only', onlyTheseErrorTypes);
    window.apis.runtimeState.uninstallReporterSingleton =
      window.Bexer.installErrorReporter({
        submissionOpts: {
          sendReportsToEmail: 'ilyaigpetrov+request-kitchen@gmail.com',
          sendReportsInLanguages: ['en', 'ru'],
          onlyTheseErrorTypes,
        },
        // Ignore errors related to ads blocking.
        ifToNotifyAboutAsync: (errType, errEvent) =>
          errEvent.error !== 'net::ERR_PROXY_CONNECTION_FAILED'
          && !(errEvent.details || '').includes('EVENT_'),
      });

  };

  installReporterSingleton();

  if (window.apis.platform.ifFirefox) {
    chrome.browserAction.setBadgeTextColor({
      color: '#ffffff',
    });
    chrome.browserAction.setPopup({
        popup: chrome.extension.getURL('./pages/popup/index.html'),
      },
      Bexer.Utils.workOrDie(),
    );
  } else {
    // Chromium-like.
    // Disabling to enable context menu on both left and right buttons.
    chrome.browserAction.onClicked.addListener(Bexer.Utils.workOrDie(
      () => {
        chrome.browserAction.disable();
        alert('Click one more time, please.');
      }
    ));
    chrome.browserAction.disable();
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
