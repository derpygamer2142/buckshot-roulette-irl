const net = require("node:net")
const mpg = require("mpg123")
const LCD = require("./lcd1602.js")
const fs = require("fs")
const http = require("http")
const { networkInterfaces } = require("os")
const { Gpio } = require("pigpio")

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
    "PONG": "PONG",
    "SHOTGUNEJECT": "SHOTGUNEJECT",
    "SHOTGUNFIRE": "SHOTGUNFIRE"
}

const lcd = new LCD(9, 11, 
                    25, 8, 7, 1 // who thought this numbering scheme was a good idea
                )

lcd.begin(16, 2)

const musicPlayer = new mpg.MpgPlayer()
musicPlayer.volume = vol => musicPlayer._cmd('V', vol) // override the volume set function because the haters don't want me to go above 100% volume
//musicPlayer.play("/root/music/General Release.mp3")

musicPlayer.volume(75)

const sfxPlayer = new mpg.MpgPlayer()
sfxPlayer.volume = vol => sfxPlayer._cmd('V', vol)

sfxPlayer.volume(150)

/* game logic variables */
let playerHealth = 6
let dealerHealth = 6
let shells = []
const SHELLVARIATIONS = [
    [1,1], // live, blank
    [1,2],
    [2,2],
    [2,3],
    [3,3],
    [2,4],
    [4,4],
    [3,4]
]
/** @description false = player, true = dealer */
let turn = false
let shotgunFired = false

// according to the wiki the max number of charges in double or nothing is 4
// https://buckshot-roulette.fandom.com/wiki/Double_or_Nothing#Gameplay
// the pi zero doesn't really have enough pins for me to do 6 LEDs each
// so i'm going to go with that
// i considered getting a pwm expander thing but:
/*
 * i'm lazy
 * i don't got those kinds of bands
 * i would probably need to implement another library in js
 * i would probably use all the pwm pins and have the same issue
*/
const playerHealthLEDs = [1,2,3,4].map((v) => new Gpio(v, { mode: Gpio.OUTPUT})) 
const dealerHealthLEDs = [1,2,3,4].map((v) => new Gpio(v, { mode: Gpio.OUTPUT}))

// brendan eich definitely intended for javascript to be used to control tasers in a real life adaptation of
// a game about organ harvesting(headcanon) and gambling
const playerTaser = new Gpio(1, { mode: Gpio.OUTPUT})
const dealerTaser = new Gpio(1, { mode: Gpio.OUTPUT})

async function updateHealthDisplay() {
    // todo: flashing when on 1 health
    playerHealthLEDs.forEach((v, i) => v.digitalWrite(+((i+1) > playerHealth)) )
    dealerHealthLEDs.forEach((v, i) => v.digitalWrite(+((i+1) > dealerHealth)) )

    if (playerHealth < 1) {
        musicPlayer.stop()
        musicPlayer.play(__dirname + "/audio/You are an Angel.mp3")
        await lcd.clear()
    }
    else if (dealerHealth < 1) {
        musicPlayer.stop()
        musicPlayer.play(__dirname + "/audio/winner.mp3")
        musicPlayer.once("end", () => {
            setTimeout(() => musicPlayer.play(__dirname + "/audio/70K.mp3"), 2000)
        })
        await lcd.clear()
    }
}

function randomizeHealth() {
    const v = Math.round((Math.random() * 2) + 2)

    playerHealth = v
    dealerHealth = v

    updateHealthDisplay()
}

async function randomizeShells() {
    if (playerHealth < 1 || dealerHealth < 1) return

    const amounts = SHELLVARIATIONS[Math.floor(Math.random()*(SHELLVARIATIONS.length))]
    for (let l = 0; l < amounts[0]; l++) shells.push(true)
    for (let b = 0; b < amounts[1]; b++) shells.push(false)
    
    for (let i = 0; i < 4; i++) shells = shells.sort(()=>Math.random()-.5)

    await lcd.setCursor(0, 1)
    await lcd.print(`${amounts[0]} LIVE   ${amounts[1]} BLANK`)
    setTimeout(async () => {
        await lcd.setCursor(0, 1)
        await lcd.print(" ".repeat(16))
    }, 5000)
}

function playSFX(file, callback) {
    musicPlayer.volume(50)
    /*sfxPlayer.volume(25)
    sfxPlayer.play(__dirname + "/audio/dummy_audio.mp3")

    sfxPlayer.once("end", () => { // "wake up" the process
        sfxPlayer.volume(150)
        sfxPlayer.play(__dirname + "/audio/" + file)
        sfxPlayer.once("end", () => {musicPlayer.volume(75); if (callback) callback()})
    })*/

    sfxPlayer.volume(150)
    sfxPlayer.play(__dirname + "/audio/" + file)
    sfxPlayer.once("end", () => {musicPlayer.volume(75); if (callback) callback()})
}


class ClientManager {
    constructor(ip, type) {
        this.initialize(ip, type) // to make reconnection easier
    }
    
    initialize(ip, type) {
        this.client?.destroy()
        this.client = net.createConnection({ port: 80, host: ip }, () => {
            console.log('Connected to client ' + ip);

            this.send("PING")
        });
        this.ip = ip
        this.type = type

        this.client.setEncoding('utf8');
        this.client.setKeepAlive(true, 5000)


        
        this.client.on("end", () => {
            console.log("Disconnected from client " + ip);

            this.client.destroy()
            this.initialize(ip, type)
        });

        this.client.on("error", (err) => {
            console.error("Client " + ip + " error:", err);
            console.log("code: ", err.code)
            if (err.code === "ECONNRESET") {
                this.client.destroy()
                this.initialize(ip, type)
            }
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
    async handle(req) {
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

            case (Event.SHOTGUNFIRE): {
                /** @description false = self, true = opposite */
                const target = !!Number(data[0])
                console.log("firing shotgun", shells, shotgunFired)
                if (!shotgunFired && playerHealth > 0 && dealerHealth > 0) {
                    
                    const current = shells[0]
                    if (current) {
                        playSFX("gunshot_live.mp3", () => {
                            setTimeout(() => {
                                playSFX("defib discharge.mp3", () => {
                                    if (turn ^ target) {
                                        playerHealth -= 1
                                        playerTaser.digitalWrite(1)
                                        setTimeout(() => playerTaser.digitalWrite(0), 500) // tase them for 500ms
                                        console.log("Player shot", playerHealth)
                                    }
                                    else {
                                        dealerHealth -= 1
                                        dealerTaser.digitalWrite(1)
                                        setTimeout(() => dealerTaser.digitalWrite(0), 500) // tase them for 500ms
                                        console.log("Dealer shot", dealerHealth)
                                    }
                                    updateHealthDisplay()

                                    playSFX("health reduce.mp3")
                                })
                            }, 1500)

                         
                        })

                    }
                    else {
                        playSFX("gunshot_blank.mp3")
                        console.log("fired blank")
                    }

                    shotgunFired = true
                }
                
                break
            }

            case (Event.SHOTGUNEJECT && playerHealth > 0 && dealerHealth > 0): {
                console.log("racking shotgun", shotgunFired)
                if (shotgunFired) { // keep silly billies from racking the shotgun too much and hardware being weird
                    shells.shift()
                    shotgunFired = false
                    playSFX("rack shotgun.mp3")

                    if (shells.length < 1) {
                        await randomizeShells()
                    }
                }

                break
            }
        }
    }
}



async function main() {  
    console.log("Now connecting to clients from " + localIp)
    const shotgun = new ClientManager("192.168.3.182", ClientType.SHOTGUN)

    await randomizeShells()
    randomizeHealth()
    
    
}

main()

async function writeLCD(name) {
    await lcd.clear()
    await lcd.home()
    await lcd.print("DEALER")
    await lcd.setCursor(16 - name.length, 0) // top right
    await lcd.print(name)

    await lcd.setCursor(2, 1)
}

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
        req.on("end", async () => {
            const data = Buffer.concat(body).toString()
            console.log("Received name data", data)
            res.writeHead(200).end("OK")

            musicPlayer.stop()
            sfxPlayer.stop()

            await writeLCD(data)

            await randomizeShells()
            randomizeHealth()
        })
        
    }


})

server.listen(8000, localIp, async () => {
    console.log(`HTTP server listening on http://${localIp}:8000`)
})