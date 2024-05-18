#!/bin/bash
#env: WEB_BASE RADIO_APP STATION_ID STATION_NAME STATION_URL APP_ROOT WEB_ROOT OGG_BITRATE MP3_HIST
# $1: how many hours of recording to keep, default is 24
keep_time=${1:-${MP3_HIST:-24}}

mp3_dir="$WEB_ROOT/mp3"
web_path="http:${WEB_BASE}/${STATION_ID}/mp3"
tmpl_base="$APP_ROOT/templates/mp3"

# delete expired mp3 files
find "$mp3_dir" -type f -name "*.mp3" -mmin +$(($keep_time * 60)) -delete

# create xspf
sed -e "s|#getxmldate|$(date +%Y-%m-%dT%H:%M:%S)|" "$tmpl_base".xspf.header > "$mp3_dir/playlist".xspf
tree -NtrD -L 1 -P "*.mp3" -i -h -I incomplete -H "$web_path" --noreport --timefmt="%d.%m %H:%M" "$mp3_dir" | sed -n -e 's_^\[[^0-9]*__p' | tac | sed -e 's_^\(.*[MK]\)&nbsp;\([^&]\+\)&nbsp;\([^&]\+\)\]&nbsp;&nbsp;<a href="\(.*\.mp3\)">\(.*\)\.mp3</a><br>$_    <track><title>\2 \3  \5  ~\1B</title><location>\4</location></track>_' -e 's_amp;__g' -e 's_&_&amp;_g' >> "$mp3_dir/playlist".xspf
cat "$tmpl_base".xspf.footer >> "$mp3_dir/playlist".xspf

# create m3u
tree -NtrD -L 1 -P "*.mp3" -i -h -I incomplete -H "$web_path" --noreport --timefmt="%d.%m %H:%M" "$mp3_dir" | sed -n -e 's_^\[[^0-9]*__p' | tac | sed -e 's_^\(.*[MK]\)&nbsp;\([^&]\+\)&nbsp;\([^&]\+\)\]&nbsp;&nbsp;<a href="\(.*\.mp3\)">\(.*\)\.mp3</a><br>$_#EXTINF:,\2 \3  \5  ~\1B\n\4_' -e 's_amp;__g' -e 1i'#EXTM3U' > "$mp3_dir/playlist".m3u
cat "$tmpl_base".m3u.footer >> "$mp3_dir/playlist".m3u

# create html
tree -NtrD -L 1 -P "*.*" -I "incomplete|index\.html" -H "/${STATION_ID}/mp3" -T "$STATION_NAME - Снимена програма од последните $keep_time часа (mp3)" --si --noreport --timefmt="- %a %T" --charset="UTF-8" "$mp3_dir" | head -n -11 | sed -e "s'M&nbsp;-'\&nbsp;MB ─'" -e "s'k&nbsp;-'\&nbsp;kB ─'" -e "s_]&nbsp;_] _" > "$mp3_dir/index".html
cat "$tmpl_base".html.footer >> "$mp3_dir/index".html
