# MQTT-ALERT-SENDER
**Mqtt client For checking if published values are in valid range**

Simple Node Js utility to check if published data is within valid range.
Usefull for notyfing when a discrete signal value is out of range.
For example temeperature is too low, e-mail the approriate person that heating needs to be checked.
NOTE: Before installing please clone the logging utility: xtreamLogger
NOTE: Before installing please clone the common mqtt utility functions library: stdMqtt

## Release 1.0.0
Initial release of code and configuration examples.

## How to Install
Pre-requisite is cloning the xtreamLogger, stdMqtt to the same root directory.
Clone or unzip repository.
Open shell or the windows cmd, cd inside and type:
```js
npm install
```
## Configuration
All of the broker specific data are to be kept in a seperate json file.
A "exampleConfig.json" config file was attached for reference.
The cofig file path should be be passed as -c input argument.

## How to run
Open shell or the windows cmd, cd inside and type:
```js
node mqttAlertSender.js -c <PATH_TO_CONFIG_FILE>
```

## Start Linux Daemon
A mqttAlertSenderd.sh can be used for running the node process in background using sytem.d or system-v
