var redis = require('redis');

var config = {};
config.app = {};
config.redis = {};
config.share = {};

config.redis.prefix = 'cable:'
config.redis.sessionPrefix = 'sess:';
config.redis.confPrefix = config.redis.prefix+'conf:';
// 6 hours, in milliseconds (meant to be passed to express-session)
config.redis.clientTTL = 21600000;
config.redis.shareTTL = 21600000;
// config.redis.shareTTL = 30000;

// messages are also automatically removed after 4 hours (meant to be passed directly to redis) (not implemented)
config.redis.msgTTL = 14400;

config.share.historySize = 5;

if (process.env.VCAP_SERVICES){
	var redis_config = JSON.parse(process.env.VCAP_SERVICES)['redis-2.6'][0].credentials;
	config.redis.host = redis_config.hostname;
	config.redis.port = redis_config.port;
	config.redis.pass = redis_config.password;
	config.app.sessionSecret = process.env.EXPRESS_SESSION_SECRET;
	config.share.hashsalt = process.env.HASHIDS_SALT;
	config.app.peerjsApiKey = process.env.PEERJS_API_KEY;
}

else {
	config.redis.host = 'xxxxx';
	config.redis.port = 'xxxxx';
	config.redis.pass = 'xxxxx';
	config.app.sessionSecret = 'xxxxx';
	config.share.hashsalt = 'xxxxx';
	config.app.peerjsApiKey = 'xxxxx';
}

module.exports = config;