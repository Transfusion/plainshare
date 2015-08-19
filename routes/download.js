var express = require('express');
var fs = require('fs');
var path = require('path');
var config = require('../config.js');

var router = express.Router()
var path = require('path');

module.exports = function(shareContainer){

	router.get('/', function(req, res){
		console.log(req.query);
		// resumable.get(req, function(msg){
			// res.sendStatus(msg.status == 'found' ? 200 : 404);
			shareContainer.getAllSessions(req.query.roomid, function(err, val){
				// console.log(val);
				if (val.indexOf(req.sessionID) > -1){
					var filePath = path.join(config.app.storageDir, 'uploads', req.query.roomid, req.query.file);
					res.download(filePath, function(err){
						if (err){
							console.log(err);
							res.sendStatus(404);
						}
					})
				}
				else {
					res.sendStatus(401);
				}
			})
		// })

	});

	return router;
};