var uploads = {};
var chunkSize = 25000;
// transfer files in chunks of 25 KB
var downloads = {};

function requestFile(msgID){
	console.log('downloading '+msgID);
	$('li[id='+msgID+'] .dl-button').addClass('not-active');
	if (!peer.open){
		$('li[id='+msgID+'] .dl-button').removeClass('not-active');
		// $('#'+msg.msgID+' .alert').remove();
    // $('#'+msg.msgID+' .glyphicon').addClass('not-active');
    $('#'+msgID+' .media-body').append(renderErrorAlert('You are not connected to the peering server'));
	}
	else {
		var cancelBtn = $('<input/>').addClass('btn btn-warning btn-sm').attr({type: 'submit', value: 'Cancel'});
		cancelBtn.click(function(){
			$('li[id='+msgID+'] .dl-button').removeClass('not-active');
			socket.emit('cancelFileRequest', msgID);
			this.remove();
		})

		// $('#'+msgID + ' .media-heading').css('display', 'inline-block');
		$('#'+msgID + ' .media-heading').after($('<div/>').css('float', 'right').append(cancelBtn));

		$('#'+msgID+' .media-body').append(renderInfoAlert('Connecting to sender'));
		socket.emit('fileRequest', msgID);
	}
}

// the uploader is responsible for providing the appropriate file as requested by an incomingFileRequest socket event
function transferFile(msgID, peerID){
	var senderConn = peer.connect(peerID, {reliable: true});
	uploads[msgID].connections[peerID] = senderConn;
	senderConn.on('open', function(){
		senderConn.send({type: 'file', file: msgID, fileName: uploads[msgID].file.name, chunkSize: chunkSize, chunks: Math.ceil(uploads[msgID].file.size/chunkSize)});
	})

	senderConn.on('data', function(msg){
		if (msg.type == 'fileChunk'){
			var reader = new FileReader();
			reader.onloadend = function(evt){
				if (evt.target.readyState == FileReader.DONE) {
					senderConn.send({type: 'chunk', file: msgID, chunk: msg.chunk, data: evt.target.result});
				}
			}
			var chunk = uploads[msg.file].file.slice(msg.chunk*chunkSize, (msg.chunk+1)*chunkSize);
			reader.readAsArrayBuffer(chunk);
		}
	})

}

var createSaveLink = function(msgID, blob, fileName){
	var saveBtn = $('li[id='+msgID+'] .btn');
	if(saveBtn.length){
		saveBtn.off('click');
		saveBtn.on('click', function(){
			saveAs(blob, fileName);
		});
	}
	else {
		saveBtn = $('<button/>').addClass("btn btn-success btn-xs").attr('type', 'button').text('Save');
		saveBtn.on('click', function(){
			saveAs(blob, fileName);
		});

		$('li[id='+msgID+'] .media-left').append(saveBtn);
	}
}