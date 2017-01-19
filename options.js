function save_options() {
  var games = document.getElementById("hidden-games").value;
  var streams = document.getElementById("hidden-streams").value;
  var delay = document.getElementById("filter-delay").value;

  chrome.storage.sync.set({
      hiddenGames: games,
      hiddenStreams: streams,
      filterDelay: delay
  }, function() {
    var status = document.getElementById("status");
    status.textContent = "Options saved.";
    setTimeout(function() {
      status.textContent = "";
    }, 2000);
  });
}

function restore_options() {
    chrome.storage.sync.get({
      hiddenGames: "",
      hiddenStreams: "",
      filterDelay: 350
    }, function(items) {
      document.getElementById("hidden-games").value = items.hiddenGames;
      document.getElementById("hidden-streams").value = items.hiddenStreams;
      document.getElementById("filter-delay").value = items.filterDelay;
    });
}

document.addEventListener("DOMContentLoaded", restore_options);
document.getElementById("save").addEventListener("click", save_options);
