var config = require('../config.js');
var hashid = require("hashids");
// var hash = new hashid((Math.random() + 1).toString(36).substring(7));
var hash = new hashid(config.share.hashsalt);
// used to generate share urls/names

var redisClient;

// cable:shares is a set containing all the share names
function getShares(fn){
	// this.redisClient.smembers(config.redis.prefix+'shares', fn);
	this.redisClient.smembers(config.redis.prefix+'shares', fn);
}

// cable:shares:sharename is a hash containing owner/viewer pass, etc
// for now, we set all shares to expire after 12 hours
function createShare(opass, vpass, persistent, fn){
	this.redisClient.incr(config.redis.prefix+'shareCount');
	this.redisClient.get(config.redis.prefix+'shareCount', function(err, val){
		var name = hash.encode(parseInt(val));
		var now = new Date();
		this.redisClient.sadd(config.redis.prefix+'shares', name);
		this.redisClient.hmset(config.redis.prefix+'shares:'+name, 'ownerpass', opass, 'viewerpass', vpass, 'persistent', 1, 'expiry', now.getTime()+config.redis.shareTTL);
		fn(name);
	});
}

function auth(pass, share, fn){
	this.redisClient.hgetall(config.redis.prefix+'shares:'+share, function(err, val){
		if (val.ownerpass == pass){
			fn('owner');
		}
		else if (val.viewerpass == pass){
			fn('viewer');
		}
		else {
			fn('invalid');
		}
	});
}

function getShareExpiry(shareid, fn){
	this.redisClient.hget(config.redis.prefix+'shares:'+shareid, 'expiry', fn);
}

function purgeShare(share){
	getClients(share, function(err, val){
		val.forEach(function(client){
			delClient(client, share, function(){

			});
		})
	})
	this.redisClient.multi().del(config.redis.prefix+'shares:'+share)
													.srem(config.redis.prefix+'shares', share)
													.del(config.redis.prefix+'shares:'+share+':clients')
													.del(config.redis.prefix+'shares:'+share+':messages')
													.del(config.redis.prefix+'shares:'+share+':msgID')
													.del(config.redis.prefix+'shares:'+share+':msgTimestamp')
													.del(config.redis.prefix+'shares:'+share+':sessions')
													.exec(function(err, vals){

													});
}

// cable:shares:sharename:message:msgID is a hash of metadata (type, content); msgID is sequential; the only sane way to do expiry
// possibly include timestamp later?
// note: since we have to fetch ALL the fields of a message at once, best to simply store the entire serialized json at once
function addMessage(msg, nickname, share, fn){
	this.redisClient.incr(config.redis.prefix+'shares:'+share+':msgID');
	this.redisClient.get(config.redis.prefix+'shares:'+share+':msgID', function(err, val){
		var msgID = parseInt(val);
		msg['id'] = msgID;
		msg['ts'] = Date.now();
		var currentTime = new Date();
		this.redisClient.hset(config.redis.prefix+'shares:'+share+':messages', msgID, JSON.stringify(msg));

		this.redisClient.zadd(config.redis.prefix+'shares:'+share+':msgTimestamp', currentTime.getTime().toString(), msgID);
		fn(msgID);
	});
}

function changeMessage(msg, share, fn){
	this.redisClient.hset(config.redis.prefix+'shares:'+share+':messages', msg.id, JSON.stringify(msg), fn);
}

// cable:shares:sharename:clients is a SET containing all the *client nicks*
function getClients(share, fn){
	this.redisClient.smembers(config.redis.prefix+'shares:'+share+':clients', fn);
}

// get details for all clients in the form  
/*{ '2345': 
   { socket: 'p-Vk1Q8dpYcihaLQAAAA',
     role: 'owner',
     session: '4d2RfdUuWe4CCGXLNpyYCSgvfAoJGa4n' } }*/

// prunes sessions which have expired by checking session key actually exists
function pruneDeadSessions(share, fn){
	this.redisClient.hgetall(config.redis.prefix+'shares:'+share+':sessions', function(err, sessionIDs){
		if(sessionIDs){
			var count = Object.keys(sessionIDs).length;
			Object.keys(sessionIDs).forEach(function(i){

				// this.redisClient.exists(config.redis.prefix+config.redis.sessionPrefix+i, function(err, exists){
					this.redisClient.get(config.redis.prefix+config.redis.sessionPrefix+i, function(err, sessData){
						// console.log(i+' '+val);
						if (!sessData || sessData.indexOf(share) == -1){
							this.redisClient.multi()
															.hdel(config.redis.prefix+'shares:'+share+':sessions', i)
															.del(config.redis.prefix+'shares:'+share+':clients:'+sessionIDs[i])
															.srem(config.redis.prefix+'shares:'+share+':clients', sessionIDs[i])
															.exec(function(err, vals){

															});
							/*this.redisClient.hdel(config.redis.prefix+'shares:'+share+':sessions', i);
							this.redisClient.del(config.redis.prefix+'shares:'+share+':clients:'+sessionIDs[i]);
							this.redisClient.srem(config.redis.prefix+'shares:'+share+':clients', sessionIDs[i]);*/
						}
						if (--count == 0){
							fn('complete');
						}
				});

			});
		}
	});
}

function getAllClientDetails(share, fn){
	var clients = {};
	this.redisClient.smembers(config.redis.prefix+'shares:'+share+':clients', function(err, clientNames){
		var count = clientNames.length;
		clientNames.forEach(function (name){

			this.redisClient.hgetall(config.redis.prefix+'shares:'+share+':clients:'+name, function(err, clientData){
				clients[name] = clientData;
				if (--count == 0){
					fn(clients);
				}

			});

		})

	});
}

// get details from a single client, only one object returned
function getClientDetails(nickname, share, fn){
	this.redisClient.hgetall(config.redis.prefix+'shares:'+share+':clients:'+nickname, function(err, clientData){
		// console.log(clientData);
		fn(clientData);
	});
}

// a client's metadata is stored in the form cable:shares:sharename:clientnick
// possible states are "active", "dormant" (closed browser window but session still active), and possibly "away" (not implemented)
function addClient(socketid, nickname, role, session, share, fn){
	// add to the client nameset first
	this.redisClient.multi().sadd(config.redis.prefix+'shares:'+share+':clients', nickname)
													.hmset(config.redis.prefix+'shares:'+share+':clients:'+nickname, "socket", socketid, "role", role, "session", session, "state", "active")
													.hset(config.redis.prefix+'shares:'+share+':sessions', session, nickname)
													.exec(fn);
	// this.redisClient.hmset(config.redis.prefix+'shares:'+share+':'+nickname, "socket", socketid, "session", session, fn);
}

function setNickname(newnick, curnick, session, share, fn){
	this.redisClient.multi().srem(config.redis.prefix+'shares:'+share+':clients', curnick)
													.sadd(config.redis.prefix+'shares:'+share+':clients', newnick)
													.hset(config.redis.prefix+'shares:'+share+':sessions', session, newnick)
													.rename(config.redis.prefix+'shares:'+share+':clients:'+curnick, config.redis.prefix+'shares:'+share+':clients:'+newnick)
													.exec(fn);	
}

function getNickname(session, share, fn){
	this.redisClient.hget(config.redis.prefix+'shares:'+share+':sessions', session, fn);
}

// to delete a client, delete the client nick then delete the associated hash
function delClient(nickname, share, fn){
	this.getClientDetails(nickname, share, function(clientData){
		this.redisClient.multi()
										.hdel(config.redis.prefix+'shares:'+share+':sessions', clientData.session)
										.srem(config.redis.prefix+'shares:'+share+':clients', nickname)
										.del(config.redis.prefix+'shares:'+share+':clients:'+nickname)
										.exec(fn);
		// this.redisClient.hdel(config.redis.prefix+'shares:'+share+':sessions', clientData.session);
	})
/*	this.redisClient.srem(config.redis.prefix+'shares:'+share+':clients', nickname);
	this.redisClient.del(config.redis.prefix+'shares:'+share+':clients:'+nickname, fn);*/
}

function markDormant(dormant, nickname, share, fn){
	if (dormant){
		this.redisClient.hset(config.redis.prefix+'shares:'+share+':clients:'+nickname, "state", "dormant", fn);
	}
	else {
		this.redisClient.hset(config.redis.prefix+'shares:'+share+':clients:'+nickname, "state", "active", fn);
	}
}

function getAllSessions(share, fn){
	this.redisClient.hkeys(config.redis.prefix+'shares:'+share+':sessions', fn);
}

// peerid is stored in metadata also
function setPeerId(peerjsid, nickname, share, fn){
	this.redisClient.hset(config.redis.prefix+'shares:'+share+':clients:'+nickname, 'peerid', peerjsid, fn);
}

function getPeerId(nickname, share, fn){
	this.redisClient.hget(config.redis.prefix+'shares:'+share+':clients:'+nickname, 'peerid', fn);
}

function setSocketId(socketid, nickname, share, fn){
	this.redisClient.hset(config.redis.prefix+'shares:'+share+':clients:'+nickname, 'socket', socketid, fn);
}

function getSocketId(nickname, share, fn){
	this.redisClient.hget(config.redis.prefix+'shares:'+share+':clients:'+nickname, socket, fn);	
}

function getMessage(msgID, share, fn){
	this.redisClient.hget(config.redis.prefix+'shares:'+share+':messages', msgID, fn);
}

function getMessageCount(share, fn){
	this.redisClient.get(config.redis.prefix+'shares:'+share+':msgID', function(err, val){
		if (!val){
			fn(0);
		}
		else {
			fn(parseInt(val));
		}
	});
}

function setSharePassword(share, role, pass, fn){
	this.redisClient.hset(config.redis.prefix+'shares:'+share, role+'pass', pass, fn);
}

// gets a block of messages and passes them as objects in an array to the callback fn, size of block is configured in config.js
// index is supposed to be history offset
// (-1 represents they don't have any history at all since they newly joined)---
// config.share.historySize-1 because redis's zrange is inclusive.
function getHistoryChunk(index, share, fn){
	this.redisClient.zrange(config.redis.prefix+'shares:'+share+':msgTimestamp', index-config.share.historySize+1, index, function(err, val){
		// at this point val is an array of the msgIDs; we are going to pass them to hmget with a callback
		if (val.length > 0){
			this.redisClient.hmget(config.redis.prefix+'shares:'+share+':messages', val, function(err, val){
				fn(val.map(JSON.parse));
			});
		}
		else {
			fn(val);
		}
		
	});
}

module.exports = function(redisClient){
	this.redisClient = redisClient;
	this.getShares = getShares;
	this.getClients = getClients;
	this.addClient = addClient;
	this.delClient = delClient;
	this.setPeerId = setPeerId;
	this.getPeerId = getPeerId;
	this.auth = auth;
	this.getShareExpiry = getShareExpiry;
	this.getClientDetails = getClientDetails;
	this.getAllClientDetails = getAllClientDetails;
	this.setNickname = setNickname;
	this.getNickname = getNickname;
	this.markDormant = markDormant;
	this.getAllSessions = getAllSessions;
	this.purgeShare = purgeShare;
	this.pruneDeadSessions = pruneDeadSessions;
	this.addMessage = addMessage;
	this.createShare = createShare;
	this.getHistoryChunk = getHistoryChunk;
	this.setSharePassword = setSharePassword;
	this.getMessage = getMessage;
	this.changeMessage = changeMessage;
	this.getMessageCount = getMessageCount;
	this.setSocketId = setSocketId;
	return this;
}