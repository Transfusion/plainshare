var express = require('express')
var router = express.Router()
var path = require('path');

// router.get('/', function(req, res){
// 	res.sendFile(path.resolve(__dirname + '/../html/share.html') );
// 	console.log('root');
// });

// router.get('/:name', function(req,res){
// 	res.sendFile(path.resolve(__dirname + '/../html/share.html') );
// });

// requesting / is supposed to bring up the create share dialog, whereas requesting /sharename is supposed to bring up the share dialog.
// too lazy to make a jade template.

// module.exports = function(shares){
module.exports = function(){
	router.get('*', function(req, res){
		var sess = req.session;
		res.sendFile(path.resolve(__dirname + '/../html/share.html') );
	});

	return router;
};