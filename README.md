# Buckshot Roulette IRL

This project has a corresponding page on [my website](https://derpygamer2142.com/projects/buckshot-roulette).

## Structure

Stuff that runs on the shotgun goes in /clients. Stuff that runs on the display board goes in /server; it is intended to run on Alpine Linux. You can find a setup script in /server/setup.sh, but no guarantees it will work.

You will need to extract the sound effects from the original game, typically by decompilation, and place them in /server/audio. Music can be pulled from the same directory as the executable if you own the game, no decomplilation necessary, but it must be placed in /root/music. You will get a crash if you don't do both of these things.

## Credits

Buckshot Roulette and its music were made by Mike Klubnika, and this project is not associated with the game at all.

The LCD1602 driver is a JS port of Arduino's [LiquidCrystal](https://docs.arduino.cc/libraries/liquidcrystal/) (LGPL 2.1).

/server/GENERAL_RELEASE.html is a general release of liability that was listed on the [Buckshot Roulette wiki](https://buckshot-roulette.fandom.com/wiki/General_Release_of_Liability) as being the one that the game is based on. I added a clause that it's not legally binding because I don't have $10,000.
