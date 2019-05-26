'use strict';

{

  window.apis.menus = {

    getItemsAsObject: () => ({

      ifSwitchedOn: {
        title: 'Switched ON?',
        order: 0,
        clickHandler: ({ info, setMenuProps }) => {

          console.log(info);
        },
        menuOpts: {
          type: 'checkbox',
          checked: true,
        },
      },

      ifMuted: {
        title: 'Muted?',
        order: 1,
        clickHandler: ({ info, setMenuProps }) => {

          window.apis.setMutedTo(info.checked);
        },
        menuOpts: {
          type: 'checkbox',
          checked: false,
        },
      },

      install: {
        title: 'Install RosBlockInformer',
        clickHandler: async ({tab, setMenuProps}) => {

          const dataPromise = fetch(chrome.extension.getURL('./domains-export.txt'))
            .then((res) => res.text())
            .then((text) => (text.trim().split(/\s+/)));

          chrome.permissions.request({
            permissions: ['tabs'],
          }, Bexer.Utils.workOrDie(async (ifTabsGranted) => {

              const engine = await window.apis.pacEnginePromise;
              if (ifTabsGranted) {
                engine.addEventListener('DIRECT', ({ url }) =>

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
                  ),
                );
              }
              engine.setDataAsync(await dataPromise);
            }),
          );

        },
        order: 2,
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
