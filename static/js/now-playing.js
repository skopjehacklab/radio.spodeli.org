var d = document; // for minifying
// get station id from script path query string
var id = d.currentScript.getAttribute('src').split('?')[1];

function parseMusic(results) {
	var atParent = artistTitle.parentElement;
	var atWrapper = atParent.style;
	var nm = results[id];
	if (nm != null) {
		if (artistTitle.title !== nm["title"] || atParent.title !== nm["artist"]) {
			artistTitle.textContent = nm["artist"] + ' ~ ' + nm["title"];
			artistTitle.title = nm["title"];
			atParent.title = nm["artist"];
		}
		if (atWrapper.display === 'none') {
			atWrapper.display = '';
		}
	}
	else if (atWrapper.display !== 'none') {
		atWrapper.display = 'none';
	}
}

if (id) {
	var artistTitle = '#k103 .artist_title';
	var interval = 47137;
	var url = "//radio.spodeli.org/" + id + "/parsemusic.js";

	var wrapper = d.createElement("div");
	var script = d.createElement("script");

	var initMusic = function() {
		wrapper.id = "getscript";
		d.body.appendChild(wrapper);
		script.type = "text/javascript";
		//script.charset = "UTF-8";
	}

	var updateMusic = function() {
		while (wrapper.firstChild) {
			wrapper.removeChild(wrapper.firstChild);
		}
		script.src = url;
		jQuery('#getscript').append(script);
	}

	d.addEventListener('DOMContentLoaded', function () {
		artistTitle = d.querySelector(artistTitle);
		if (artistTitle) {
			initMusic();
			updateMusic();
			setInterval(updateMusic, interval);
		}
	});
}
