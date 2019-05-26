'use strict';

optionsButton.onclick = () => {

  chrome.runtime.openOptionsPage();
  window.close();
};
