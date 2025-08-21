#!/sbin/openrc-run

name="buckshot-roulette-irl"
command="/usr/bin/node"
command_args="server.js"
directory="/root/buckshot-roulette-irl/server"
pidfile="/var/run/${RC_SVCNAME}.pid"
command_background="yes"
command_user="root:audio"

output_log="/var/log/${RC_SVCNAME}.log"
error_log="/var/log/${RC_SVCNAME}.err"

depend() {
    need net
}