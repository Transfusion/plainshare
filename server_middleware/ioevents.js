var config = require('../config.js');
// var share = require('./share.js');
var uuid = require('node-uuid');
var shareHandler = require('./share_redis.js');
var redisCleanup = require('./redis_cleanup.js');
var fileEvents = require('./p2p_ioevents.js')();

// moved to app.js to share the sharecontainer with the frontend
// var shares = new share.shareContainer();

// module.exports = function(io, shares, redisClient){
module.exports = function(io, redisClient){
	// resume background job which takes care of share expiration
	var shareContainer = shareHandler(redisClient);
	var cleanupJobs = redisCleanup(shareContainer);

	function disconnectShare(shareid){
		var clients = io.sockets.adapter.rooms[shareid];
		var numClients = (typeof clients !== 'undefined') ? Object.keys(clients).length : 0;

		if (clients){
			Object.keys(clients).forEach(function(s){
				var s = io.sockets.connected[s];

				delete s.request.session.shares[shareid];
				s.request.session.save();
				s.emit('message', {type: 'notice', ts: Date.now(), content: "Room has expired"});
				s.disconnect();
			});
		}
	}

	shareContainer.getShares(function(err, val){
		val.forEach(function(shareid){
			console.log(shareid);
			cleanupJobs.cleanUpShare(shareid, disconnectShare);
		});

	})

	io.on('connection', function(socket){
		// console.log( io.sockets.server.eio.clients);
	  console.log('a user connected');
	  // console.log(socket.request.session);
	  if (!socket.request.session.shares){
	  	// initialize session;
	  	socket.request.session.shares = {};
	  	socket.request.session.save();
	  }

//	upon connection, check to see if the room exists..
		socket.on('checkRoom', function(roomid, fn){
			shareContainer.getShares(function(err, val){
				if (val.indexOf(roomid) == -1){
					fn(false);
				}
				else {
					fn(true);
				}
			});
		});

		// check if the session is associated with a previously dormant nickname, fn callback with session state
		socket.on('checkSession', function(shareid, fn){
			// console.log(socket.request.session.sh ares);
			// failing here
			if (socket.request.session.shares[shareid]){
				shareContainer.getClients(shareid, function(err, val){
					if(val.indexOf(socket.request.session.shares[shareid].nick) > -1){
						shareContainer.getClientDetails(socket.request.session.shares[shareid].nick, shareid, function(val){
							// console.log(val);
							if(val.state == 'dormant'){
								fn('dormant');
								// directly resume session from here
								resumeSession(shareid);
							}
							else if (val.state == 'active'){
								fn('active');
							}
							else {
								fn('nonexistent');
							}
						})
					}
					else {
						fn('nonexistent');
					}
				});
			}
			else {
				fn('nonexistent');
			}
		});

		function resumeSession(shareid){
			shareContainer.markDormant(false, socket.request.session.shares[shareid].nick, shareid, function(err, val){
				shareContainer.setSocketId(socket.id, socket.request.session.shares[shareid].nick, shareid, function(err, val){

					if (!err){
						socket.room = shareid;
						socket.join(socket.room);
						// note: we refer to a "room" as a share
						sendUserListUpdate(socket.room);

						shareContainer.getClientDetails(socket.request.session.shares[shareid].nick, shareid, function(clientDetails){

							/*shareContainer.getHistoryChunk(-1, socket.room, function(msgArray){
								if (msgArray.length < config.share.historySize){
									var moreHistory = false;
								}
								else {
									var moreHistory = true;
								}
								socket.emit('chatHistoryChunk', msgArray, moreHistory);
								socket.emit('message', {type: 'notice', content: 'Successfully rejoined '+shareid, ts: Date.now()});
								socket.emit('resumesuccess', {nickname: socket.request.session.shares[shareid].nick, role: clientDetails.role});
							// })
							});*/

							sendHistoryChunk(-1);
							socket.broadcast.to(socket.room).emit('message', {type: 'notice', ts: Date.now(), content: socket.request.session.shares[shareid].nick+' has rejoined' });
							socket.emit('message', {type: 'notice', content: 'Successfully rejoined '+shareid, ts: Date.now()});
							socket.emit('resumesuccess', {nickname: socket.request.session.shares[shareid].nick, role: clientDetails.role, apiKey: config.app.peerjsApiKey});
								
						});

						
						
					}

				});
			})
		}

		socket.on('purgeSession', function(shareid){
			purgeSession(shareid);
		});
		// most frequently used after a server restart, when users are still marked as active even though disconnected
		function purgeSession(shareid){
			var clients = io.sockets.adapter.rooms[shareid];
			shareContainer.getClientDetails(socket.request.session.shares[shareid].nick, shareid, function(clientData){
				if (clients && Object.keys(clients).indexOf(clientData.socket) > -1){
					io.sockets.connected[clientData.socket].disconnect();
				}
			})

			shareContainer.delClient(socket.request.session.shares[shareid].nick, shareid, function(err, val){
				socket.emit('disconnectReady');
				sendUserListUpdate(shareid);
				delete socket.request.session.shares[socket.room];
			})
		}

		function sendUserListUpdate(shareid){
			shareContainer.pruneDeadSessions(shareid, function(val){
				console.log('pruned!');
				shareContainer.getAllClientDetails(shareid, function(val){
					var userList = val;
					for (var i in val){
						delete userList[i].socket;
						delete userList[i].session;
					}
					var sortedList = {owners: [], viewers:[]};
					for(var i in userList){
						var role = userList[i].role;
						var userState = userList[i].state;
						if(role == 'owner'){
							sortedList['owners'].push({name: i, state: userState});
						}
						else if (role == 'viewer') {
							sortedList['viewers'].push({name: i, state: userState});
						}
					}
					console.log(sortedList);
					console.log('sentlist');
					io.sockets.in(socket.room).emit('update-userlist', sortedList);

					// { owners: [ '2345', 'jheroihnme' ], viewers: [ 'aiajsf', 'asjfdioj' ] }
				});
			});
		}

		// automatically redirect the creator to the join page
	  socket.on('createshare', function(nickname, ownerpass, viewpass){
	  	shareContainer.createShare(ownerpass, viewpass, true, function(shareID){
	  		cleanupJobs.cleanUpShare(shareID, disconnectShare);
	  		socket.emit('createsuccess', shareID);
	  	})
	  });

	  // function joinShare()
	  socket.on('joinshare', function(shareid, nickname, password){
	  	// console.log(nickname);
	  	// console.log(socket.id);
	  	// people[socket.id] = {'name': name }
	  	/*if (shares.getShareIds().indexOf(shareid) == -1){
	  		console.log('nonexistent share');
	  		socket.emit('joinfailed', "Error: share does not exist");
	  	}
*/
	// todo: fix callback hell
			// shareContainer.pruneDeadSessions(shareid, function(val){
				shareContainer.getShares(shareExists);	
			// });
			
			function shareExists(err, val){
				if (val.indexOf(shareid) == -1){
					socket.emit('joinfailed', "Error: share does not exist");
				}
				else {
					shareContainer.getClients(shareid, nicknameExists);
				}
			}

			function nicknameExists(err, val){
				if(val.indexOf(nickname) > -1 ){
					socket.emit('joinfailed', "Error: nickname has been taken");
				}
				else {
					shareContainer.auth(password, shareid, checkPass);
				}

			}

			function checkPass(role){
				if (role == 'owner'){
					shareContainer.addClient(socket.id, nickname, 'owner', socket.request.sessionID, shareid, function(err, val){
						sendJoinAck(role);
					});
					// add client as owner
				}
				else if (role == 'viewer'){
					// add client as viewer
					shareContainer.addClient(socket.id, nickname, 'viewer', socket.request.sessionID, shareid, function(err, val){
						sendJoinAck(role);
					});
				}
				else {
					socket.emit("joinfailed", "Error: Password Incorrect");
				}
				
			}

			function sendJoinAck(role){
				
				socket.room = shareid;
				// store the nickname in the session for use when recononecting
				if (!socket.request.session.shares){
					socket.request.session.shares = {};
				}
				socket.request.session.shares[shareid] = { nick:nickname } ;
				socket.request.session.shares[shareid].role = role;
				socket.request.session.save(function(err){
					socket.join(socket.room, function(err){
						sendUserListUpdate(socket.room);
						/*shareContainer.getHistoryChunk(-1, socket.room, function(msgArray){
							if (msgArray.length < config.share.historySize){
								var moreHistory = false;
							}
							else {
								var moreHistory = true;
							}
							socket.emit('chatHistoryChunk', msgArray, moreHistory);
							socket.emit('message', {type: 'notice', ts: Date.now(), content: 'Successfully joined '+ shareid});
							socket.emit('joinsuccess', role);
						})*/
						sendHistoryChunk(-1);
						socket.broadcast.to(socket.room).emit('message', {type: 'notice', ts: Date.now(), content: socket.request.session.shares[shareid].nick+' has joined' });
						socket.emit('message', {type: 'notice', ts: Date.now(), content: 'Successfully joined '+ shareid});
						socket.emit('joinsuccess', {role: role, apiKey: config.app.peerjsApiKey});
						
					});

				});
			}


	  });
	  // people[socket.id] = {"nick" : nick  };
	  socket.on('changenick', function(value, fn){
	  	shareContainer.getClients(socket.room, function(err, val){
	  		if (val.indexOf(value) > -1){
	  			fn({'exists': true});
	  		}
	  		else {
	  			console.log('---SESSIONID---');
	  			console.log(socket.request.sessionID);
	  			shareContainer.setNickname(value, socket.request.session.shares[socket.room].nick, socket.request.sessionID, socket.room, function(err, val){
	  				socket.request.session.shares[socket.room].nick = value;
	  				socket.request.session.save();
	  				sendUserListUpdate(socket.room);
	  				fn({'exists': false});
	  			});
	  		}
	  	})

	  });

	  socket.on('changepass', function(role, value, fn){
	  	shareContainer.getClientDetails(socket.request.session.shares[socket.room].nick, socket.room, function(val){
	  		console.log(val);
	  		if(val.role == 'owner'){
	  			shareContainer.setSharePassword(socket.room, role, value, function(err, val){
	  				fn({success: "Success: "+role+" password changed"});
	  			});
	  		}
	  		else {
	  			fn({error: 'You are not an owner of this room'});
	  		}
	  	})
	  });

	  socket.on('destroyroom', function(){
	  	shareContainer.getClientDetails(socket.request.session.shares[socket.room].nick, socket.room, function(val){
	  		// console.log(val);
	  		if(val.role == 'owner'){
	  			/*io.sockets.clients(socket.room).forEach(function (s){
	  				s.disconnect();
	  			});*/
	  			// socket.disconnectRoom(socket.room);

	  			console.log('---SOCKETS TO BE DESTROYED---');
	  			// io.sockets.in(socket.room).sockets.forEach(function(s){
	  			// 	delete s.request.session.shares[socket.room];
	  			// 	s.emit('message', {type: 'notice', ts: Date.now(), content: "This room is going to be closed in 5 seconds."});
	  			// 	setTimeout(function(){ s.disconnect() }, 5000);
	  			// })
	  			var clients = io.sockets.adapter.rooms[socket.room];

					//to get the number of clients
					var numClients = (typeof clients !== 'undefined') ? Object.keys(clients).length : 0;

					// http://stackoverflow.com/questions/24154480/how-to-update-socket-object-for-all-clients-in-room-socket-io/25028902#25028902
					// for (var s in clients) {
					Object.keys(clients).forEach(function(s){
					// 	//this is the socket of each client in the room.
						var s = io.sockets.connected[s];

					// 	//you can do whatever you need with this
					// 	clientSocket.emit('new event', "Updates");
						delete s.request.session.shares[socket.room];
						// console.log(s.reques)
						s.request.session.save();
						s.emit('message', {type: 'notice', ts: Date.now(), content: "This room is going to be closed in 5 seconds."});
						// (function(socket) { 
							setTimeout(function(){ 
								// console.log('purged');
								s.disconnect();
							}, 5000); 
						// }(s));
					});
					cleanupJobs.stopCleanUp(socket.room);
	  			shareContainer.purgeShare(socket.room);
	  		}
	  	});
	  });

	  socket.on('quit', function(){
	  	var name = socket.request.session.shares[socket.room].nick;
	  	shareContainer.delClient(name, socket.room, function(err, val){
	  		socket.emit('disconnectReady');
	  		delete socket.request.session.shares[socket.room];
		  	socket.request.session.save();
		  	// io.sockets.in(socket.room).emit('notice', name+" has left");
		  	io.sockets.in(socket.room).emit('message', {type: 'notice', ts: Date.now(), content: name+' has left' });
		  	sendUserListUpdate(socket.room);
	  	})
	  	
	  });

	  socket.on('disconnect', function(){
	  	if (socket.room){
	  		var shareid = socket.room;

	  		// if (!socket.request.)
	  		if (socket.request.session.shares[shareid]){
	  			// if the shareid is still present in the session the client has closed their browser tab without quitting, we consider such a peer to be "dormant"
	  			var name = socket.request.session.shares[shareid].nick;
	  			shareContainer.markDormant(true, name, shareid, function(err, val){
	  				io.sockets.in(socket.room).emit('message', {type: 'notice', ts: Date.now(), content: name+' has temporarily left' });
	  				// io.sockets.in(socket.room).emit('notice', name+" has temporarily left");
	  				sendUserListUpdate(shareid);
	  			});
	  		}
	  		else {
	  			// the shareid is not present, completely purge any trace of a client (this should have been handled by the quit function calling delClient in a normal quit otherwise)

	  		}
	  	}
	    
	  });

	  socket.on('textMessage', function(msg){
	    console.log('message: ' + msg);
	    // var name = shares.getshare(socket.room).getClientById(socket.id).name;
	    var nick = socket.request.session.shares[socket.room].nick;
	    var message = {sender: nick, type: 'text', content: msg};
	    // timestamp is supposed to be handled by the code inserting it into the db
	    shareContainer.addMessage(message, nick, socket.room, function(msgID){
	    	// done: timestamp and assigning ID (code inserting into db is responsible)
	    	io.sockets.in(socket.room).emit('message', message);
	    });
	    
	  });

	  socket.on('fileTransfer', function(msg, fn){
	  	var nick = socket.request.session.shares[socket.room].nick;
	  	var message = {sender: nick, sender_sess: socket.request.sessionID, type: 'file', name: msg.name.replace(/^C:\\fakepath\\/, ""), size: msg.size};

	  	shareContainer.addMessage(message, nick, socket.room, function(msgID){
	  		fn(msgID);
	  		socket.broadcast.to(socket.room).emit('message', message);
	  		message['fromMe'] = true;
	  		socket.emit('message', message);
	    	// io.sockets.in(socket.room).emit('message', message);

	  	});
	  });

	  function sendHistoryChunk(latestID){
	  	shareContainer.getMessageCount(socket.room, function(val){
	  		shareContainer.getHistoryChunk(latestID == -1 ? val-1 : latestID-2, socket.room, function(msgArray){
	  			msgArray.forEach(function(part, index, arr){
	  				if(part.type == 'file' && part.sender_sess == socket.request.sessionID){
	  					arr[index]['fromMe'] = true;
	  				}
	  			});
	  			console.log('HISOTAYSRFCHUN');
	  			console.log(msgArray);
					if (!msgArray.length || msgArray[0].id == 1){
						var moreHistory = false;
					}
					else {
						var moreHistory = true;
					}
					console.log(msgArray);
					socket.emit('chatHistoryChunk', msgArray, moreHistory);
					console.log('history sent');
	  		});
	  	});
	  }

	  socket.on('requestHistory', function(latestID){
	  	sendHistoryChunk(latestID);
	  });

	  fileEvents.bindFileEvents(io, socket, shareContainer);

	});

}