var bindPeerEvents = function(peer){

	console.log(peer);

	// socket.emit('peerid', peer.id);
	peer.on('open', function(id){
		console.log('peer opened');
		$('#upload').removeClass('disabled');
		$('#upload').attr('disabled', false);
		socket.emit('updatePeerId', id);
		// send ID to socket.io server to be used in file transfers
	});

	peer.on('error', function(err){
		console.log(err);
	});

	peer.on('disconnected', function(){
		// $('#upload').addClass('disabled');
		$('#upload').attr('disabled', true);
		console.log('connection to signalling server lost');
		// peer.reconnect();
		if (!socket.disconnected){
			console.log('reconnecting');
			initPeer();
		}
		
	});

	peer.on('connection', function(dataConnection){
		// peerconnections[dataConnection.peer] = dataConnection;
		dataConnection.on('data', function(msg){
			if (msg.type == 'file'){
				downloads[msg.file] = {};
				downloads[msg.file]['status'] = 'inprogress';
				downloads[msg.file]['name'] = msg.fileName;
				downloads[msg.file]['chunkSize'] = msg.chunkSize;
				downloads[msg.file]['chunks'] = msg.chunks;
				// implement retransmitting failed chunks
				// downloads[msg.file]['currentChunk'] = 0;
				downloads[msg.file]['fileBuffer'] = {};
				$('#'+msg.file+' .alert').remove();

				$('#'+msg.file+' .media-heading').css('display', 'inline-block');

				// var cancelBtn = $('<input/>').addClass('btn btn-warning btn-sm').attr({type: 'submit', value: 'Cancel'}).css('float', 'right');
				var cancelBtn = $("#"+msg.file+" input[value='Cancel']");
				cancelBtn.unbind('click');
				cancelBtn.click(function(){
					dataConnection.close();
					$('li[id='+msg.file+'] .dl-button').removeClass('not-active');
					toggleProgress(msg.file);
					downloads[msg.file]['status'] = 'aborted';
					this.remove();
				})

				// $('#'+msg.file + ' .media-heading').after(cancelBtn);

				toggleProgress(msg.file);
				dataConnection.send({type: 'fileChunk', chunk: 0, file: msg.file});
			}
			else if (msg.type == 'chunk'){
				downloads[msg.file].fileBuffer[msg.chunk] = msg.data;
				var downloadedChunks = Object.keys(downloads[msg.file].fileBuffer).length;
				if (downloadedChunks == downloads[msg.file]['chunks']){
					// download complete
					var fileBufferArray = [];
					downloads[msg.file]['status'] = 'complete';
					for (var i = 0; i < downloads[msg.file].chunks; i++){
						fileBufferArray.push(downloads[msg.file].fileBuffer[i]);
					}
					updateProgress(msg.file, 100);
					var blob = new Blob(fileBufferArray);
					saveAs(blob, downloads[msg.file].name);
					setTimeout(function(){
						$('li[id='+msg.file+'] .dl-button').removeClass('not-active');
						createSaveLink(msg.file, blob, downloads[msg.file]['name']);
						toggleProgress(msg.file);
					}, 2000);
					$("#"+msg.file+" input[value='Cancel']").remove();
					dataConnection.close();
				}
				else {
					updateProgress(msg.file, downloadedChunks/downloads[msg.file].chunks*100);
					dataConnection.send({type: 'fileChunk', chunk: msg.chunk+1, file: msg.file});
				}
			}
		});
	});

}