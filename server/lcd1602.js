// ported to nodejs from https://github.com/arduino-libraries/LiquidCrystal/blob/master/src/LiquidCrystal.cpp
// licensed under LGPL-2.1
/*
LCD 1602 NodeJS library, ported from the C++ Arduino library
Copyright (C) 2025 derpygamer2142

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 2.1 of the License, or (at your option) any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this library; if not, see
<https://www.gnu.org/licenses/>.
 */

const Gpio = require("pigpio").Gpio


// commands
const LCD_CLEARDISPLAY = 0x01
const LCD_RETURNHOME = 0x02
const LCD_ENTRYMODESET = 0x04
const LCD_DISPLAYCONTROL = 0x08
const LCD_CURSORSHIFT = 0x10
const LCD_FUNCTIONSET = 0x20
const LCD_SETCGRAMADDR = 0x40
const LCD_SETDDRAMADDR = 0x80

// flags for display entry mode
const LCD_ENTRYRIGHT = 0x00
const LCD_ENTRYLEFT = 0x02
const LCD_ENTRYSHIFTINCREMENT = 0x01
const LCD_ENTRYSHIFTDECREMENT = 0x00

// flags for display on/off control
const LCD_DISPLAYON = 0x04
const LCD_DISPLAYOFF = 0x00
const LCD_CURSORON = 0x02
const LCD_CURSOROFF = 0x00
const LCD_BLINKON = 0x01
const LCD_BLINKOFF = 0x00

// flags for display/cursor shift
const LCD_DISPLAYMOVE = 0x08
const LCD_CURSORMOVE = 0x00
const LCD_MOVERIGHT = 0x04
const LCD_MOVELEFT = 0x00

// flags for function set
const LCD_8BITMODE = 0x10
const LCD_4BITMODE = 0x00
const LCD_2LINE = 0x08
const LCD_1LINE = 0x00
const LCD_5x10DOTS = 0x04
const LCD_5x8DOTS = 0x00


const LOW = 0;
const HIGH = 1;

async function delay(ms) {
    return new Promise((res) => setTimeout(res, ms))
}

class LCD {
    constructor(rs, enable, d0, d1, d2, d3) {
        /** @type {Gpio} */
        this._rs_pin = 0 // output pin, LOW/HIGH
        /** @type {Gpio} */
        this._rw_pin = 0 // output pin, LOW/HIGH
        /** @type {Gpio} */
        this._enable_pin = 0 // output pin, LOW/HIGH?
        /** @type {Gpio[]} */
        this._data_pins = [0, 0, 0, 0, 0, 0, 0, 0] // pins to write to

        this._displayfunction = 0 // byte of bit flags
        this._displaycontrol = 0 // byte?
        this._displaymode = 0 // byte?

        this._initialized = false; // boolean?

        this._numlines = 0 // number of text lines
        this._row_offsets = [0, 0, 0, 0]

        this.init(1, rs, 255, enable, d0, d1, d2, d3, -1, -1, -1, -1)
    }

    init(fourbitmode, rs, rw, enable,
        d0, d1, d2, d3, d4, d5, d6, d7
    ) {
        this._rs_pin = new Gpio(rs, { mode: Gpio.OUTPUT })
        if (rw != 255) this._rw_pin = new Gpio(rw, { mode: Gpio.OUTPUT })
        else this._rw_pin = null
        
        this._enable_pin = new Gpio(enable, { mode: Gpio.OUTPUT })

        this._data_pins = [d0, d1, d2, d3, d4, d5, d6, d7].map((pin) => pin === -1 ? null : new Gpio(pin, { mode: Gpio.OUTPUT }))

        if (fourbitmode) {
            this._displayfunction = LCD_4BITMODE | LCD_1LINE | LCD_5x8DOTS
        }
        else {
            this._displayfunction = LCD_8BITMODE | LCD_1LINE | LCD_5x8DOTS
        }

        // does not automatically begin!
        // this.begin(16, 1)
    }

    async begin(cols, lines, dotsize) {
        if (lines > 1) {
            this._displayfunction |= LCD_2LINE
        }

        this._numlines = lines

        this.setRowOffsets(0x00, 0x40, 0x00 + cols, 0x40 + cols)

        // for some 1 line displays you can select a 10 pixel high font
        if ((dotsize != LCD_5x8DOTS) && (lines == 1)) {
            this._displayfunction |= LCD_5x10DOTS
        }

        // pins are already initialized
        
        await delay(50) // wait 50ms for lcd to turn on
            
        
        this._rs_pin.digitalWrite(LOW)
        this._enable_pin.digitalWrite(LOW)
        if (this._rw_pin) this._rw_pin.digitalWrite(LOW)

        if (! (this._displayfunction & LCD_8BITMODE)) {
            // put it into 4 bit mode
            for (let i = 0; i < 3; i++) {
                await this.write4bits(0x03)
                await delay(5)
            }

            await this.write4bits(0x02)
        }
        else {
            await this.command(LCD_FUNCTIONSET | this._displayfunction)
            await delay(5)
            await this.command(LCD_FUNCTIONSET | this._displayfunction)
            await delay(5)
            await this.command(LCD_FUNCTIONSET | this._displayfunction)
        }

        // set # lines, font size, etc.
        await this.command(LCD_FUNCTIONSET | this._displayfunction)

        // turn on display with no cursor or blinking
        this._displaycontrol = LCD_DISPLAYON | LCD_CURSOROFF | LCD_BLINKOFF
        await this.display()

        // clear display
        await this.clear()

        // default text direction
        this._displaymode = LCD_ENTRYLEFT | LCD_ENTRYSHIFTDECREMENT

        return this.command(LCD_ENTRYMODESET | this._displaymode) // set the things
    }

    setRowOffsets(row0, row1, row2, row3) {
        this._row_offsets = [row0, row1, row2, row3]
    }

    // high level user commands

    async print(text) { // not sure if this is right

        for (const char of text) {
            await this.send(char.charCodeAt(0), HIGH)
        }
    }

    async clear() {
        await this.command(LCD_CLEARDISPLAY) // clear display, set cursor position to zero
        return delay(2)
    }

    async home() {
        await this.command(LCD_RETURNHOME) // set cursor position to zero
        return delay(2)
    }

    async setCursor(col, row) {
        const max_lines = this._row_offsets.length
        if (row >= max_lines) row = max_lines - 1
        if (row >= this._numlines) row = this._numlines - 1

        return this.command(LCD_SETDDRAMADDR | (col + this._row_offsets[row]))
    }

    async noDisplay() {
        this._displaycontrol &= ~LCD_DISPLAYON
        return this.command(LCD_DISPLAYCONTROL | this._displaycontrol)
    }
    async display() {
        this._displaycontrol |= LCD_DISPLAYON
        return this.command(LCD_DISPLAYCONTROL | this._displaycontrol)
    }

    async noCursor() {
        this._displaycontrol &= ~LCD_CURSORON
        return this.command(LCD_DISPLAYCONTROL | this._displaycontrol)
    }
    async cursor() {
        this._displaycontrol |= LCD_CURSORON
        return this.command(LCD_DISPLAYCONTROL | this._displaycontrol)
    }

    async noBlink() {
        this._displaycontrol &= ~LCD_BLINKON
        return this.command(LCD_DISPLAYCONTROL | this._displaycontrol)
    }
    async blink() {
        this._displaycontrol |= LCD_BLINKON
        return this.command(LCD_DISPLAYCONTROL | this._displaycontrol)
    }

    async scrollDisplayLeft() {
        return this.command(LCD_CURSORSHIFT | LCD_DISPLAYMOVE | LCD_MOVELEFT);
    }
    async scrollDisplayRight() {
        return this.command(LCD_CURSORSHIFT | LCD_DISPLAYMOVE | LCD_MOVERIGHT);
    }

    // This is for text that flows Left to Right
    async leftToRight() {
        this._displaymode |= LCD_ENTRYLEFT;
        return this.command(LCD_ENTRYMODESET | this._displaymode);
    }
    // This is for text that flows Right to Left
    async rightToLeft() {
        this._displaymode &= ~LCD_ENTRYLEFT;
        return this.command(LCD_ENTRYMODESET | this._displaymode);
    }
    
    // This will 'right justify' text from the cursor
    async autoscroll() {
        this._displaymode |= LCD_ENTRYSHIFTINCREMENT
        return this.command(LCD_ENTRYMODESET | this._displaymode)
    }
    // This will 'left justify' text from the cursor
    async noAutoscroll() {
        this._displaymode &= ~LCD_ENTRYSHIFTINCREMENT
        return this.command(LCD_ENTRYMODESET | this._displaymode)
    }

    async createChar(location, charmap) {
        location &= 0x7
        await this.command(LCD_SETCGRAMADDR | (location << 3))
        for (let i = 0; i < 8; i++) {
            await this.write(charmap[i])
        }

    }

    // mid level commands

    async command(value) {
        return this.send(value, LOW)
    }

    async write(value) {
        await this.send(value, HIGH)
        return 1 // assume success
    }

    // low level commands

    async send(value, mode) {
        this._rs_pin.digitalWrite(mode)

        if (this._rw_pin) this._rw_pin.digitalWrite(LOW)
        
        if (this._displayfunction & LCD_8BITMODE) {
            return this.write8bits(value)
        }
        else {
            await this.write4bits(value >> 4)
            return this.write4bits(value)
        }
    }

    async pulseEnable() {
        this._enable_pin.digitalWrite(LOW)
        await delay(1)
        this._enable_pin.digitalWrite(HIGH)
        await delay(1)
        this._enable_pin.digitalWrite(LOW)
        return delay(1) // why must this be asynchronous, it is polluting all of the other functions
    }

    /**
     * 
     * @param {Number} value 
     * @returns 
     */
    async write4bits(value) {
        for (let i = 0; i < 4; i++) {
            this._data_pins[i].digitalWrite((value >> i) & 0x01)
        }

        return this.pulseEnable()
    }

    async write8bits(value) {
        for (let i = 0; i < 8; i++) {
            this._data_pins[i].digitalWrite((value >> i) & 0x01)
        }

        return this.pulseEnable()
    }
}

module.exports = LCD