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
var min_followed_displayed = 10;

LoadOptions();

$(function () {
  AddStyles();

  $(".js-offers").remove();

  // Make sure stream list can always scroll in order to load more streams
  //$(".filter-dropdown-space").css({"min-height": window.innerHeight + "px" });

  // Add more placeholders to ensure stream list can always scroll
  AddPlaceholders($(".js-streams > .tower"), 15);

  LoadOptions();
  //FilterStreams();
});

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    if (request.message === "filter_streams") {
      LoadOptions();
      FilterStreams();
      ShowFullGameNameOnFollowed();
    }
    else if (request.message === "update_followed_games") {
      GetLongerGamesList(50);
      //SortGamesList();
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
  FixGameImages();
  //console.log("Cleaning results");

  var isSpecificGamePage = window.location.href.includes("/directory/game/");

  // Iterate over stream items and determine action
  $(".js-streams > .tower > .ember-view").each(function () {

    // Get rid of ads in the results...
    if ($(this).hasClass("directory-ad")) {
      $(this).remove();
      return;
    }

    // Get meta data
    var userName = $(this).find("a.js-channel-link").text().trim();
    var gameName = $(this).find("a.card__boxpin").attr("title");
    if (gameName === undefined)
      gameName = $(this).find("a.card__boxpin").attr("original-title");

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
    // Hide blacklisted streams everywhere and blacklisted games when
    // not on that game's page
    if (isBLStream > -1 || (!isSpecificGamePage && isBLGame > -1)) {
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

  FixCardMargin();
}

function FixGameImages() {
  $("a.card__boxpin").css({
    "border": "3px solid black"
  });
}

function FixCardMargin() {
  $("p.card__info").css({
    "margin-bottom": "0"
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

  $(e).find(".card__layout").css({
    border: "2px solid " + game_highlight_color,
    backgroundColor: game_highlight_color
  });
  $(e).find(".card__boxpin").css({
    "border-color": game_highlight_color_transparent
  });
}

function HighlightStream(e) {
  StyleMetaSection(e);

  $(e).find(".card__layout").css({
    border: "2px solid " + stream_highlight_color,
    backgroundColor: stream_highlight_color
  });
}

function StyleMetaSection(e) {
  $(e).find(".card__info").attr("style", "color: black !important;");
  $(e).find(".js-channel-link").attr("style", "font: 16px normal !important;");
}

function DimFollowedOnline(e) {
  $(e).css({
    opacity: 0.5,
    backgroundColor: ''
  });
  $(e).find(".sc-item__followed-channel--offline .sc-item__metadata").show();
}

function HighlightFollowedOnline(e) {
  $(e).css({
    opacity: '',
    backgroundColor: game_highlight_color
  });
  $(e).find(".sc-item__followed-channel--offline .sc-item__metadata").show();
}

function StyleOffline(e) {
  $(e).css({
    opacity: 0.5,
    backgroundColor: ''
  });
  $(e).find(".sc-item__followed-channel--offline .sc-item__metadata").hide();
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
  var user = $(el).find(".sc-item__title")[0];
  if (user == null)
    return "";

  return user.innerText;
}

function GetGame(el) {
  var game = $(el).find(".sc-item__metadata--1")[0];
  if (game == null)
    return "";

    return game.innerText;
}

function ReadFollowedStreams() {
  ShowMoreFollowedStreams();
  SortFollowedList();

  followed_streams = [];
  $(".sc-channels__live > .ember-view").each(function () {

    // Remove game from offline channels
    if ($(this).find(".sc-item__followed-channel--offline").length > 0) {
      StyleOffline(this);
      return;
    }

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

function GetLongerGamesList(limit) {
  if (api_user_name === undefined || api_client_id === undefined)
    return;

  $.ajax({
    url: "https://api.twitch.tv/api/users/" + api_user_name + "/follows/games/live?on_site=1&limit=" + limit,
    headers: {
      "Client-ID": api_client_id
    }
  }).done(function (data) {
    ReplaceGamesList(data);
  });
}

function ReplaceGamesList(data) {
  var gameItemTemplate = '<div id="{EMBER_ID}" class="js-directory-game ember-view"><div class="game item">\
    <a title="{GAME_NAME}" href="/directory/game/{GAME_NAME}" data-tt_content_index="2" data-tt_content="followed_game" data-tt_medium="twitch_following" class="game-item clearfix" data-ember-action="" data-ember-action-{EMBER_ID}="{EMBER_ID}">\
      <div class="aspect aspect--3x4">\
        <img src="{BOX_ART_URL}" data-placeholder="https://static-cdn.jtvnw.net/ttv-boxart/404_boxart.png" class="aspect__fill">\
      </div>\
      <div class="meta">\
        <p class="title">\
          {GAME_NAME}\
        </p>\
        <p class="info">\
          {VIEWER_COUNT} viewers\
          <span style="float: right;">{CHANNEL_COUNT} channels</span>\
        </p>\
      </div>\
    </a>\
  </div>\
  </div>';

  var $games = $('.js-games > div'),
  	$gamesList = $games.children('div');

  // Remove current list
  $gamesList.detach();

  // Add new list of games
  var emberId = 2000;
  for (var i = 0; i < data.follows.length; i++) {
    var dataItem = data.follows[i];
    var gameItem = gameItemTemplate.replace(new RegExp('{GAME_NAME}', 'g'), dataItem.game.name)
                                   .replace(new RegExp('{EMBER_ID}', 'g'), emberId)
                                   .replace(new RegExp('{BOX_ART_URL}', 'g'), dataItem.game.box.large)
                                   .replace(new RegExp('{VIEWER_COUNT}', 'g'), dataItem.viewers)
                                   .replace(new RegExp('{CHANNEL_COUNT}', 'g'), dataItem.channels);
    $games.append(gameItem);
    emberId++;
  }

  AddPlaceholders($games, 10);
}

function SortGamesList() {
  var $games = $('.js-games > div'),
  	$gamesList = $games.children('div');

  $gamesList.sort(function(a,b){
    var comparison = 0;
    try {

      // Check for placeholder items and make sure they stay at the end
      if ($(a).hasClass("tower_placeholder"))
        return 1;

      if ($(b).hasClass("tower_placeholder"))
        return -1;

      // Sort games
      var aViewers = parseInt($(a).find(".meta .info").text().replace(',', '')),
    		bViewers = parseInt($(b).find(".meta .info").text().replace(',', ''));

      comparison = CompareReverse(aViewers, bViewers);
    }
    catch (e) {
      console.log(e);
    }

  	return comparison;
  });

  $gamesList.detach()
    .appendTo($games);
}

function CompareReverse(a, b) {
  var result = 0;

  if (a > b
    || (!isNaN(a) && isNaN(b))) {
    result = -1;
  }
  if (a < b
    || (isNaN(a) && !isNaN(b))) {
    result = 1;
  }

  return result;
}

function ShowMoreFollowedStreams() {
  // Show more followed streams if too few on screen
  if ($(".sc-channels__live > .ember-view").length < min_followed_displayed) {
    $(".sc-channels__live").find(".sc-toggle").click();
  }
}

function SortFollowedList() {
  var $followed = $('.sc-channels__live'),
  	$followedList = $followed.children('.ember-view'),
    loadMore = $(".sc-channels__live").find(".sc-toggle");

  $followedList.sort(function(a,b){
    var comparison = 0;
    try {
      // Sort games
      var aViewers = parseInt($(a).find(".sc-item__metadata--2").text().replace(',', '')),
    		bViewers = parseInt($(b).find(".sc-item__metadata--2").text().replace(',', ''));

      comparison = CompareReverse(aViewers, bViewers);
    }
    catch (e) {
      console.log(e);
    }

  	return comparison;
  });

  // Replace list with sorted list
  $followedList.detach()
    .appendTo($followed);

  // Add load more to end of list
  $(loadMore).appendTo($followed);
}

function AddPlaceholders(element, numToAdd) {
  for (var i = 0; i < numToAdd; i++) {
    element.append('<div class="tower_placeholder"></div>');
  }
}

function AddStyles() {
  $("<style type='text/css'> \
      .card__title a:hover, .card__info a:hover { color: white !important; }\
     </style>")
    .appendTo("head");
}
