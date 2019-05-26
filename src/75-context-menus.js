'use strict';

{

  const chromified = Bexer.Utils.chromified;

  let seqId = 0;

  const createMenuLinkEntry = (item) => {

    const id = (++seqId).toString();
    item.menuOpts = item.menuOpts || {};

    chrome.contextMenus.create({
      id,
      title: item.title,
      contexts: ['browser_action'],
      ...item.menuOpts,
    }, chromified((err) => {

      if(err) {
        console.warn('Context menu error ignored:', err);
      }

    }));

    const setMenuProps = (props, cb) => chrome.contextMenus.update(
      id,
      props,
      Bexer.Utils.workOrDie(cb),
    );

    chrome.contextMenus.onClicked.addListener((info, tab) => {

      if(info.menuItemId === id) {
        if (item.tab2url) {
          Promise.resolve( item.tab2url( tab ) )
            .then( (url) => chrome.tabs.create({url: url}) );
          return;
        }
        item.clickHandler({ info, tab, setMenuProps });
      }

    });

  };

  window.apis.menus.getItemsAsArray().forEach(createMenuLinkEntry);

}
