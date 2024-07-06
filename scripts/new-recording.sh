#!/bin/bash
#env: STREAM_URL RELAY_PORT WEB_BASE RADIO_APP STATION_ID STATION_NAME STATION_URL APP_ROOT WEB_ROOT DELAY OGG_BITRATE OVERLAP XS MP3_MIN_LEN
LOG_FILE="$APP_ROOT/log/streamripper"-cron.log
PID_FILE="$APP_ROOT/run/$STATION_ID"_recording.pid
cd "$WEB_ROOT" || exit 1
BASE_URL="$WEB_BASE/$STATION_ID"
# $1: HHMM-HHMM (timeslot begin-end, eg. 0600-0900)
new_rec="$(date +%w)/$1" # 6/0600-0900
timeslot="${1:0:2}:${1:2:2} - ${1:5:2}:${1:7:2}" # '06:00 - 09:00'
# $2: 'the name of the recording'
artist="${2/&/\&}" # escape '&' for proper replacment with sed
# $3: if set, override the configured recording overlap
OVERLAP=${3:-$OVERLAP} # seconds to continue recording after timeslot ends

# offset buffering to sync playlist with broadcast time
[ ${DELAY:-0} -gt 0 ] && sleep $DELAY

prev_rec=$(cat "$APP_ROOT/var/recording" 2> /dev/null)
if [ "$new_rec" == "$prev_rec" ]; then # exit early
	echo -e "[$new_rec] Recording of '$artist' already active, skipping" | tee >(cat 1>&2) | ts '%F %T' >> "$LOG_FILE"
	exit 2
fi
# init
old_pid=$(cat "$PID_FILE" 2> /dev/null)
start_time=$(date +'%d.%m.%Y %H:%M:00')
# determine URL of local relay stream
relay_url="http://localhost:$RELAY_PORT/"
host_offset=$(dirname "$STREAM_URL" | wc -c)
[ $host_offset -gt 6 ] && relay_url="${relay_url}${STREAM_URL:$host_offset}"
# set recording time limit: timeslot duration + overlap
rec_begin=$(date -ud "1970-01-01 ${timeslot:0:5}" +%s)
rec_limit=$(bc <<<"${timeslot:8:2} * 3600 + ${timeslot:11:2} * 60 - $rec_begin + $OVERLAP")
[ $rec_limit -gt 0 ] || rec_limit=$(bc <<<"$rec_limit + 24 * 3600")

echo -e "[$new_rec] Record '$artist' (duration: $(date -ud @${rec_limit} +'%H:%M'))" | ts '%F %T' >> "$LOG_FILE" &
# remove old files
rm -f "$new_rec".*.{mp3,ogg,cue,index} &
[ -n "$old_pid" ] && mv "$PID_FILE" "$PID_FILE"~
# update current track info
song=$(tail -n +3 nowplaying.utf8 2> /dev/null)
echo -en "${artist}\n${timeslot}\n${song}" > nowplaying.utf8
echo "parseMusic({\"$STATION_ID\": {
	\"name\": \"$STATION_NAME\",
	\"artist\": \"$(sed 's|"|\\"|g' <<<"$artist")\",
	\"title\": \"$(sed 's|"|\\"|g' <<<"$song")\",
}});" > parsemusic.js
wait # until old files are removed

# initialize recording playlist
truncate -s 0 "$new_rec".{txt,parts} && echo -n "$new_rec" > "$APP_ROOT/var/recording" &
# add separator to daily playlist
pl_separator="$APP_ROOT/templates/playlist".txt.separator
if [ -r "$pl_separator" ]; then
	sed -e "s|#gettitle|$artist|" -e "s|#gettimeslot|$timeslot|" "$pl_separator" >> playlists/$(date +"%Y_%m_%d").txt
else
	echo -e ">>===============<<\n>> $timeslot << $artist\n>>===============<<" >> playlists/$(date +"%Y_%m_%d").txt
fi

# start recording (default streamripper configuration is in ~/.config/streamripper/streamripper.ini)
SR_OPT='--quiet --stderr --codeset-metadata=windows-1252 --codeset-id3=UTF-8 -i -o never -k 0 -A -s'
exec -a "streamripper-${STATION_ID}_$1" streamripper "$relay_url" -l $rec_limit $SR_OPT $XS -w "$APP_ROOT/etc/parse_rules.txt" -d "$WEB_ROOT" -a "${new_rec}.%q" |& sed '/^$/d' | ts '%F %T' >> "$LOG_FILE" &
# assume ((PID - 2)) is the PID of the first process in the pipe (streamripper)
new_pid=$(( $! - 2 ))

# add current track (skip if track changed while recording was starting)
[ -s "$new_rec".txt ] || echo "$start_time … $song" > "$new_rec".txt
# set recording tags
echo -e "DATE=$(date +%F)\nTITLE=$artist\nALBUM=$STATION_NAME ~ $(date +"%A $timeslot (%d.%m.%Y)")" > "$new_rec".tag

# wait for $OVERLAP seconds if previous recording is running before stopping it
if kill -0 $old_pid 2> /dev/null; then
	sleep $OVERLAP && kill $old_pid 2> /dev/null && sync &
	prev_id=$!
else
	rm -f "$PID_FILE"~
fi

sleep 25
# check new recording status
if kill -0 $new_pid 2> /dev/null; then
	(umask 066 && echo $new_pid > "$PID_FILE")
else
	echo -e "[$new_rec] Streamripper (pid: $new_pid) failed to start" | ts '%F %T' >> "$LOG_FILE"
fi

# previous recording stopped
[ -n "$prev_id" ] && wait $prev_id && rm "$PID_FILE"~
# temporary recording html file
rec_html="$APP_ROOT/var/recording".html

if [ -n "$prev_rec" ]; then # finalize previous recording
	base_ts=$(date -r "$prev_rec".tag +'%s.%N')
	echo "[$prev_rec] Finalize recording" | ts '%F %T' >> "$LOG_FILE" &

	# make the recording streamable right away
	ln -sf "${prev_rec##*/}".0000.mp3 "$prev_rec".mp3
	rm -f "$prev_rec".ogg

	# create recording html playlist
	echo "<pre id='playlist' class='playlist'>" >> "$rec_html"
	playlist="$(tail -n +2 "$new_rec".txt | LC_COLLATE=C sort -d "$prev_rec".{txt,parts} "$new_rec".parts - | cut -c 21-)"

	[ -s "$prev_rec".parts ] || rm "$prev_rec".parts
	shopt -s nullglob
	rec_parts=()
	basetime=$(date -d @${base_ts} +'%F %T.%N')

	# metadata info
	datetime=$(date -d @${base_ts} +'%Y%d%m%H%M')
	tyer=${datetime:0:4} # TYER    Year (YYYY) [v2.3]
	tdat=${datetime:4:4} # TDAT    Date (DDMM) [v2.3]
	time=${datetime:8:4} # TIME    Time (HHMM) [v2.3]
	woaf="$BASE_URL/$prev_rec".html # WOAF    Official audio file webpage
	trsn="$STATION_NAME" # TRSN    Internet radio station name
	wors="$STATION_URL" # WORS    Official internet radio station homepage

	for mp3 in "$prev_rec".0*.mp3; do
		# fix garbage at beginning and end
		mp3val "$mp3" -f -t -nb -si -l"$LOG_FILE" > /dev/null
		tlen=$(soxi -D "$mp3") # duration in seconds (float)
		fname="${mp3/%.mp3}" # filepath without extension
		# generate index from cue data
		index="$(grep -aF 'INDEX 01' "$fname".cue | sed -e 's/^.*01 //' -e 's/:00$//')"
		count=$(wc -l <<<"$index")

		if [ ${tlen/%.*/999} -lt ${MP3_MIN_LEN:-1000} ]; then
			(echo -n "Length ($tlen) below limit: " | ts '%F %T' && rm -v "$mp3") >> "$LOG_FILE"
		else
			rec_parts+=($fname)
			paste <(echo "$index") <(head -${count} <<<"$playlist") > "$fname".index

			if [ -z "$start_ts" ]; then # .0000
				start_ts=$(date -d "${basetime:0:16}:00" +%s)
			else # .000N
				start_ts=$(bc <<<"$(date -r "$mp3" +'%s.%N') - $tlen - ${basetime:17}")
				echo -e "</pre><pre id='playlist.${fname:12}' class='playlist'>" >> "$rec_html"
			fi
			# transform index to absolute timestamps
			index="$(sed "s/:/ * 60 + $start_ts + /" <<<"$index" | bc | sed 's/^/@/' | date -f - +'%d.%m.%Y %T')"
			paste -d' ' <(echo "$index") <(head -${count} <<<"$playlist") >> "$rec_html"

			# convert to miliseconds (int)
			tlen=$(bc <<<"scale=0; $tlen * 1000/1") # TLEN    Length (ms)
			tsiz=$(stat --format='%s' "$mp3") # TSIZ    Size (bytes, without metadata)
			# add MP3 tags
			id3v2 --id3v2-only --TSIZ $tsiz --TLEN $tlen --TYER $tyer --TDAT $tdat --TIME $time --TRSN "$trsn" --WOAF "$woaf" --WORS "$wors" "$mp3"
		fi

		# remaining playlist
		playlist="$(tail -n +$((++count)) <<<"$playlist")"
	done

	echo "</pre><script src='https:$WEB_BASE/js/trackplayer.js'></script>" >> "$rec_html"
	# add recording html footer
	dl_filename=$(date -d @${base_ts} +%F)_$(basename "$prev_rec")
	sed -e "s|#getbasepath|$prev_rec|g" -e "s|#getdlname|$dl_filename|g" -e "s|#getnexttitle|$artist|" \
		-e "s|#getnextdate|$(date +%A), $timeslot|" -e "s|#getnextbasepath|$new_rec|g" \
		"$APP_ROOT/templates/recording".html.footer >> "$rec_html"
	# publish the recording html page
	mv "$rec_html" "$prev_rec".html

	for fname in "${rec_parts[@]}"; do
		# create corresponding ogg media
		ffmpeg -i "$fname".mp3 -nostdin -nostats -hide_banner -loglevel level+warning -f s16le -acodec pcm_s16le - 2>> "$LOG_FILE" | nice oggenc --quiet --raw --ignorelength --utf8 --comment "ORGANIZATION=$STATION_NAME" --comment="PUBLISHER=radio.spodeli.org" --comment="DESCRIPTION=$woaf" --bitrate=${OGG_BITRATE:-192} --output="$fname".ogg -
		#lame -t --quiet --decode "$mp3" - | nice oggenc $ogg_opts --output="${mp3/%mp3/ogg}".ogg -
		vorbiscomment --append --raw --commentfile "$prev_rec".tag "$fname".ogg
	done

	#du --si --time=ctime "$prev_rec".*.{mp3,ogg} >> "$LOG_FILE"
	ls -go --si --full-time "$prev_rec".*.{mp3,ogg} >> "$LOG_FILE"

	rename --force --filename 's/\.0000//' "$prev_rec".0000.*
fi

# prepare templates for the new recording
sed -e "s|#gettitle|$artist|" -e "s|#getdate|$(date +'%A, %e %B %Y')|" \
	-e "s|#gettimeslot|$timeslot|" -e "s|#getbasepath|$new_rec|g" \
	"$APP_ROOT/templates/recording".html.header > "$rec_html"

exit
