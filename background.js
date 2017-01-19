var filter_delay = 350;

chrome.storage.sync.get({
  filterDelay: 350
}, function(items) {
  filter_delay = items.filterDelay;
});

// Icon clicked
chrome.browserAction.onClicked.addListener(function(tab) {
  TriggerFilters();
});

// Stream data
chrome.webRequest.onCompleted.addListener(function(details) {
  setTimeout(function() {
    TriggerFilters();
  }, filter_delay);
},
{
  urls: [
    "https://api.twitch.tv/kraken/streams?limit=*",
    "https://api.twitch.tv/kraken/streams/followed?stream_type=live*"
  ]
});

// Capture userName and Twitch clientID for API calls
chrome.webRequest.onSendHeaders.addListener(function(details) {
  for (var i = 0; i < details.requestHeaders.length; ++i) {
    if (details.requestHeaders[i].name === 'Client-ID') {
      var user_regex = /\/channels\/([\w-]{1,})\/ember/;
      var user = details.url.match(user_regex)[1];

      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var activeTab = tabs[0];
        chrome.tabs.sendMessage(activeTab.id,
          {
            "message": "api_data",
            "clientID": details.requestHeaders[i].value,
            "userName": user
          })
      });
      break;
    }
  }
},
{
  urls: [
    "https://api.twitch.tv/api/channels/*/ember?on_site=1*"
  ]
},
[
  "requestHeaders"
]);

function Log(text) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    var activeTab = tabs[0];
    chrome.tabs.sendMessage(activeTab.id,
      {
        "message": "console_log",
        "text": text
      })
  });
}

function TriggerFilters() {
  SendMessage("filter_streams");
}

function SendMessage(name) {
  // Send a message to the active tab
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    var activeTab = tabs[0];
    chrome.tabs.sendMessage(activeTab.id, {"message": name});
  });
}
