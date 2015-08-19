var express = require('express');
var path = require('path');
var config = require('../config.js');

var tempDir = path.normalize(config.app.storageDir+'/temp/');

try {
	fs.mkdirSync(config.app.storageDir);
	fs.mkdirSync(tempDir);
}
catch (e){

}

var multer = require('multer')({dest: tempDir} );

var router = express.Router()
var resumable = require('../server_middleware/resumable_upload.js')();

module.exports = function(io, shareContainer){
	router.post('/', multer.single('file'), function(req, res){
		// check if session is valid or not;
		// if (req.sessionID)

		if (req.body == undefined || req.body.shareName == undefined){
			return res.sendStatus(401);
			// res.send("unauthorized!");
		}

		shareContainer.getShares(function(err, val){
			if (!req.body.shareName || val.indexOf(req.body.shareName) == -1){
				return res.sendStatus(404);
			}
			else {
				shareContainer.getAllSessions(req.body.shareName, function(err, val){
					if(val.indexOf(req.sessionID) == -1){
						return res.sendStatus(401);
					}
					else {
						resumable.post(req, function(response){
						// if (msg.status == 'invalid_resumable_request'){
							if(response.status == 'done'){
								var msg = {type: 'file', sender: req.session.shares[response.shareName].nick, size: response.size, fileID: response.identifier, fileName: response.fileName};
								shareContainer.addMessage(msg, response.shareName, function(msgID){
									io.sockets.in(response.shareName).emit('message', msg);
								});
								// console.log("file upload completed");
								
							}
							res.send(response);
						});
					}
				})

			}
		});

		
	});

	router.get('/', function(req, res){
		resumable.get(req, function(msg){
			res.sendStatus(msg.status == 'found' ? 200 : 404);
		})
	});

	return router;
};