var d = document, wl = window.location; // for minifying

d.addEventListener('DOMContentLoaded', function () {
	var track_index = -1;
	var displayed = -1;
	var playlist = new Array();
	var maintitle = " | " + d.title;
	var domDisplay = d.createElement("span");
	var domPlaylist = d.getElementById("playlist");
	var domPlayer = d.getElementById("recordedstream0");
	var domFailed = d.createElement("pre");
	var start_date;
	var endTime;

	var initPlaylist = function () {
		var rows = domPlaylist.textContent.split('\n');
		//domPlaylist.textContent = "";
		domDisplay.id = "playtime";
		var extraTracks = "";
		endTime = domPlayer.seekable.end(0) >> 0;
		for (var i = 0; i < rows.length - 1; i++) {
			var datetimeparts = rows[i].split(' ', 2);
			if (i == 0) {
				start_date = parseDate(datetimeparts);
				var diff = 0;
			}
			else {
				diff = (parseDate(datetimeparts) - start_date) / 1000;
			}
			if (diff < endTime) {
				playlist[i] = [diff, rows[i].slice(20), (i ? "\n" : '') + datetimeparts[0], datetimeparts[1]];
			}
			else {
				extraTracks += rows[i] + " ×\n";
			}
		}

		var richPlaylist = d.createElement("pre");
		playlist.forEach((trackInfo, i) => {
			var htmlTrack = d.createElement("span");
			htmlTrack.title = "#" + trackInfo[0];
			var duration = (i + 1 < playlist.length ? playlist[i + 1][0] : endTime) - trackInfo[0];
			trackInfo.push(['(', duration < 60 ? duration : secondsToString(duration), ')'].join(''));
			htmlTrack.textContent = [i ? "\n" : '', rows[i], ' ', trackInfo[4]].join('');
			htmlTrack.onclick = seekTrack;
			htmlTrack.style.cursor = 'pointer';
			richPlaylist.appendChild(htmlTrack);
		});
		domPlaylist.parentNode.replaceChild(richPlaylist, domPlaylist);
		domPlaylist = richPlaylist;
		domPlaylist.title = "Клик врз трака за директен пристап";

		if (typeof localStorage["volume"] !== 'undefined' && localStorage["volume"] !== null) {
			domPlayer.volume = localStorage["volume"];
		}
		domPlayer.addEventListener('timeupdate', timeUpdate);
		domPlayer.addEventListener('volumechange', function () {
			localStorage["volume"] = this.volume;
		});

		if (wl.hash) {
			var from_time = wl.hash.slice(1);
			if (!isNaN(from_time) && from_time > 0) {
				domPlayer.currentTime = from_time < endTime ? from_time + ".1" : endTime;
			}
		}
		if (wl.search == "?play") {
			domPlayer.play();
	//		domPlayer.addEventListener('ended', function () { wl.href = d.getElementById("playnext").href + "#900"; });
			var anchors = d.getElementsByTagName("a");
			for (var i = 0; i < anchors.length; i++) {
				if (anchors[i].href && anchors[i].href.charAt(0) != "#" && anchors[i].search != "?play") {
					anchors[i].setAttribute("target", "_blank");
				}
			}
		}

		if (extraTracks) {
			domFailed.textContent = extraTracks + "\t\t";
			domFailed.title = "Нема директен пристап";
			domPlaylist.parentNode.insertBefore(domFailed, domPlaylist.nextSibling);
			domPlaylist.appendChild(d.createTextNode("\n\t\t"));
			setTimeout(function () { loadNextPart(1); }, 0);
			domPlayer.addEventListener('playing', playPart);
		}
	}

	var loadNextPart = function (partnumber) {
		var nextpart = domPlayer.cloneNode(false);
		nextpart.id = "recordedstream" + partnumber;
		nextpart.addEventListener("loadedmetadata", appendPlayer);
		nextpart.src = domPlayer.firstElementChild.src.slice(0, -3) + "000" + partnumber + (nextpart.canPlayType('audio/ogg;') ? ".ogg" : ".mp3");
		nextpart.addEventListener('volumechange', function () {
			localStorage["volume"] = this.volume;
		});

		if (wl.search == "?play") {
			nextpart.addEventListener('ended', function () {
				wl.href = d.getElementById("playnext").href + "#900";
			});
		}
	}

	var playPart = function () {
		var players = d.getElementsByTagName("audio");
		for (i = 0; i < players.length; i++) {
			if (players[i].id != this.id && !players[i].paused) {
				players[i].pause();
			}
		}
		if (this.id != "recordedstream0") {
			updateTrackIndex(-1);
		}
		else if (track_index > -1) {
			d.title = playlist[track_index][1] + maintitle;
		}
	}

	var appendPlayer = function () {
		domFailed.parentNode.insertBefore(this, domFailed);
		domFailed.parentNode.insertBefore(d.createElement("br"), domFailed);

		var partnumber = parseInt(this.id.slice(-1));
		var recording = d.getElementById("recordedstream" + partnumber);

		d.getElementById("mp3").appendChild(d.createTextNode(" | "));
		var mp3Url = d.createElement("a");
		mp3Url.href = domPlayer.firstElementChild.src.slice(0, -3) + "000" + partnumber + ".mp3";
		mp3Url.appendChild(d.createTextNode(".000" + partnumber + ".mp3"));
		d.getElementById("mp3").appendChild(mp3Url);

		d.getElementById("ogg").appendChild(d.createTextNode(" | "));
		var oggUrl = d.createElement("a");
		oggUrl.href = domPlayer.firstElementChild.src.slice(0, -3) + "000" + partnumber + ".ogg";
		oggUrl.appendChild(d.createTextNode(".000" + partnumber + ".ogg"));
		d.getElementById("ogg").appendChild(oggUrl);

		setTimeout(function () { loadNextPart(1 + partnumber); }, 0);
		recording.addEventListener('playing', playPart);
		d.getElementById("recordedstream" + (partnumber - 1)).addEventListener('ended', function () {
			if (typeof localStorage["volume"] !== 'undefined' && localStorage["volume"] !== null) {
				recording.volume = localStorage["volume"];
			}
			recording.play();
		});
		if (typeof localStorage["volume"] !== 'undefined' && localStorage["volume"] !== null) {
			setTimeout(function () {
				recording.volume = localStorage["volume"];
			}, 99);
		}
	}

	var seekTrack = function () {
		var seconds = this.title.slice(1);
		domPlayer.currentTime = seconds + ".1";
		wl.hash = seconds;
		if (domPlayer.paused) {
			domPlayer.play();
		}
	}

	var updateTrackIndex = function (new_index) {
		var track = playlist[track_index];
		if (track_index > -1) {
			domPlaylist.children[track_index].textContent = [track[2], track[3], track[1], track[4]].join(" ");
		}
		track_index = new_index;
		if (new_index > -1) {
			track = playlist[new_index];
			d.getElementById("trackinfo").innerHTML = ['<b>', track[1], '</b> <small>[ -<span id="timeleft"></span> ]</small>'].join('');
			domPlaylist.children[track_index].innerHTML = ['<b>', [track[2], domDisplay.outerHTML, "‣🔊", track[1], track[4]].join(' '), '</b>'].join('');
			if (!domPlayer.paused) {
				d.title = track[1] + maintitle;
			}
		}
		else {
			d.title = maintitle.slice(3);
		}
	}

	var timeUpdate = function () {
		if (this.currentTime >> 0 != displayed) {
			displayed = this.currentTime >> 0;
			if (track_index + 1 < playlist.length && displayed >= playlist[track_index + 1][0]) {
				var i = track_index + 2;
				while (i < playlist.length && displayed >= playlist[i][0]) { i++; }
				updateTrackIndex(i - 1);
			}
			else if (displayed < playlist[track_index][0]) {
				var i = track_index - 1;
				while (displayed < playlist[i][0]) { i--; }
				updateTrackIndex(i);
			}
			var new_time = new Date(start_date.getTime() + displayed * 1000);
			d.getElementById("playtime").textContent = new_time.toTimeString().slice(0, 8);
			var timeleft = (playlist.length === track_index + 1 ? endTime : playlist[track_index + 1][0]) - displayed;
			d.getElementById("timeleft").textContent = timeleft < 60 ? timeleft : secondsToString(timeleft);
		}
	}

	var parseDate = function (datetimeparts) {
		var dateparts = datetimeparts[0].split('.');
		var timeparts = datetimeparts[1].split(':');
		return new Date(dateparts[2], dateparts[1] - 1, dateparts[0], timeparts[0], timeparts[1], timeparts[2]);
	}

	var secondsToString = function (seconds) {
		if (seconds < 3600) {
			var duration = [~~(seconds / 60)]; // minutes
		}
		else {
			var duration = [~~(seconds / 3600)]; // hours
			var minutes = ~~(seconds / 60) % 60;
			duration.push(minutes < 10 ? '0' + minutes : minutes);
		}
		seconds = seconds % 60;
		duration.push(seconds < 10 ? '0' + seconds : seconds);
		return duration.join(':');
	}

	domPlayer.readyState > 0 ? initPlaylist() : domPlayer.addEventListener('loadeddata', initPlaylist);
});
