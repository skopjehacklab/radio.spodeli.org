#!/bin/bash
#env: STREAM_URL RELAY_PORT WEB_BASE RADIO_APP STATION_ID STATION_NAME STATION_URL APP_ROOT WEB_ROOT DELAY OGG_BITRATE OVERLAP XS MP3_MIN_LEN MP3_HIST

LOG_FILE="$APP_ROOT/log/streamripper"-cron.log
PID_FILE="$APP_ROOT/run/$STATION_ID"_recording.pid
basepath=$(cat "$APP_ROOT/var/recording" 2> /dev/null) # 6/0600-0900
if [ -z "$basepath" ]; then
	echo "No recording to resume" | ts '%F %T' >> "$LOG_FILE"
	exit
fi

echo -n "$(date +'%F %T') [$basepath] Resume recording: " >> "$LOG_FILE"

if kill -0 $(cat "$PID_FILE") > /dev/null 2>&1; then
	echo "exiting! (recorder already active)" >> "$LOG_FILE"
	exit
else
	rm -f "$PID_FILE"
	# determine URL of local relay stream
	relay_url="http://localhost:$RELAY_PORT/"
	host_offset=$(dirname "$STREAM_URL" | wc -c)
	[ $host_offset -gt 6 ] && relay_url="${relay_url}${STREAM_URL:$host_offset}"
	# set recording time limit: remaining timeslot duration + overlap & delay
	rec_begin=$(date -ud "1970-01-01 $(date +%T)" +%s)
	rec_limit=$(bc <<<"${timeslot:5:2} * 3600 + ${timeslot:7:2} * 60 - $rec_begin + $OVERLAP + ${DELAY:-0}")
	[ $rec_limit -gt 0 ] || rec_limit=$(bc <<<"$rec_limit + 24 * 3600")
	echo "starting… (remaining: $(date -ud @${rec_limit} +'%H:%M'))" >> "$LOG_FILE"

	SR_OPT='--quiet --stderr --codeset-metadata=windows-1252 --codeset-id3=UTF-8 -i -o never -k 0 -A -s' #-m 2
	exec -a "streamripper-$STATION_ID-res_${basepath:2}" streamripper "$relay_url" -l $rec_limit $SR_OPT $XS -w "$APP_ROOT/etc/parse_rules.txt" -d "$WEB_ROOT" -a "${basepath}.%q" |& ts '%F %T' >> "$LOG_FILE" &
	# assume PID - 1 is the PID of the first process in the pipe (streamripper)
	new_pid=$(( $! - 1 ))

	sleep 5
	if kill -0 $new_pid > /dev/null 2>&1; then
		(umask 066 && echo $new_pid > "$PID_FILE")
	else
		echo "[$basepath] Streamripper (pid: $new_pid) failed to start" | ts '%F %T' >> "$LOG_FILE"
		exit 1
	fi
fi
#exit
