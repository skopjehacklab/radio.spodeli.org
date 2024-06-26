var d = document, wl = window.location; // for minifying

d.addEventListener('DOMContentLoaded', function () {
	var track_index = -1;
	var pl_time = -1;
	var playlist = new Array();
	var maintitle = " | " + d.title;
	var display_time = d.createElement("span");
	var pre_playlist = d.getElementById("playlist");
	var domPlayer = d.getElementById("recordedstream0");
	var domFailed = d.createElement("pre");
	var rec_datetime; // start of first track in playlist

	var initPlaylist = function () {
		var diff = 0;
		var rows = pre_playlist.textContent.split('\n'); // last row is empty
		var richPlaylist = d.createElement("pre");
		richPlaylist.title = "Клик врз трака за директен пристап";
		var extraTracks = "";

		for (var i = 0; i < rows.length - 1; i++) {
			var datetimeparts = rows[i].split(' ', 2);
			if (i === 0) {
				rec_datetime = parseDate(datetimeparts);
			}
			else {
				diff = (parseDate(datetimeparts) - rec_datetime) / 1000;
				datetimeparts[0] = "\n" + datetimeparts[0];
			}

			if (diff < domPlayer.duration) {
				playlist.push([diff, datetimeparts[0], datetimeparts[1], rows[i].slice(20)]);
			}
			else {
				extraTracks += rows[i] + " ×\n";
			}
		}

		for (var i = 0; i < playlist.length; i++) {
			var htmlTrack = d.createElement("span");
			htmlTrack.title = "#" + playlist[i][0];
			var duration = (i + 1 < playlist.length ? playlist[i + 1][0] : domPlayer.duration >> 0) - playlist[i][0];
			playlist[i].push(['(', duration < 60 ? duration : formatDuration(duration), ')'].join(''));
			htmlTrack.textContent = playlist[i].slice(1).join(' ');
			htmlTrack.onclick = seekTrack;
			richPlaylist.appendChild(htmlTrack);
		}
		pre_playlist.parentNode.replaceChild(richPlaylist, pre_playlist);
		//pre_playlist.textContent = "";
		pre_playlist = richPlaylist;

		if (typeof localStorage["volume"] !== 'undefined' && localStorage["volume"] !== null) {
			domPlayer.volume = localStorage["volume"];
		}
		domPlayer.addEventListener('timeupdate', updateTrackInfo);
		domPlayer.addEventListener('volumechange', function () {
			localStorage["volume"] = this.volume;
		});

		if (wl.hash) {
			var from_time = wl.hash.slice(1);
			if (!isNaN(from_time) && from_time > 0) {
				domPlayer.currentTime = from_time < domPlayer.duration ? from_time + ".1" : domPlayer.duration;
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
			pre_playlist.parentNode.insertBefore(domFailed, pre_playlist.nextSibling);
			pre_playlist.appendChild(d.createTextNode("\n\t\t"));
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
			d.title = playlist[track_index][3] + maintitle;
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
		var track, track_dom;
		if (track_index > -1) {
			track_dom = pre_playlist.children[track_index];
			track_dom.textContent = playlist[track_index].slice(1).join(" ");
		}
		track_index = new_index;
		if (new_index > -1) {
			track = playlist[new_index];
			d.getElementById("trackname").textContent = track[3];
			track_dom = pre_playlist.children[new_index];
			track_dom.innerHTML = ['<b>', [track[1], display_time.outerHTML, "‣🔊", track[3], track[4]].join(' '), '</b>'].join('');
			display_time = track_dom.getElementsByTagName('span')[0];
			if (!domPlayer.paused) {
				d.title = track[3] + maintitle;
			}
		}
		else {
			d.title = maintitle.slice(3);
		}
	}

	var updateTrackInfo = function (event) {
		if (this.currentTime >> 0 !== pl_time) {
			pl_time = this.currentTime >> 0;
			if (track_index + 1 < playlist.length && pl_time >= playlist[track_index + 1][0]) {
				var i = track_index + 2;
				while (i < playlist.length && pl_time >= playlist[i][0]) { i++; }
				updateTrackIndex(i - 1);
			}
			else if (pl_time < playlist[track_index][0]) {
				var i = track_index - 1;
				while (pl_time < playlist[i][0]) { i--; }
				updateTrackIndex(i);
			}
			var new_time = new Date(rec_datetime.getTime() + pl_time * 1000);
			// this fails a bit when play-time date changes
			display_time.textContent = new_time.toTimeString().slice(0, 8);
			var timeleft = (playlist.length === track_index + 1 ? this.duration >> 0 : playlist[track_index + 1][0]) - pl_time;
			d.getElementById("timeleft").textContent = timeleft < 60 ? timeleft : formatDuration(timeleft);
		}
	}

	var parseDate = function (datetimeparts) { // ( %d.%m.%Y, %H:%M:%S )
		var dateparts = datetimeparts[0].split('.');
		var timeparts = datetimeparts[1].split(':');
		return new Date(dateparts[2], dateparts[1] - 1, dateparts[0], timeparts[0], timeparts[1], timeparts[2]);
	}

	var formatDuration = function (seconds) { // [[hours:]min:]sec
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
