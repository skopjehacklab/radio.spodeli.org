var insertPlaylists = function(expanded) {
	document.querySelectorAll('#programa ul li').forEach(function(item) {
		var plButton = document.createElement("span");
		plButton.style.cursor = 'pointer';
		plButton.title = "плеј-листа";
		plButton.appendChild(document.createTextNode("…"));
		plButton.onclick = function () {
			if (this.style.textDecoration !== 'underline') {
				this.style.fontWeight = 'bold';
				this.style.textDecoration = 'underline';
				this.nextElementSibling.style.display = 'none';
			} else {
				this.style.fontWeight = 'normal';
				this.style.textDecoration = 'none';
				this.nextElementSibling.style.display = 'block';

				if (!this.nextElementSibling.childNodes.length) {
					var plUrl = this.previousElementSibling;
					var playDiv = this.nextElementSibling;
					fetch(plUrl.href.replace(".html", ".txt"), {
						method: "GET",
						headers: { // prevent loading from cache
							'If-Modified-Since': 'Sat, 16 Jun 2012 19:43:31 GMT'
						}
					})
					.then(function(response) {
						if (response.ok) {
							return response.text();
						}
						throw new Error('Network response was not ok.');
					})
					.then(function(data) {
						var playList = document.createElement("pre");
						var rows = data.split('\n');
						for (var i = 0; i < rows.length - 1; i++) {
							var datetimeparts = rows[i].split(' ', 2);
							var htmlTrack = document.createElement("span");

							if (i == 0) {
								var start_date = parseDate(datetimeparts);
								var diff = 0;
								htmlTrack.textContent = rows[i];
							} else {
								diff = (parseDate(datetimeparts) - start_date) / 1000;
								htmlTrack.textContent = "\n" + rows[i];
							}

							htmlTrack.id = plUrl.href + "?play#" + diff;
							htmlTrack.onclick = function() {
								window.location.href = this.id;
							};
							htmlTrack.style.cursor = 'pointer';
							playList.appendChild(htmlTrack);
						}

						playDiv.appendChild(playList);
					})
					.catch(function(error) {
						console.error('Fetch operation failed:', error);
					});
				}
			}
		};
		plButton.style.textDecoration = 'underline';
		plButton.style.fontWeight = 'bold';
		item.appendChild(plButton);
		var playListDiv = document.createElement("div");
		item.appendChild(playListDiv);
		if (expanded) plButton.click();
	});
}

var parseDate = function (datetimeparts) {
	var dateparts = datetimeparts[0].split('.');
	var timeparts = datetimeparts[1].split(':');
	return new Date(dateparts[2], dateparts[1] - 1, dateparts[0], timeparts[0], timeparts[1], timeparts[2]);
};
