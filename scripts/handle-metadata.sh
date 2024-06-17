#!/bin/bash
#env: WEB_BASE RADIO_APP STATION_ID STATION_NAME STATION_URL APP_ROOT WEB_ROOT OGG_BITRATE TRACK_NAME MP3_MIN_LEN MP3_HIST
#LOG_FILE="$APP_ROOT/log/metadata.log"
cd "$WEB_ROOT" || exit 1

if [ -z "$1" -o -z "$2" ]; then
	song="$1$2";
else
	song="$1 - $2";
fi
# unreplace "'", "$", "`" (replaced with "|" before metadata export in streamripper)
song=$(echo "$song" | sed -e "s_|_'_g")
artist=$(head -1 nowplaying.utf8 2> /dev/null)

# find last ripped mp3
unset -v mp3
for file in mp3/*.mp3; do
	[[ $file -nt $mp3 ]] && mp3=$file
done

if [ -z "$mp3" ]; then
	[ -n "$LOG_FILE" ] && echo "no ripped mp3 files found" | ts '%F %T' >> "$LOG_FILE" #debug log
else
	## fix garbage at beginning and end
	#mp3val "$mp3" -f -t -nb -si -l"$LOG_FILE" > /dev/null
	# get duration in seconds (float)
	mp3_len=$(soxi -D "$mp3" 2> /dev/null)
	# convert to miliseconds (int)
	tlen=$(bc <<<"scale=0; $mp3_len * 1000/1") # TLEN    Length (ms)

	[ -n "$LOG_FILE" ] && echo "last ripped: $mp3 (${mp3_len/%.*})" | ts '%F %T' >> "$LOG_FILE" #debug log

	# delete file if duration is less than $MP3_MIN_LEN (default 1000) miliseconds
	if [ $tlen -lt ${MP3_MIN_LEN:-1000} ]; then
		rm "$mp3"
	# check if file was already „treated“
	elif ! id3v2 -R "$mp3" | grep -q ^WORS; then
		# add id3 tags to saved track
		#tsiz=$(stat --format='%s' "$mp3") # TSIZ    Size (bytes, without metadata)
		## set date to track air-time
		#datetime=$(date -d "$mp3_len seconds ago" +'%Y%d%m%H%M')
		# set date to track recording time
		datetime=$(date -r "$mp3" +'%Y%d%m%H%M')
		tyer=${datetime:0:4} # TYER    Year (YYYY) [v2.3]
		tdat=${datetime:4:4} # TDAT    Date (DDMM) [v2.3]
		time=${datetime:8:4} # TIME    Time (HHMM) [v2.3]
		#woaf="$WEBPATH/mp3" # WOAF    Official audio file webpage
		trsn="$STATION_NAME" # TRSN    Internet radio station name
		wors="$STATION_URL" # WORS    Official internet radio station homepage

		# TIT1    Content group description
		id3v2 --id3v2-only --TIT1 "$artist" --TLEN $tlen --TYER $tyer --TDAT $tdat --TIME $time --TRSN "$trsn" --WORS "$wors" --TRCK '' "$mp3"
		# strip ' - ' from start of filename
		[ "${mp3:4:3}" == ' - ' ] && mv "$mp3" "mp3/${mp3:7}"

	else # main recorder was restarted?
		[ -n "$LOG_FILE" ] && id3v2 -l "$mp3" >> "$LOG_FILE" #debug log
	fi
fi

basepath=$(cat "$APP_ROOT/var/recording") # 6/0600-0900
ts_offset=$(date -r "$APP_ROOT/var/recording" +'%S.%N')
ts=$(date -d "$ts_offset seconds ago" +'%s.%N')

if [ "$song" != "$(tail -n +3 nowplaying.utf8)" ]; then
	timeslot="${basepath:2:2}:${basepath:4:2} - ${basepath:7:2}:${basepath:9:2}"
	# update current track info
	echo -en "${artist}\n${timeslot}\n${song}" > nowplaying.utf8
	## escape & and "
	#songesc=$(echo "$song" | sed -e 's|&|\\\&|g' -e 's|"|\\"|g')
	#sed -e "s|#gettitle|$songesc|" -e "s|#getartist|$artist|" "$APP_ROOT/templates/parsemusic.js" > parsemusic.js
	echo "parseMusic({\"$STATION_ID\": {
	\"name\": \"$STATION_NAME\",
	\"artist\": \"$(sed 's|"|\\"|g' <<<"$artist")\",
	\"title\": \"$(sed 's|"|\\"|g' <<<"$song")\",
}});" > parsemusic.js

	# update playlist
	ts_offset=$(date -r "$APP_ROOT/var/recording" +'%S.%N')
	ts=$(date -d "$ts_offset seconds ago" +'%s.%N')
	pl_filename="playlists/$(date -d @${ts} +'%Y_%m_%d')"
	echo "$(date -d @${ts} +'%d.%m.%Y %H:%M:%S') $song" | tee -a "$basepath".txt >> "$pl_filename".txt

	# update playlist html-pages
	[ -f "$pl_filename".html ] || pl_index="playlists/index".html
	sed -e "s|#getdate|$(date -d @$ts +'%A, %e %B %Y')|" "$APP_ROOT/templates/playlist".html.header > "$pl_filename".html
	cat "$pl_filename".txt >> "$pl_filename".html
	sed -e "s|#getfile|$(basename "$pl_filename")|g" "$APP_ROOT/templates/playlist".html.footer >> "$pl_filename".html
	if [ -n "$pl_index" ]; then # update playlists index
		tree -NtrD -L 1 -H "/${STATION_ID}/playlists" -P '*.html' -I index\.html --noreport -T "$STATION_NAME - Дневни плеј-листи" --timefmt='%a %d %b %Y' --charset=UTF-8 $(dirname "$pl_filename") | head -n -11 > "$pl_index"
		cat "$APP_ROOT/templates/pl_index".html.footer >> "$pl_index"
	fi
fi

# only update file-lists if we modified the file
[ -n "$wors" ] && exec "$RADIO_APP/create-mp3-lists.sh" ${MP3_HIST:-24}
exit
