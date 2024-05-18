var track_index = -1;
var displayed = -1;
var playlist = new Array();
var maintitle = " | " + window.document.title;
var domDisplay = document.createElement("span");
var domPlaylist = document.getElementById("playlist");
var domPlayer = document.getElementById("recordedstream0");
var start_date;
var endTime;
var initPlaylist = function() {
	var rows = domPlaylist.textContent.substr(1).split('\n');
	//domPlaylist.textContent = "";
	domDisplay.id = "displaytime";
	var extraTracks = "";
	endTime = domPlayer.seekable.end(0) >> 0;
	for (var i = 0; i < rows.length - 1; i++) {
		var datetimeparts = rows[i].split(' ', 2);
		if (i == 0) {
	  		start_date = parseDate(datetimeparts);
			var diff = 0;
		}
		else
			diff = (parseDate(datetimeparts) - start_date) / 1000;
		if (diff < endTime) {
			playlist[i] = [diff, rows[i].substr(20), "\n" + datetimeparts[0], datetimeparts[1]];
		}
		else
			extraTracks += rows[i] + " ×\n";

	}
	var richPlaylist = document.createElement("pre");
	playlist.forEach((trackInfo, index) => {
		var htmlTrack = document.createElement("span");
		htmlTrack.id = trackInfo[0]; // diff
		htmlTrack.title = "#" + htmlTrack.id;
		var duration = (index+1 < playlist.length ? playlist[index+1][0] : endTime) - trackInfo[0];
		trackInfo.push('(' + secondsToString(duration) + ')');
		htmlTrack.textContent = ["\n", rows[index], ' ', trackInfo[4]].join('');
		htmlTrack.onclick = seekTrack;
		htmlTrack.style.cursor = 'pointer';
		richPlaylist.appendChild(htmlTrack);
	});
	domPlaylist.parentNode.replaceChild(richPlaylist, domPlaylist);
	domPlaylist = richPlaylist;
	domPlaylist.title = "Клик врз трака за директен пристап";
	if (typeof localStorage["volume"] !== 'undefined' && localStorage["volume"] !== null)
		domPlayer.volume = localStorage["volume"];
	domPlayer.addEventListener('timeupdate', timeUpdate);
	domPlayer.addEventListener('volumechange', function() { localStorage["volume"] = this.volume; });
	if (window.location.hash) {
		var from_time = window.location.hash.substr(1);
		if (!isNaN(from_time) && from_time > 0) {
			domPlayer.currentTime = from_time < endTime ? from_time + ".1" : endTime;
		}
	}
	if (window.location.search == "?play") {
		domPlayer.play();
//		domPlayer.addEventListener('ended', function() { window.location.href = document.getElementById("playnext").href + "#905"; });
		var anchors = document.getElementsByTagName("a");
		for (var i = 0; i < anchors.length; i++)
			if (anchors[i].href && anchors[i].href.charAt(0) != "#" && anchors[i].search != "?play")
				anchors[i].setAttribute("target", "_blank");
	}
	if (extraTracks) {
		var domFailed = document.createElement("pre");
		domFailed.id = "additionaltracks";
		domFailed.textContent = extraTracks + "\t\t";
		domFailed.title = "Нема директен пристап";
		domPlaylist.parentNode.insertBefore(domFailed, domPlaylist.nextSibling);
		domPlaylist.appendChild(document.createTextNode("\n\t\t"));
		setTimeout(function () { loadNextPart(1); }, 0);
		domPlayer.addEventListener('playing', playPart);
	}
}
var loadNextPart = function(partnumber) {
	var nextpart = domPlayer.cloneNode(false);
	nextpart.id = "recordedstream" + partnumber;
	nextpart.addEventListener("loadedmetadata", appendPlayer);
	nextpart.src = domPlayer.firstElementChild.src.slice(0,-3) + "000" + partnumber + (nextpart.canPlayType('audio/ogg;') ? ".ogg" : ".mp3");
	nextpart.addEventListener('volumechange', function() { localStorage["volume"] = this.volume; });
	if (window.location.search == "?play")
		nextpart.addEventListener('ended', function() { window.location.href = document.getElementById("playnext").href + "#905"; });
}
var playPart = function() {
	var players = document.getElementsByTagName("audio");
	for (i = 0; i < players.length; i++)
		if (players[i].id != this.id && !players[i].paused)
			players[i].pause();
	if (this.id != "recordedstream0")
		updateTrackIndex(-1);
	else if (track_index > -1)
		document.title = playlist[track_index][1] + maintitle;
}
var appendPlayer = function() {
	document.getElementById("additionaltracks").parentNode.insertBefore(this, document.getElementById("additionaltracks"));
	document.getElementById("additionaltracks").parentNode.insertBefore(document.createElement("br"), document.getElementById("additionaltracks"));
	document.getElementById("mp3").appendChild(document.createTextNode(" | "));
	document.getElementById("ogg").appendChild(document.createTextNode(" | "));
	var partnumber = parseInt(this.id.slice(-1));
	var mp3Url = document.createElement("a");
	mp3Url.href = domPlayer.firstElementChild.src.slice(0,-3) + "000" + partnumber + ".mp3";
	mp3Url.appendChild(document.createTextNode(".000" + partnumber + ".mp3"));
	document.getElementById("mp3").appendChild(mp3Url);
	var oggUrl = document.createElement("a");
	oggUrl.href = domPlayer.firstElementChild.src.slice(0,-3) + "000" + partnumber + ".ogg";
	oggUrl.appendChild(document.createTextNode(".000" + partnumber + ".ogg"));
	document.getElementById("ogg").appendChild(oggUrl);
	setTimeout(function () { loadNextPart(1 + partnumber); } , 0);
	document.getElementById("recordedstream" + partnumber).addEventListener('playing', playPart);
	document.getElementById("recordedstream" + (partnumber - 1)).addEventListener('ended', function() {
		if (typeof localStorage["volume"] !== 'undefined' && localStorage["volume"] !== null)
			document.getElementById("recordedstream" + partnumber).volume = localStorage["volume"];
		document.getElementById("recordedstream" + partnumber).play();
	});
	if (typeof localStorage["volume"] !== 'undefined' && localStorage["volume"] !== null)
		setTimeout(function () { document.getElementById("recordedstream" + partnumber).volume = localStorage["volume"]; }, 99);
}
var seekTrack = function () {
	domPlayer.currentTime = this.id + ".1";
	window.location.hash = this.id;
	if (domPlayer.paused)
		domPlayer.play();
}
var updateTrackIndex = function(new_index) {
	var track = playlist[track_index];
	if (track_index > -1)
		domPlaylist.children[track_index].textContent = [track[2], track[3], track[1], track[4]].join(" ");
	track_index = new_index;
	if (new_index > -1) {
		track = playlist[new_index];
		document.getElementById("trackinfo").innerHTML = track[1].bold() + ' <small>[ -<span id="timeleft"></span> ]</small>';
		domPlaylist.children[track_index].innerHTML = [track[2], domDisplay.outerHTML, "‣🔊", track[1], track[4]].join(" ").bold();
		if (!domPlayer.paused)
			document.title = track[1] + maintitle;
	}
	else
		document.title = maintitle.slice(3);
}
var timeUpdate = function() {
	if (this.currentTime >> 0 != displayed) {
		displayed = this.currentTime >> 0;
		if (track_index + 1 < playlist.length && displayed >= playlist[track_index + 1][0]) {
			var i = track_index + 2;
			while (i < playlist.length && displayed >= playlist[i][0])
				i++;
			updateTrackIndex(i - 1);
		}
		else if (displayed < playlist[track_index][0]) {
			var i = track_index - 1;
			while (displayed < playlist[i][0])
				i--;
			updateTrackIndex(i);
		}
		var new_time = new Date(start_date.getTime() + displayed * 1000);
		document.getElementById("displaytime").textContent = new_time.toTimeString().substr(0,8);
		var timeleft = (playlist.length === track_index + 1 ? endTime : playlist[track_index + 1][0]) - displayed;
		document.getElementById("timeleft").textContent = secondsToString(timeleft);
	}
}
var parseDate = function (datetimeparts) {
	var dateparts = datetimeparts[0].split('.');
	var timeparts = datetimeparts[1].split(':');
	return new Date(dateparts[2], dateparts[1] - 1, dateparts[0], timeparts[0], timeparts[1], timeparts[2]);
}
var secondsToString = function (seconds) {
	var duration = [];
	var minutes = ~~(seconds / 60);
	var seconds = seconds % 60;
	if (minutes) {
		var hours = ~~(minutes / 60);
		if (hours) {
			minutes = minutes % 60;
			duration.push(hours);
			duration.push(minutes < 10 ? '0' + minutes : minutes);
		} else {
			duration.push(minutes);
		}
		duration.push(seconds < 10 ? '0' + seconds : seconds);
	} else {
		duration.push(seconds);
	}
	return duration.join(':');
}
domPlayer.readyState > 0 ? initPlaylist() : domPlayer.addEventListener('loadeddata', initPlaylist);
