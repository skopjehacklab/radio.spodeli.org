#!/bin/bash
#env: STREAM_URL RELAY_PORT WEB_BASE RADIO_APP STATION_ID STATION_NAME STATION_URL APP_ROOT WEB_ROOT OGG_BITRATE XS TRACK_NAME MP3_MIN_LEN MP3_HIST
#LOG_FILE="$APP_ROOT/logs/streamripper_service.log"

localPort="-z -r $RELAY_PORT -R 10"

#echo "streamripper-$STATION_ID was down, restarting..." | ts >> "$LOG_FILE"
exec -a "streamripper-$STATION_ID" /usr/local/bin/streamripper_e "$STREAM_URL" --quiet -w "$APP_ROOT/etc/parse_rules.txt" -m 2 -c $localPort --codeset-id3=UTF-8 --codeset-metadata=windows-1252 --codeset-relay=UTF-8 -t -o version -k 0 -s -D "$WEB_ROOT/mp3/$TRACK_NAME" -e "$RADIO_APP/handle-metadata.sh" -u "streamripper@radio.spodeli.org" $XS --xs_padding=500:500 && exit 1 #2>&1
