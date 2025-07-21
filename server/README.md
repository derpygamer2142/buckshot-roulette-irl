# Installation

Install all the command line dependencies if you haven't already.
This is for alpine, you will need to modify this for another distro.

(todo: make an npm run script)

```bash
apk add --update pigpio alsa-utils alsa alsaconf mpg123
```

Install other dependencies

```bash
npm ci
```