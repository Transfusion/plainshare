var express = require('express')
var router = express.Router()
var path = require('path');

module.exports = function(){
	router.get('/', function(req, res){
		res.redirect('/share');
	})

	router.get('/share', function(req, res){
		var sess = req.session;
		res.sendFile(path.resolve(__dirname + '/../html/share.html') );
	});

	router.get('/share/:shareName', function(req, res){
		var sess = req.session;
		res.sendFile(path.resolve(__dirname + '/../html/share.html') );
	});

	return router;
};