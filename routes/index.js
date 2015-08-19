var express = require('express');
module.exports = function (app, io, shareContainer) {
	app.use('/css', express.static('css'));
	app.use('/js', express.static('js'));
	
	app.use('/', require('./share')() );
	app.use('/upload', require('./upload')(io, shareContainer) );
	app.use('/download', require('./download')(shareContainer));
};