// TODO:
// - Load everything from API (except hidden streams/games)
// - Intercept userName/Client-ID from Twitch API calls
// - Fix filtering on game-specific pages (i.e. disable hidden games but keep hidden users and highlighting)
// - Create nicer options page style
// - Change style to look nice without BTTV Dark
// - (BUG) Must click icon twice to apply filter changes

var api_user_name;
var api_client_id;

var hidden_games = [];
var hidden_streams = [];
var followed_streams = [];
var followed_games = [];

var stream_highlight_color = "#14b866"; // Twitch green?
var game_highlight_color = "#6441a4"; // Twitch purple
var game_highlight_color_transparent = "rgba(100, 65, 164, .7)"; // Twitch purple
var hidden_game_color = "rgba(16, 16, 16, 0.5)";

var followed_games_read = false;

LoadOptions();

$(function () {
  $(".js-offers").remove();

  // Make sure stream list can always scroll in order to load more streams
  $(".filter-dropdown-space").css({"min-height": window.innerHeight + "px" });

  LoadOptions();
  //FilterStreams();
});

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if( request.message === "filter_streams" ) {
      LoadOptions();
      FilterStreams();
      ShowFullGameNameOnFollowed();
    }
    else if (request.message === "console_log") {
      console.log(request.text);
    }
    else if (request.message === "api_data") {
      SaveAPIInfo(request.clientID, request.userName);

      if (!followed_games_read) {
        ReadFollowedGames();
      }
    }
  }
);

function SaveAPIInfo(id, name) {
  api_client_id = id;
  api_user_name = name;
}

function FilterStreams() {
  ReadFollowedStreams();
  //console.log("Cleaning results");

  var isSpecificGamePage = window.location.href.includes("/directory/game/");

  // Iterate over stream items and determine action
  $(".streams > .infinite-scroll > .ember-view").each(function () {
    // Get meta data
    var userName = $(this).find("a.js-channel-link").text().trim();
    var gameName = $(this).find("a.boxart").attr("title");
    if (gameName === undefined)
      gameName = $(this).find("a.boxart").attr("original-title");

    // Check if highlighted
    var isHLStream = $.inArray(userName, followed_streams);
    var isHLGame = $.inArray(gameName, followed_games);

    if (isHLGame > -1)
      HighlightGame(this);

    if (isHLStream > -1)
      HighlightStream(this);

    // Check if blacklisted
    var isBLStream = $.inArray(TrimLower(userName), hidden_streams);
    var isBLGame = $.inArray(TrimLower(gameName), hidden_games);
    if (!isSpecificGamePage && (isBLStream > -1 || isBLGame > -1)) {
      StyleHiddenGame(this);

      if (isHLStream == -1) {
        $(this).hide();
        return;
      }
    }

    if (isHLStream == -1 && isHLGame == -1)
      ResetHighlight(this);

    $(this).show();
  });
}

function TrimLower(str) {
  if (str == null)
    return str;

  return str.trim().toLowerCase();
}

function StyleHiddenGame(e) {
  $(e).find(".boxart").css({
      "border-color": hidden_game_color
  });
}

function ResetHighlight(e) {
  $(e).find(".content").removeAttr("style");
  $(e).find(".boxart").removeAttr("style");
  $(e).find(".info").removeAttr("style");
  $(e).find(".js-profile-link").removeAttr("style");
}

function HighlightGame(e) {
  StyleMetaSection(e);

  $(e).find(".content").css({
    border: "2px solid " + game_highlight_color,
    backgroundColor: game_highlight_color
  });
  $(e).find(".boxart").css({
    "border-color": game_highlight_color_transparent
  });
}

function HighlightStream(e) {
  StyleMetaSection(e);

  $(e).find(".content").css({
    border: "2px solid " + stream_highlight_color,
    backgroundColor: stream_highlight_color
  });
}

function StyleMetaSection(e) {
  $(e).find(".info").attr("style", "color: black !important;");
  $(e).find(".js-profile-link").attr("style", "font: 16px normal !important;");
}

function DimFollowedOnline(e) {
  $(e).css({
    opacity: 0.4
  });
}

function HighlightFollowedOnline(e) {
  $(e).css({
    backgroundColor: game_highlight_color
  });
}

function LoadOptions() {
  chrome.storage.sync.get({
    hiddenGames: "",
    hiddenStreams: "",
    followedGames: ""
  }, function(items) {
    hidden_games = SplitArrayList(items.hiddenGames);
    hidden_streams = SplitArrayList(items.hiddenStreams);
    followed_games = items.followedGames;
  });
}

function SplitArrayList(list) {
  var items = list.split(",");

  for (var i = 0; i < items.length; i++) {
    items[i] = TrimLower(items[i]);
  }

  return items;
}

function GetUser(el) {
  var user = $(el).find(".js-search-name")[0];
  if (user == null)
    return "";

  return user.innerText;
}

function GetGame(el) {
  var game = $(el).find(".js-search-game")[0];
  if (game == null)
    return "";

    return game.innerText;
}

function ReadFollowedStreams() {
  followed_streams = [];
  $(".following-list .channel").each(function () {
    try {
      var user = GetUser(this);
      followed_streams.push(user);

      var game = GetGame(this);
      if ($.inArray(TrimLower(game), hidden_games) > -1)
        DimFollowedOnline(this);
      else if ($.inArray(game, followed_games) > -1)
        HighlightFollowedOnline(this);
    } catch (e) {
      console.log(e);
    }
  });
}

function ReadFollowedGames() {
  if (api_user_name === undefined || api_client_id === undefined)
    return;

  $.ajax({
    url: "https://api.twitch.tv/api/users/" + api_user_name + "/follows/games/live?on_site=0",
    headers:
    {
      "Client-ID": api_client_id
    }
  })
  .done(function(data) {
    if (data != null) {
      followed_games = [];
      for (var i = 0; i < data.follows.length; i++) {
        // followed_games.push({
        //   "id": data.follows[i].game._id,
        //   "name": data.follows[i].game.name
        // });
        followed_games.push(data.follows[i].game.name);
      }

      chrome.storage.sync.set({
        followedGames: followed_games
      });

      followed_games_read = true;

      FilterStreams();
    }
  })
}

function ShowFullGameNameOnFollowed() {
  $(".following-list.online .game > a").each(function() {
    $(this).attr("title", ($(this).text()));
  });
}
