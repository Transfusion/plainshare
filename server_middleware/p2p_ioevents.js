// function
function bindFileEvents(io, socket, shareContainer){

	socket.on('updatePeerId', function(peerid){
		shareContainer.setPeerId(peerid, socket.request.session.shares[socket.room].nick, socket.room, function(err, val){

		});
	});

	socket.on('fileRequest', function(msgID){
		console.log('fileRequest '+msgID);
		var nick = socket.request.session.shares[socket.room].nick;
		shareContainer.getPeerId(nick, socket.room, function(err, peerID){
			if (err){
				console.log(err);
			}

			// if(peerID){
				console.log(peerID);
				// peerID is being successfully fetched

				shareContainer.getMessage(msgID, socket.room, function(err, msg){
					msg = JSON.parse(msg);
					// console.log(msg);

					shareContainer.getNickname(msg.sender_sess, socket.room, function(err, val){
						// console.log(val);
						if (val){
							shareContainer.getClientDetails(val, socket.room, function(details){
								if(Object.keys(io.sockets.adapter.rooms[socket.room]).indexOf(details.socket) > -1){
									io.sockets.connected[details.socket].emit('incomingFileRequest', {recipientPeerID: peerID, recipientNick: nick, msgID: msgID}, function(callback){
										if (!callback.accepted){
											socket.emit('fileRequestError', {errorMsg: callback.msg, msgID: msgID});
										}
									});
								}
								else {
									socket.emit('fileRequestError', {errorMsg: "Sender is away", msgID: msgID});
								}
							});
						}

						else {
							socket.emit('fileRequestError', {errorMsg: "Sender has left the room", msgID: msgID});
						}

					});

				});

			// }

		/*	else {
				socket.emit('fileRequestError', {errorMsg: "You are not connected to the peering server", msgID: msgID});
			}*/

		});

	});

	socket.on('cancelFileRequest', function(msgID){
		shareContainer.getPeerId(socket.request.session.shares[socket.room].nick, socket.room, function(err, peerID){
			shareContainer.getMessage(msgID, socket.room, function(err, msg){
					msg = JSON.parse(msg);
					shareContainer.getNickname(msg.sender_sess, socket.room, function(err, val){
						if (val){
							console.log('canceling');
							shareContainer.getClientDetails(val, socket.room, function(details){
								if(Object.keys(io.sockets.adapter.rooms[socket.room]).indexOf(details.socket) > -1){
									io.sockets.connected[details.socket].emit('cancelFileTransfer', {recipientPeerID: peerID, msgID: msgID});
								}
							});
						}
					});
			});
		});
		
	});

	socket.on('changeFile', function(msgID, newFile){
		console.log(newFile);
		shareContainer.getMessage(msgID, socket.room, function(err, val){
			var origMsg = JSON.parse(val);
			if(socket.request.sessionID == origMsg.sender_sess){
				var newMsg = {type: 'file', sender: socket.request.session.shares[socket.room].nick, sender_sess: origMsg.sender_sess, id: msgID, name: newFile.name.replace(/^C:\\fakepath\\/, ""), size: newFile.size, ts: origMsg.ts};
				shareContainer.changeMessage(newMsg, socket.room, function(err, val){
					delete newMsg['sender_sess'];
					socket.broadcast.to(socket.room).emit('messageChanged', newMsg);
					newMsg['fromMe'] = true;
					socket.emit('messageChanged', newMsg);
				})
			}

		})
		
	});

}

module.exports = function(){
	this.bindFileEvents = bindFileEvents;
	return this;
}


