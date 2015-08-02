var config = require('./config.js');

var express = require('express');
var session = require('express-session');

var redis = require('redis');
// var redisClient = redis.createClient();
var redisClient = redis.createClient(config.redis.port, config.redis.host, {auth_pass: config.redis.pass});
// redisClient.keys('*', redis.print	);
redisClient.on('connect', function(){
	console.log('redis connection established');
});

var RedisStore = require("connect-redis")(session);

var redisConn = new RedisStore( {client: redisClient, prefix: config.redis.prefix+config.redis.sessionPrefix});
var sessionMiddleware = session( {store: redisConn, secret: config.app.sessionSecret, resave:true, saveUninitialized:true, cookie: {maxAge: config.redis.clientTTL}, rolling: true } );

var app = express();
var errorhandler = require('errorhandler');
var serveStatic = require('serve-static');
var share = require('./server_middleware/share');
// var shares = new share.shareContainer();

var server = require('http').Server(app);
var io = require('socket.io')(server);

app.use(sessionMiddleware);

// adapter to be able to access the session from socket.io
io.use(function(socket, next) {
	sessionMiddleware(socket.request, socket.request.res, next);
});

// var ioevents = require('./server_middleware/ioevents')(io, shares, redisClient);
var ioevents = require('./server_middleware/ioevents')(io, redisClient);

// there are route endpoints that require access to share data (e.g. getting tokens which
//     are cumbersome to do through socket.io, hence use dependency injection

// handle things like nick changes and authentication through the socket for now, like irccloud

var router = require('./routes')(app);

/*app.set('view engine', 'jade');
app.set('views', './views');*/

app.use(errorhandler());

server.listen(config.app.port, function(){
	console.log("app started");
});
