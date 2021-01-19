// ============================ RESOURCES ================================
var mqtt = require('mqtt');
const moment = require('moment-timezone');
const argParser = require('./argParser').parser;
const fs = require('fs');
const mailLogger = require("../xtreamLogger/mailingLogger").MailingLogger;
const stdMqtt = require("../stdMqtt/stdMqtt");
// =======================================================================

// ============================ GLOBALS ==================================
const args = argParser.parseArgs();
const configFileRaw = fs.readFileSync(args.config, 'utf-8');
var config = JSON.parse(configFileRaw);

var broker = mqtt.connect(config.broker.url,config.broker.options);

var soubscriberBroker = false;

// dictionary holding <topicId, comparison_settings>
var _monitorSettingsDic = {};

// =======================================================================

// ================= Gloabl values intilization ==========================
function getDateTime() 
{
   return moment().tz(config.time.zone).format(config.time.format);
}

for(let i in config.topicsToWatch)
{
	   let topicId = config.topicsToWatch[i].topicId;

	   let isSomeSettingUsingExactStrMatch = config.topicsToWatch[i].monitorSettings.some(s => s.verficationDefinitions.exactStrMatch.length > 0);
	   if(isSomeSettingUsingExactStrMatch)
	   {	
			throw 'The exact Str Match mqtt monitor/alert is not yet supported';	
	   }

	   let monitoredKeys = config.topicsToWatch[i].monitorSettings.map(s => s.keyId);

	   let numericCompDefs = [];

	    config.topicsToWatch[i].monitorSettings.forEach(monSetting =>
		{
			let key = monSetting.keyId;
			monSetting.verficationDefinitions.numericalComparison.forEach( s => 
			numericCompDefs.push({"key" : key, "operation" : s.operationType, "boundry" : parseFloat(s.boundryValue)}));	
		});
	   
	   _monitorSettingsDic[topicId] = 
	   {
			"monitoredKeys"   : monitoredKeys,
			"compDefinitions" : numericCompDefs,
			"out"	      	  : new mailLogger(config.loggerOptions)
	   };
}
// =======================================================================

// =======================================================================

function sendValueOutOfBoundsNotifcation(topic, violationInfoArray)
{ 
	// Send out an e-mail with the topic id,
	// The key, threshold value and the received out of bound value 

	console.log("One or more values out of band in topic: " + topic + ", sending an e-mail");
	let mailMessage = "";
	violationInfoArray.forEach(_ => 
	{
		let compDefinitions = _monitorSettingsDic[topic].compDefinitions.find(c => c.key == _.key);
		let boundryViolationStr = "Actvie boundry violation for " + _.key + ": " + _.receivedValue + " " + compDefinitions.operation + " " + compDefinitions.boundry;
		
		console.log(boundryViolationStr);

		mailMessage += "The " + _.key + ": " + + _.receivedValue + " was out of bounds.<br></br>"
				+ "Affectted topic: " + topic + ".<br></br>"
				+  boundryViolationStr + "<br></br><br></br>";				
	});
	
	mailMessage += "Notification time: " + getDateTime() + ".";

	_monitorSettingsDic[topic].out.warning(mailMessage);
}

function isValueInBounds(compOperation, threshold, receivedValue)
{
	let valueInBounds = true;

	if(compOperation === "<")
	{
		if( Math.round(parseFloat(receivedValue)) < Math.round(parseFloat(threshold)) )
		{
			valueInBounds = false;
		}
	}	
	else if(compOperation === ">")
	{
		if(Math.round(parseFloat(receivedValue)) > Math.round(parseFloat(threshold)))
		{
			valueInBounds = false;
		}	
	}
	else
	{
		throw "Error unsupported operation was provided";
	}

	return valueInBounds;	
}

function checkTopicPayload(topic, message)
{
	if(typeof(message) != "undefined") 
	{//acounting for broken messages
		for (let i in config.topicsToWatch)
		{
			if(topic == config.topicsToWatch[i].topicId)
			{
				var msgJson;
				try
				{
					msgJson = JSON.parse(message.toString());
				}
				catch(e)
				{
					console.log("Error was captured during parsing: " + e.message);
					continue;
				}
				var violationInfoArray = [];

				_monitorSettingsDic[topic].compDefinitions.forEach(_ => {

					let res = stdMqtt.getPayloadOfKey(_.key, msgJson);

					if(res.isValid)
					{
						let actualValue = res.val;

						let valueInBounds = isValueInBounds(_.operation, _.boundry, actualValue);
				
						if(valueInBounds == false)
						{
							violationInfoArray.push({"key" : _.key, "receivedValue" : actualValue});			
						}
					}
					else
					{
						console.log("Error found when checking topic: " + topic + ",the key: " + _.key);
					}
				});

				if(violationInfoArray.length > 0)
				{
					sendValueOutOfBoundsNotifcation(topic, violationInfoArray);
				}

			}
		}
	}
}

function subscribeToMqttTopics()
{
	for(let i in config.topicsToWatch)
	{
		broker.subscribe(config.topicsToWatch[i].topicId);
	};
}

// =======================================================================

// ===================== Messages from broker ============================
broker.on('connect', function()
{
	console.log("Connected to source Mqtt Broker");
	if(soubscriberBroker != true)
	{
		subscribeToMqttTopics();
		soubscriberBroker = true;
		console.log("Subscriptions to source broker are done.\n");
	}
});

broker.on('message', function (topic, message)
{
	console.log(message.toString());
	
	// Check if values are out of bounds.
	// If this is the case a notfication will be issued.
	checkTopicPayload(topic,message);
});

broker.on('error', function(error)
{
	console.log("Error received from source broker");
	console.log(error);
});
// =======================================================================
