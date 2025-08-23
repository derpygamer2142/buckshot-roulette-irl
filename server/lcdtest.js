const { Gpio } = require("pigpio")

const pinNums = [9, 11, 
              25, 8, 7, 1]
const pins = pinNums.map((v) => new Gpio(v, { mode: Gpio.OUTPUT }))

let i = 0
const t = setInterval(() => {
    if (i > 0) pins[i-1].digitalWrite(0)
    if (i > pins.length-1) return i = 0
    pins[i].digitalWrite(1)
    console.log("setting pin", pinNums[i])
}, 2000)