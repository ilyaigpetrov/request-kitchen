'use strict';

{

  window.apis.menus = {

    getItemsAsObject: () => ({

      googleTranslate: {
        title: 'Install RosBlockInformer',
        clickHandler: async (tab) => {

          const data = await fetch(chrome.extension.getURL('./domains-export.txt'))
            .then((res) => res.text())
            .then((text) => (text.trim().split(/\s+/)));
          window.apis.pacEnginePromise.then(
            (engine) => {

              engine.addEventListener('DIRECT', ({ url }) => {

                chrome.tabs.query({
                    url: `${url}*`,
                  },
                  Bexer.Utils.workOrDie((tabs) =>
                    tabs.forEach((tab) => {

                      chrome.browserAction.setBadgeText({
                        tabId: tab.id,
                        text: '⇅',
                      });
                      chrome.browserAction.setTitle({
                        tabId: tab.id,
                        title: 'Directly connected to this site.',
                      });
                    }),
                  ),
                );
              });
              engine.setDataAsync(data);
            },
          );
        },
        order: 0,
      },

      /*
      hostTracker: {
        title: 'Из кэша Google',
        getUrl: (blockedUrl) => 'http://webcache.googleusercontent.com/search?q=cache:' + blockedUrl,
        order: 1,
      },

      archiveOrg: {
        title: 'Из архива archive.org',
        getUrl: (blockedUrl) => 'https://web.archive.org/web/*//*' + blockedUrl,
        order: 2,
      },

      otherUnblock: {
        title: 'Разблокировать по-другому',
        getUrl: (blockedUrl) => ('https://rebrand.ly/ac-unblock#' + blockedUrl),
        order: 3,
      },

      antizapretInfo: {
        title: 'Сайт в реестре блокировок?',
        getUrl: (blockedUrl) => 'https://antizapret.info/index.php?search=' + new URL(blockedUrl).hostname,
        order: 4,
      },

      support: {
        title: 'Документация / Помощь / Поддержка',
        getUrl: (blockedUrl) => 'https://git.io/ac-wiki',
        order: 99,
      },
      */

    }),

    getItemsAsArray: function() {

      const itemsObj = this.getItemsAsObject();
      return Object.keys(itemsObj).reduce((acc, key) => {

        acc.push(itemsObj[key]);
        return acc;

      }, [])
        .sort((a, b) => a.order - b.order);

    },

  };

}
