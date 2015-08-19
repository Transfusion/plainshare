var config = require('../config.js');
var fs = require('fs');
var path = require('path');
var rmdir = require('rimraf');
var schedule = require('node-schedule');
// This module is responsible for clearing client data 

var shareContainer;
var timers = {};
// timers is an object of share name to shareTimer (responsible for checking the expiry of a share, notifying all active clients in the share that it is going to be purged

// fn is a callback when the share expiry time has been reached and before actually deleting 
function expireShare(shareid, fn){
	
	this.shareContainer.purgeShare(shareid);

	rmdir(path.join(config.app.storageDir, 'uploads', shareid), function(err){
		console.log(err);
	});
	if (timers[shareid]){
		delete timers[shareid];
	}
	fn(shareid);
}

function cleanUpShare(shareid, fn){
	this.shareContainer.getShareExpiry(shareid, function(err, val){
		if (timers[shareid]){
			timers[shareid].cancel();
		}
		var timer = schedule.scheduleJob(new Date(parseInt(val)), function(){
			expireShare(shareid, fn);
		});
		timers[shareid] = timer;
	})

}

function stopCleanUp(shareid){
	timers[shareid].cancel();
	delete timers[shareid];
}

module.exports = function(shareContainer){
	this.shareContainer = shareContainer;
	this.cleanUpShare = cleanUpShare;
	this.stopCleanUp = stopCleanUp;
	this.expireShare = expireShare;
	return this;
}