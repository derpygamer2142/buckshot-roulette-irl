const { Gpio } = require("pigpio")

const pinNums = [12, 5, 
                 0, 11, 9, 10]
const pins = pinNums.map((v) => new Gpio(v, { mode: Gpio.OUTPUT }))

let i = 0
const t = setInterval(() => {
    if (i > 0) pins[i-1].digitalWrite(0)
    if (i > pins.length-1) return i = 0
    pins[i].digitalWrite(1)
    console.log("setting pin", pinNums[i])
    i++
}, 2000)