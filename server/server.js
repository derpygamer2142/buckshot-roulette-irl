const net = require("node:net")
const wifi = require("node-wifi")
const { networkInterfaces } = require("os")
process.loadEnvFile(__dirname + "/.env")


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
    wifi.init({
        iface: null
    })

    if ((await wifi.getCurrentConnections()).length < 1) {
        console.log("WiFi not connected, connecting to SSID")
        await wifi.connect({
            ssid: process.env["NET_SSID"],
            password: process.env["NET_PSWD"]
        })

        console.log("Connected")
        await new Promise(resolve => setTimeout(resolve, 450)) // wait 450ms before continuing
    }

    const shotgun = new ClientManager("192.168.3.125", ClientType.SHOTGUN)


}

main()