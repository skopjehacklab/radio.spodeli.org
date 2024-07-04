var d = document, wl = window.location; // for minifying

d.addEventListener('DOMContentLoaded', function () {
	var track_index = -1;
	var pl_time = -1;
	var playlist = new Array();
	var maintitle = " | " + d.title;
	var pre_playlist = d.getElementById("playlist");
	var players = d.getElementsByTagName("audio");
	var domPlayer = players[0];
	var rec_datetime; // start of first track in playlist

	// interactive playlist for each recorded segment
	var initPlaylist = function () {
		this.index = -1;
		var diff = 0;
		var rows = pre_playlist.textContent.split('\n').slice(0, -1); // last row is empty
		this.tracklist = d.createElement("pre");
		this.tracklist.title = "Клик врз трака за директен пристап";
		var extraTracks = "";

		for (var i = 0; i < rows.length; i++) {
			var datetimeparts = rows[i].split(' ', 2);
			if (!rec_datetime) {
				rec_datetime = parseDate(datetimeparts);
				this.offset = 0;
			}
			else {
				diff = (parseDate(datetimeparts) - rec_datetime) / 1000;
				if (i === 0) {
					this.offset = playlist.length;
				}
				else {
					datetimeparts[0] = "\n" + datetimeparts[0];
				}
			}

			if (i === 0 || diff < playlist[this.offset][0] + this.duration) {
				playlist.push([diff, datetimeparts[0], datetimeparts[1], rows[i].slice(20)]);
			}
			else {
				extraTracks += rows[i] + " ×\n";
			}
		}

		for (var i = this.offset; i < playlist.length; i++) {
			var htmlTrack = d.createElement("span");
			htmlTrack.title = "#" + playlist[i][0];
			var duration = (i + 1 < playlist.length ? playlist[i + 1][0] : playlist[this.offset][0] + this.duration >> 0) - playlist[i][0];
			playlist[i].push(['(', duration < 60 ? duration : formatDuration(duration), ')'].join(''));
			htmlTrack.textContent = playlist[i].slice(1).join(' ');
			htmlTrack.onclick = (event) => seekTrack.call(this, event.target);
			this.tracklist.appendChild(htmlTrack);
		}

		pre_playlist.parentNode.replaceChild(this.tracklist, pre_playlist);
		pre_playlist = this.tracklist.nextSibling;

		if (pre_playlist.nodeName === "PRE" && pre_playlist.classList.contains('playlist')) {
			this.addEventListener('play', playPart);
			setTimeout((partnumber) => loadNextPart.call(this, partnumber), 0, pre_playlist.id.slice(8));
		}
		else {
			pre_playlist = null;
			this !== domPlayer && this.addEventListener('play', playPart);
		}

		if (typeof localStorage["volume"] !== 'undefined' && localStorage["volume"] !== null) {
			this.volume = localStorage["volume"];
		}
		this.addEventListener('play', updateCurrentTrackStatus);
		this.addEventListener('pause', updateCurrentTrackStatus);
		this.addEventListener('timeupdate', updateTrackInfo);
		this.addEventListener('volumechange', function () {
			if (this.volume != localStorage["volume"]) {
				localStorage["volume"] = this.volume;
				for (i = 0; i < players.length; i++) if (this !== players[i]) {
					players[i].volume = this.volume;
				}
			}
		});

		// jump to specified time
		if (wl.hash.length > 1) {
			var from_time = wl.hash.slice(1);
			if (!isNaN(from_time) && from_time > 0) {
				from_time -= playlist[this.offset][0];
				if (from_time >= 0 && from_time < this.duration) {
					domPlayer = this;
					domPlayer.currentTime = from_time + '.1';
				}
			}
		}
		if (!pre_playlist && wl.search === "?play") {
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
			var missing = d.createElement("pre");
			missing.title = "недостапни";
			missing.textContent = extraTracks;
			this.tracklist.insertAdjacentElement('afterend', missing);
		}
	};

	var loadNextPart = function (partnumber) {
		var nextpart = domPlayer.cloneNode(false);
		var base_name = domPlayer.firstElementChild.src.slice(0, -4);

		d.getElementById("mp3").appendChild(d.createTextNode(" | "));
		var mp3Url = d.createElement("a");
		mp3Url.href = [base_name, partnumber, ".mp3"].join('');
		mp3Url.appendChild(d.createTextNode(partnumber + ".mp3"));
		d.getElementById("mp3").appendChild(mp3Url);

		d.getElementById("ogg").appendChild(d.createTextNode(" | "));
		var oggUrl = d.createElement("a");
		oggUrl.href = [base_name, partnumber, ".ogg"].join('');
		oggUrl.appendChild(d.createTextNode(partnumber + ".ogg"));
		d.getElementById("ogg").appendChild(oggUrl);

		nextpart.id = "recording" + partnumber;
		nextpart.src = nextpart.canPlayType('audio/ogg;') ? oggUrl.href : mp3Url.href;
		this.insertAdjacentElement('afterend', nextpart);
		this.insertAdjacentText('afterend', ' ');

		this.addEventListener('pause', (event) => {
			if (this.currentTime === this.duration) {
				updateTrackIndex.call(this, -1);
				nextpart.currentTime = 0;
				nextpart.play();
			}
		});

		nextpart.readyState === 0 ? nextpart.addEventListener('loadedmetadata', initPlaylist) : initPlaylist.call(nextpart);
	};

	var playPart = function (event) {
		for (i = 0; i < players.length; i++) {
			if (this !== players[i]) {
				!players[i].paused && players[i].pause();
			}
			else if (this !== domPlayer) {
				domPlayer = this;
			}
		}
	};

	var seekTrack = function (target) {
		while (!target.title) { target = target.parentElement; }
		var seconds = target.title.slice(1);
		domPlayer = this;
		domPlayer.currentTime = seconds - playlist[this.offset][0] + ".1";
		wl.hash = seconds;
		if (domPlayer.paused) {
			domPlayer.play();
		}
	};

	var updateTrackIndex = function (new_index) {
		var track, track_dom;
		if (this.index !== new_index - this.offset) {
			if (this.index > -1) {
				track_dom = this.tracklist.children[this.index];
				track_dom.textContent = playlist[this.offset + this.index].slice(1).join(" ");
			}

			if (new_index > -1) {
				this.index = new_index - this.offset;
				track = playlist[new_index];
				track_dom = this.tracklist.children[this.index];
				track_dom.innerHTML = ['<b>', track[1], ' <span>', track[2], '</span> ', track.slice(3).join(' '), '</b>'].join('');
				this.display_time = track_dom.querySelector('span');
			}
			else {
				this.index = -1;
			}
		}

		if (new_index > -1 && this === domPlayer) {
			d.getElementById("trackname").textContent = playlist[new_index][3];
			if (!this.paused) {
				d.title = playlist[new_index][3] + maintitle;
			}
			track_index = new_index;
		}
	};

	var updateTrackInfo = function (event) {
		if (this.currentTime >> 0 !== pl_time - playlist[this.offset][0]) {
			pl_time = playlist[this.offset][0] + this.currentTime >> 0;
			var i = this.offset + this.index;
			if (i + 1 < playlist.length && pl_time >= playlist[i + 1][0]) {
				while (i + 1 < playlist.length && pl_time >= playlist[i + 1][0]) { i++; }
			}
			else {
				while (pl_time < playlist[i][0]) { i--; }
			}
			i !== track_index && updateTrackIndex.call(this, i);

			var new_time = new Date(rec_datetime.getTime() + pl_time * 1000);
			// this fails a bit when play-time date changes
			this.display_time.textContent = new_time.toTimeString().slice(0, 9) + (this.paused ? "᱿" : "‣🔊");
			if (this === domPlayer) {
				var timeleft = this.index + 1 === this.tracklist.childElementCount ? this.duration - this.currentTime >> 0 : playlist[track_index + 1][0] - pl_time;
				d.getElementById("timeleft").textContent = timeleft < 60 ? timeleft : formatDuration(timeleft);
			}
		}
	};

	var updateCurrentTrackStatus = function (event) {
		if (this.display_time) {
			this.display_time.textContent = this.display_time.textContent.slice(0, 9) + (this.paused ? "᱿" : "‣🔊");
		}
		if (!this.paused) {
			if (track_index > -1) {
				d.title = playlist[track_index][3] + maintitle;
			}
		}
		else if (this === domPlayer) {
			d.title = maintitle.slice(3);
		}
	};

	var parseDate = function (datetimeparts) { // ( %d.%m.%Y, %H:%M:%S )
		var dateparts = datetimeparts[0].split('.');
		var timeparts = datetimeparts[1].split(':');
		return new Date(dateparts[2], dateparts[1] - 1, dateparts[0], timeparts[0], timeparts[1], timeparts[2]);
	};

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
	};

	domPlayer.readyState > 0 ? initPlaylist.call(domPlayer) : domPlayer.addEventListener('loadedmetadata', initPlaylist);
});
