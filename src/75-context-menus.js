'use strict';

{

  const chromified = Bexer.Utils.chromified;

  let seqId = 0;

  const createMenuLinkEntry = (item) => {

    const id = (++seqId).toString();

    chrome.contextMenus.create({
      id: id,
      title: item.title,
      contexts: ['browser_action'],
    }, chromified((err) => {

      if(err) {
        console.warn('Context menu error ignored:', err);
      }

    }));

    chrome.contextMenus.onClicked.addListener((info, tab) => {

      if(info.menuItemId === id) {
        if (item.tab2url) {
          Promise.resolve( item.tab2url( tab ) )
            .then( (url) => chrome.tabs.create({url: url}) );
          return;
        }
        item.clickHandler(tab);
      }

    });

  };

  window.apis.menus.getItemsAsArray().forEach(createMenuLinkEntry);

}
