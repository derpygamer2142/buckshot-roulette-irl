const net = require("node:net")
const mpg = require("mpg123")
const { networkInterfaces } = require("os")
process.loadEnvFile(__dirname + "/.env")

mpg.MpgPlayer.prototype.volume = vol => this._cmd('V', vol); // override the volume set function because the haters don't want me to go above 100% volume

function getLocalIp() {
    const nets = networkInterfaces()
    if (Object.prototype.hasOwnProperty.call(nets, "Tailscale")) delete nets["Tailscale"] // this causes issues on my device and we don't care about it


    for (const net of Object.values(nets).flat()) {
        if (
            (net.family === 4 || net.family === "IPv4") &&
            !net.internal
           ) return net.address
    }

    throw new Error("Could not find local ip", networkInterfaces())
}

console.log("Now connecting to clients from " + getLocalIp())

/**
 * @readonly
 * @constant
 * @enum {string}
 */
const ClientType = {
    "SHOTGUN": "SHOTGUN"
}

/**
 * @readonly
 * @constant
 * @enum {string}
 */
const Event = {
    "PING": "PING",
    "PONG": "PONG"
}

class ClientManager {
    constructor(ip, type) {
        this.client = net.createConnection({ port: 80, host: ip }, () => {
            console.log('Connected to client ' + ip);

        this.send("PING")
        });
        this.ip = ip
        this.type = type

        this.client.setEncoding('utf8');

        
        this.client.on("end", () => {
            console.log("Disconnected from client " + ip); // todo: attempt reconnection
        });

        this.client.on("error", (err) => {
            console.error("Client " + ip + " error:", err);
        });   
        
        this.client.on("data", (data) => {
            console.log(`Received data from client ${ip}: ${data}`);
            this.handle(data)
        });
    }

    /**
     * Send a request to the client
     * @param {string} data 
     */
    send(data) {
        this.client.write(data)
    }

    /**
     * Handle a request from the client
     * @param {Buffer<ArrayBufferLike>} req 
     */
    handle(req) {
        const data = req.toString().trim().split(" ")

        const event = data.shift()

        switch (event) {
            case (Event.PING): {
                console.log("Received ping")
                this.send("PONG")
                
                break
            }

            case (Event.PONG): {
                console.log("Received pong")
                
                break
            }
        }
    }
}

async function main() {
    // const shotgun = new ClientManager("192.168.3.125", ClientType.SHOTGUN)

    const player = new mpg.MpgPlayer()
    player.play("/root/sound.mp3")

    const interval = setInterval(() => {
        player.volume((Math.sin(Date.now()/10)+1.5) * 100)
    })

    setTimeout(() => { clearInterval(interval); player.stop() }, 2500)
}

main()
