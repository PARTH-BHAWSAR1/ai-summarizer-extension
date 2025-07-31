chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["APIKEY"], (result) => {
    if (!result || !result.APIKEY) {
      chrome.tabs.create({
        url: chrome.runtime.getURL("options.html")
      });
    }
  });
});
