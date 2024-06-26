# radio.spodeli.org

#### On-demand audio streaming for internet radio stations

Records the source stream and makes it available for playback and download, split into predefined time-slots (weekly broadcast schedule) and individual tracks (based on stream metadata).

The project was created in 2012 in order to keep up with the beautiful music aired by our beloved non-commercial FM radio station *Kanal 103*.
It was designed to be cheap to run, relying on minimal support infrastructure (it should work on almost any device with Linux and static web server).

## Core setup

> Debian 10/11 assumed

### install prerequisits

```sh
# audio/metadata tools
sudo apt install -y streamripper sox libsox-fmt-all mp3val id3v2 ffmpeg lame vorbis-tools
# other script dependencies
sudo apt install -y cron bc tree rename moreutils
```

### install application files

```sh
# download
git clone https://github.com/skopjehacklab/radio.spodeli.org.git && cd radio.spodeli.org
```
```sh
# copy core files to permanent destination
sudo rsync -av scripts static /opt/spodeli_radio/
sudo cp systemd/streamripper@.service /etc/systemd/system/
```
> core files could be put anywhere, as long as `RADIO_APP` variable is set to the *`scripts`* dir path and the root of web-server points to path of *`static`*

### install patched streamripper

The app uses a streamripper fork with added option for metadata export, expected to be found at `/usr/local/bin/streamripper_e`

> the name is modified so it can be used easily alongside unpached or different version of `streamripper`

quick way to do this in debian:

```sh
cd src && apt-get source streamripper
patch -p0 < streamripper_export_metadata.deb.patch
sudo apt-get -y build-dep streamripper
cd streamripper-1.64.6 && dpkg-buildpackage -us -uc -b
sudo cp "$(pwd)/debian/streamripper/usr/bin/streamripper" /usr/local/bin/streamripper_e
```

## Channel setup

> it's assumed that relevant core files were copied to `/opt/spodeli_radio` and current working directory is where repository was cloned into

### Environment variables

```sh
export STREAM_URL RELAY_PORT WEB_BASE RADIO_APP STATION_ID STATION_NAME STATION_URL APP_ROOT WEB_ROOT DELAY OGG_BITRATE OVERLAP XS TRACK_NAME MP3_MIN_LEN MP3_HIST
```

core settings

```ini
# path to radio.spodeli.org core scripts
RADIO_APP=/opt/spodeli_radio/scripts
```
```ini
# web-server domain URL (used for creating absolute web-links to recordings and playlists)
WEB_BASE=//radio.spodeli.org
```

station settings

```ini
# channel handle (BASE_URL will be `${WEB_BASE}/${STATION_ID}`)
STATION_ID=kanal103
```
```ini
STATION_NAME='Канал 103'
STATION_URL=http://kanal103.com.mk
```
```ini
# source URL of the stream to record
STREAM_URL=http://radiostream.neotel.mk:8000/kanal103
```

channel settings

```ini
# local streamripper relay will be on `localhost:${RELAY_PORT}`
RELAY_PORT=56724
```
```ini
# channel runtime and configuration files path
APP_ROOT=/home/kanal103
```
```ini
# channel web files path (BASE_URL on web-server should point here)
WEB_ROOT=/home/kanal103/public_html
```
```ini
# override default user locale for displaying dates
LC_TIME=mk_MK.UTF-8
#LANG=mk_MK.UTF-8
```

recording settings

```ini
# seconds to include from next programme in schedule
OVERLAP=900
```
```ini
# buffer delay in seconds (default 0, max 59) - use to sync playlist times with broadcast times
DELAY=0
```
```ini
# bitrate of created ogg media files, in Kbps (default 192)
OGG_BITRATE=192
```
```ini
# minimum length of saved mp3 files, in miliseconds (default 1000)
MP3_MIN_LEN=10000
```
```ini
# time to keep saved mp3 files, in hours (default 24)
MP3_HIST=24
```

streamripper settings

```ini
# split-point configuration (read man pages for details)
XS='--xs_search_window=1500:500 --xs_offset=-1250'
```
```ini
# filename format for tracks split by metadata (check -D option)
TRACK_NAME='%A - %T'
```

### Run recording

> Assumed environment file location is `/home/${RUN_USER}/etc/radio.env`. Update systemd unit and crontab files accordingly if you want to change it.

#### prepare the channel runtime environment

> When recording multiple channels, it's better to create separate user for each, because `streamripper` reads its default configuration from `~/.config/streamripper/streamripper.ini`

```ini
# specify the runtime user
RUN_USER=kanal103
```

For quick setup of 'kanal103' channel from the repo, run  
`sudo useradd --create-home --shell /usr/sbin/nologin --skel channels/kanal103 ${RUN_USER}`  
Alternatively, copy the contents of `channels/kanal103` somewhere and set `APP_ROOT` and `WEB_ROOT` variables accordingly.

```sh
# load environment vars
. /home/${RUN_USER}/etc/radio.env
```
```sh
# make sure required APP_ROOT structure exists
sudo mkdir -p "$APP_ROOT"/{etc,var,log,run,templates}
sudo touch "$APP_ROOT"/etc/parse_rules.txt
```
```sh
# make sure required WEB_ROOT structure exists
# (there should be sufficient space available for the recordings)
sudo mkdir -p "$WEB_ROOT"/{{0..6},mp3,playlists}
```
```sh
# update ownership of writeable paths
sudo chown -R ${RUN_USER} "${APP_ROOT}"/{var,run,log} "${WEB_ROOT}"
```

#### main (track and metadata) recorder

```sh
# start and enable the service
sudo systemctl start streamripper@${RUN_USER}
sudo systemctl enable streamripper@${RUN_USER}
```

#### weekly schedule recorder

> Important: the schedule must be "full" (24/7) for everything to work properly

```ini
# location of crontab file containing the recording schedule
CRON_FILE=/home/${RUN_USER}/etc/crontab
```
```sh
# add it to RUN_USER crontab
sudo crontab -u ${RUN_USER} -l | cat - "${CRON_FILE}" | sudo crontab -u ${RUN_USER} -
```

## templates and html files

> channel template files: `${APP_ROOT}/templates`  
> channel html web-root: `${WEB_ROOT}`  

### time-slot (scheduled recording) page

base path: *`{{ day-of-week }}/{{ timeslot }}.*`* **`%w/%H%M-%H%M.{html,txt,tag,parts?}`**

stream related files: [`0XXX.`]**`{mp3,ogg,cue,index}`**

> when the stream is interrupted, additional files are created with extension prefixed by part number (4 digit, zero padded)

#### templates / variables

web page is created by joining *.header*, generated recording playlists (wrapped in `<pre class='playlist'>`) and *.footer*

- *recording.html.header*  
`#getbasepath` *`g`*  
`#gettitle`  
`#gettimeslot`  
`#getdate`  

- *recording.html.footer*  
`#getbasepath` *`g`*  
`#getdlname` *`g`*  
`#getnextbasepath` *`g`*  
`#getnextdate`  
`#getnexttitle`  

#### web-app interfacing

> client js application path: `${WEB_BASE}/js/trackplayer.js`

The client app interacts with the following page DOM elements:
- *`location.hash`*
- *`document.title`*
- `audio`
- `#trackname`
- `#timeleft`
- `pre.playlist` (auto-added)
- `a#playnext`
- `#mp3`
- `#ogg`

### track listing pages

#### recorded tracks (from last `MP3_HIST` hours)

web path: **`mp3/index.html`**, **`mp3/playlist.{m3u,xspf}`**

- *mp3.xspf.header*  
`#getxmldate`
- *mp3.{html,m3u,xspf}.footer*

#### daily playlist

web path: *`playlists/{{ date }}.{{ format }}`* **`playlists/%Y_%m_%d.{txt,html}`**

- *playlist.html.header*  
`#getdate`
- *playlist.html.footer*  
`#getfile`
- *playlist.txt.separator*  
`#gettitle`  
`#gettimeslot`  

#### daily playlists index

web path: **`playlists/index.html`**

- *pl_index.html.footer*

## *web-server configuration*

