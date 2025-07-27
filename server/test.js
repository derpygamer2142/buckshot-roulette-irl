const LCD = require("./lcd1602.js")

const lcd = new LCD(9, 11, 
                    25, 8, 7, 1)

lcd.begin(16, 2).then(() => {
    lcd.print("H")
})