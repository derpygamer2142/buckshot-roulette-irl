const net = require("node:net")
const mpg = require("mpg123")
const LCD = require("./lcd1602.js")
const fs = require("fs")
const http = require("http")
const { networkInterfaces } = require("os")

try {
    process.loadEnvFile(__dirname + "/.env")
}
catch {
    fs.writeFileSync(__dirname + "/.env", "")
    process.loadEnvFile(__dirname + "/.env")
}


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

const localIp = getLocalIp()

console.log("Now connecting to clients from " + localIp)

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

const lcd = new LCD(9, 11, 
                    25, 8, 7, 1 // who thought this numbering scheme was a good idea
                )

lcd.begin(16, 2)

/*const player = new mpg.MpgPlayer()
player.volume = vol => player._cmd('V', vol)
player.play("/root/sound.mp3") // override the volume set function because the haters don't want me to go above 100% volume

const interval = setInterval(() => {
    player.volume((Math.sin(Date.now()/10)+1.5) * 100)
})

setTimeout(() => { clearInterval(interval); player.stop() }, 2500)

async function main() {
    const shotgun = new ClientManager("192.168.3.125", ClientType.SHOTGUN)

    
    
}*/

async function writeLCD(name) {
    await lcd.clear()
    await lcd.rightToLeft()
    await lcd.setCursor(6, 0) // left of the middle with 1 space padding on each side
    await lcd.print("DEALER")
    await lcd.leftToRight()
    await lcd.setCursor(8, 0) // right of the middle
    await lcd.print(name)
}

main()

const server = http.createServer((req, res) => {
    console.log("method:", req.method)

    // todo: if this table ever ends up anywhere in public, do some request verification

    if (req.method === "GET") {
        res.writeHead(200, {
            "Content-Type": "text/html",
            "Connection": "close"
        })

        const stream = fs.createReadStream(__dirname + "/GENERAL_RELEASE.html")

        stream.pipe(res)

        stream.on("error", (err) => {
            console.error("Error", err)
            res.writeHead(500)
            res.end("Internal server error")
        })
    }
    else {
        let body = []
        req.on("data", (chunk) => {
            body.push(chunk)
        })
        req.on("end", () => {
            const data = Buffer.concat(body).toString()
            console.log("Received name data", data)
            res.writeHead(200).end("OK")

            writeLCD(data)
        })
        
    }


})

server.listen(8000, localIp, async () => {
    console.log(`HTTP server listening on http://${localIp}:8000`)
})