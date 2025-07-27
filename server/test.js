const LCD = require("./lcd1602.js")



async function main() {
    const lcd = new LCD(9, 11, 
                    25, 8, 7, 1)

    await lcd.begin(16, 2)
    
    console.log("\n\nDone initializing\n\n")

    await lcd.print("H")
}

main()