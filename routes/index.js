var express = require('express');
module.exports = function (app) {
	// app.use(errorhandler());
	app.use('/css', express.static('css'));
	app.use('/js', express.static('js'));
	
	// app.use('/', require('./main'));
	// app.use('/socket', require('./socket'));
	app.use('/', require('./share')() );
	/*app.use('/validate', require('./validate'));
	app.get('/fail', function(req, res){
		fail();
	});*/
};