# todo: put this script on my website and test it
# not necessarily in that order
iw dev wlan0 scan | grep SSID:
read -p "Choose a WiFi network: " net_ssid
read -p "Enter password: " net_pswd

wpa_passphrase "$net_ssid" "$net_pswd" > /etc/wpa_supplicant/wpa_supplicant.conf # add network credentials
wpa_supplicant -i wlan0 -c /etc/wpa_supplicant/wpa_supplicant.conf -B # connect to the network in the background

apk add pigpio pigpio-dev --repository=http://dl-cdn.alpinelinux.org/alpine/edge/testing
# todo: making iomeme work right
# todo: i wrote that comment a while ago and i don't remember what iomeme is or why it should be working or why it isn't

apk add alsa-utils alsaconf mpg123 \
        git \
        nodejs npm \
        python3 build-base # these are needed to install some of the node libraries, we can remove them when we're done

modprobe snd_bcm2835
echo "dtparam=audio=on" >> /boot/usercfg.txt
echo "snd_bcm2835" >> /etc/modules

cd /root
git clone https://github.com/derpygamer2142/buckshot-roulette-irl.git

cd buckshot-roulette-irl
npm ci

apk del python3 build-base git

touch /etc/init.d/buckshot-roulette-irl
./init.d > /etc/init.d/buckshot-roulette-irl
chmod +x /etc/init.d/buckshot-roulette-irl
rc-update add buckshot-roulette-irl default
rc-service buckshot-roulette-irl start