#!/sbin/openrc-run

name="buckshot-roulette-irl"
command="/usr/bin/node"
command_args="server.js"
directory="/root/buckshot-roulette-irl/server"
pidfile="/var/run/${RC_SVCNAME}.pid"
command_background="yes"
command_user="root:audio"

depend() {
    need net
}