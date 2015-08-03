var socket;
var oldestHistoryIndex = -1;

function showErrorModal(msg){
  $('.modal').modal('hide');
  // hideNoticeModal();
  $('#errorMsg').empty();
  $('#errorMsg').append($('<p/>').text(msg));
  $('#errorModal').modal('show');
}

function showNoticeModal(msg, dismissible){
  // hideNoticeModal();
  $('.modal').modal('hide');
  if (dismissible){
    $('#dismissibleNoticeMsg').empty();
    $('#dismissibleNoticeMsg').text(msg);
    $('#dismissibleNoticeModal').modal('show');
  }
  else {
    $('#noticeMsg').empty();
    $('#noticeMsg').text(msg);
    $('#noticeModal').modal('show');
  }
  
  
}

function hideNoticeModal(){
  $('#noticeModal').modal('hide');
}

function pad(n) {
  return (n<10 ? '0'+n : n);
}

function renderMessage(msg, fn){
  if (msg.type == 'text'){
    var time = new Date(msg.ts);
    var msgTimestamp = '<span class="text-muted msgTimestamp">'+time.getFullYear().toString().slice(2,4)+'-'+(time.getMonth()+1)+'-'+time.getDate()+" "+pad(time.getHours())+':'+pad(time.getMinutes())+':'+pad(time.getSeconds())+'</span>';

    fn('<li id='+msg.id+'>'+msgTimestamp+'<span class="text-success"><b>'+msg.sender+': </b></span>'+msg.content+'</li>');  
  }

  else if (msg.type == 'notice'){
    var time = new Date(msg.ts);
    var msgTimestamp = '<span class="text-muted msgTimestamp">'+time.getFullYear().toString().slice(2,4)+'-'+(time.getMonth()+1)+'-'+time.getDate()+" "+pad(time.getHours())+':'+pad(time.getMinutes())+':'+pad(time.getSeconds())+'</span>';
    fn('<li id='+msg.id+'>'+msgTimestamp+'<span class="text-muted">'+msg.content+'</span></li>');  
  }

  else if (msg.type == 'file'){
    var time = new Date(msg.ts);
    var text = $('<span/>').addClass('text-success').text(msg.sender + " offered a file");
    var msgTimestamp = '<span class="text-muted msgTimestamp">'+time.getFullYear().toString().slice(2,4)+'-'+(time.getMonth()+1)+'-'+time.getDate()+" "+pad(time.getHours())+':'+pad(time.getMinutes())+':'+pad(time.getSeconds())+'</span>';

    var fileicon = $('<span/>', {class: "glyphicon glyphicon-open-file dl-button", style:"font-size: 3em;"}).val(msg.id);
    var medialeft = $('<div/>').addClass("media-left").append(fileicon);

    var mediaheading = $('<h4/>').addClass('media-heading').text(msg.name).css('display', 'inline-block');
    if(msg.fromMe){
      // var mediaheading = $('<h4/>').addClass('media-heading').text(msg.name).css('display', 'inline-block');
      var changeFileSelect = $('<input/>', {type: 'file'});

      changeFileSelect.bind('change', function(){
        // console.log(this.files);
        console.log('file altered');
        var file = this.files[0];
        socket.emit('changeFile', msg.id, {name: this.files[0].name, size: this.files[0].size});
        uploads[msg.id] = {};
        uploads[msg.id]['file'] = file;
        uploads[msg.id].connections = {};
      });

      var changeFileBtn = $('<span/>').addClass('btn btn-default btn-file btn-sm').css('float', 'right').text('Change File').append(changeFileSelect);
      // mediaheading = mediaheading.append(changeFileBtn).append($('<p/>').text('Change File'));
    }
    // else {
    //   var mediaheading = $('<h4/>').addClass('media-heading').text(msg.name).css('display', 'inline-block');
    // }
    
    var mediabody = $('<div/>').addClass("media-body").append(mediaheading, changeFileBtn, $('<p/>').text(msg.size+" bytes"));

    var bar = $('<div/>').addClass('progress').css({'width': '40%', 'display': 'block'});
    bar = bar.append( $('<div/>').addClass("progress-bar progress-bar-striped active").attr('role', 'progressbar').attr('aria-valuemax', "100").attr('aria-valuemin', '0').attr('aria-valuenow', "0").text('0%') );
    bar.hide();
    mediabody.append(bar);
    var message = jQuery('<li/>', {id: msg.id}).append(msgTimestamp).append($('<strong/>').append(text), $('<div/>').addClass("media").append(medialeft, mediabody) );
    // var media = 
    // $('#msgs').append(message);
    fn(message);

    fileicon.click(function(){
      requestFile(this.value);
      // console.log(this.value);
    });
    // start downloading on icon click
  }
}

function renderErrorAlert(errorMsg){
  return "<div class='alert alert-danger alert-dismissible' role='alert'><span class='glyphicon glyphicon-exclamation-sign' aria-hidden='true'></span><button type='button' class='close' data-dismiss='alert' aria-label='Close'><span aria-hidden='true'>&times;</span></button><span class='sr-only'>Error:</span> "+errorMsg+"</div>";
}

function renderSuccessAlert(successMsg){
  return "<div class='alert alert-success alert-dismissible' role='alert'><span class='glyphicon glyphicon-exclamation-sign' aria-hidden='true'></span><button type='button' class='close' data-dismiss='alert' aria-label='Close'><span aria-hidden='true'>&times;</span></button><span class='sr-only'>Error:</span> "+successMsg+"</div>";
}

function renderInfoAlert(infoMsg){
  return "<div class='alert alert-info alert-dismissible' role='alert'><span class='glyphicon glyphicon-exclamation-sign' aria-hidden='true'></span><button type='button' class='close' data-dismiss='alert' aria-label='Close'><span aria-hidden='true'>&times;</span></button><span class='sr-only'>Error:</span> "+infoMsg+"</div>";
}

function toggleProgress(msgID){
  // $('li[id='+msgID+'] .glyphicon').toggleClass('not-active');
  $('li[id='+msgID+'] .progress').toggle();
}

function updateProgress(msgID, progress){
  var bar = $('li[id='+msgID+'] .progress-bar');
  bar.css('width', Math.floor(progress)+'%').attr('aria-valuenow', progress).text(Math.floor(progress)+'%');
}

$( document ).ready(function() {

  var qrcode = new QRCode("qrcode", {width: 256, height: 256});
  qrcode.makeCode(window.location.href);
  console.log("done");

  $('#showQR').click(function(e){
    e.preventDefault();
    $('#qrModal').modal('show');
  });

  $('#nickname').editable({
    pk: 1,
    url: function(value) {
      var d = new $.Deferred;
      socket.emit('changenick', value.value, function(data){
        // console.log('---DATA--');
        // console.log(data);
        if (data.exists){
          // return "Error: nickname has been taken";
          d.reject('Error: nickname has been taken');
        }
        else {
          d.resolve();
        }
      })
      return d.promise();
    },

    success: function(response) {
      console.log('nick change success');
    }
  });

  // $('#joinModal').modal('show');
  // $('#nickname').editable('show');

  socket = io();

  if (window.location.pathname.split('/').length > 1 && window.location.pathname.split('/')[1].length > 0){
    var roomid = window.location.pathname.split('/')[1];

    socket.on('connect', function(){
      // hideNoticeModal();
      $('.modal').modal('hide');
      socket.emit('checkRoom', roomid, checkRoomExists);
    });

  }

  else {
    $('.modal').modal('hide');
    $('#createModal').modal('show');
  }

  function checkRoomExists(exists){
    if (!exists){
      // $('#nExistModal').modal('show');
      showErrorModal('This share does not exist - check URL.');
    }
    else {
      socket.emit('checkSession', roomid, checkSessionState);
    }
  }

  function checkSessionState(val){
    console.log(val);
    if (val == 'active'){
      showErrorModal('You are already in this room!');
      var terminateBtn = $('<button/>').addClass('btn btn-danger').text('Terminate other connection');
      terminateBtn.on('click', function(){
        socket.emit('purgeSession', roomid);
      });
      $('#errorMsg').append(terminateBtn);
    }
    else if (val == 'dormant'){
      // the joining will be automatically handled by the server
      $('.modal').modal('hide');
      showNoticeModal('Resuming session...', false);
    }
    else {
      $('.modal').modal('hide');
      $('#joinModal').modal('show');
    }
  }

  // socket.emit('joinshare', 'main');

  $('#join-form').submit(function() {
    console.log('attempting to join');
    socket.emit('joinshare', roomid, $('#join-nickname').val(), $('#join-password').val());
    return false;
  });

  $('#create-form').submit(function() {
    console.log('attempting to create');
    socket.emit('createshare', $('#create-nickname').val(), $('#create-ownerpass').val(), $('#create-viewpass').val());
    return false;
  });

  $('#loadHistory').click(function(e){
    e.preventDefault();
    console.log(oldestHistoryIndex);
    socket.emit('requestHistory', oldestHistoryIndex);
  })

  $('#logout').click(function(e){
    e.preventDefault();
    socket.emit('quit');
  })

  $('#owner_passchange').click(function(e){
    e.preventDefault();
    $('#owner_changepassModal').modal('show');
  });

  $('#owner_destroyroom').click(function(e){
    e.preventDefault();
    socket.emit('destroyroom');
  });

  socket.on('joinfailed', function(msg) {
    console.log(msg);
    $('#joinModal div.modal-body').prepend(renderErrorAlert(msg));
    $('#joinModal').modal('show');
  });

  socket.on('update-userlist', function(msg){
    // console.log('userlist refreshed');
    /*var userArray = [];
    for(var i in msg) {
        userArray.push(msg[i]);
    }
    console.log(userArray);
    var groupedArray = transformArr(userArray);*/
    $('#users').empty();

    $('#users').append('<li class="list-group-item"><strong>Users</strong></li>');

    for (var i in msg['owners']) {
      var listEntry = $('<li/>').addClass('list-group-item list-group-item-success');
      if (msg['owners'][i].state == 'dormant'){
        listEntry = listEntry.addClass('disabled');
      }
      $('#users').append(listEntry.text(msg['owners'][i].name));
    }

    for (var i in msg['viewers']) {
      // $('#users').append('<li class="list-group-item">'+msg['viewers'][i]+'</li>');
      var listEntry = $('<li/>').addClass('list-group-item');
      if (msg['viewers'][i].state == 'dormant'){
        listEntry = listEntry.addClass('disabled');
      }
      $('#users').append(listEntry.text(msg['viewers'][i].name));
    }
  });

  socket.on('joinsuccess', function(msg) {
    apiKey = msg.apiKey;
    initPeer();
    $('#joinModal').modal('hide');
    $('#nickname').editable('setValue', $('#join-nickname').val());
    if (msg.role == 'owner'){
      $('#owner_settings').show();
    }
    $('#logout').show();
  });

  socket.on('resumesuccess', function(msg){
    // hideNoticeModal();
    apiKey = msg.apiKey;
    initPeer();
    $('.modal').modal('hide');
    // $('#msgs').append('<li><span class="text-success">'+msg.msg+'</span></li>');
    $('#nickname').editable('setValue', msg.nickname);
    if (msg.role == 'owner'){
      $('#owner_settings').show();
    }
    $('#logout').show();
  });

  socket.on('createsuccess', function(msg) {
    // $('#createModal').modal('hide');
    // $('#nickname').editable('setValue', $('#create-nickname').val());
    console.log(msg);
    window.location.href = '/'+msg;
  });

  // socket.on('notice', function(msg) {
  //   $('#msgs').append('<li><span class="text-muted">'+msg+'</span></li>');
  // });

  socket.on('disconnectReady', function(){
    socket.disconnect();
    location.reload();
  });

  socket.on('chatHistoryChunk', function(msgArray, more){
    console.log('received history chunk');
    console.log(msgArray);
    if (msgArray.length){
      oldestHistoryIndex = msgArray[0].id;
      msgArray = msgArray.reverse();
      console.log(msgArray);
      for (var i = 0; i < msgArray.length; i++){
        renderMessage(msgArray[i], function(html){
          $('#msgs').prepend(html);  
        })
      }
    }
    
    if(more){
      $('#loadHistory').show();
    }
    else {
      $('#loadHistory').hide();
    }
  });

  $('#chatform').submit(function(){
    if ($('#msg').val()){
      socket.emit('textMessage', $('#msg').val());
      $('#msg').val(''); 
    }
    
    return false;
  });

  $('#owner-changepassform').submit(function(e){
    e.preventDefault();

    if ($('#new-viewer-password').val()){
      console.log('changing viewer password');
      socket.emit('changepass', 'viewer', $('#new-viewer-password').val(), alertSuccess);  
    }

    if ($('#new-owner-password').val()){
      socket.emit('changepass', 'owner', $('#new-owner-password').val(), alertSuccess);  
    }    

    function alertSuccess(val){
      if (val.error){
        $('#owner_changepassModal').find('.modal-body').prepend(renderErrorAlert(val.error));
      }
      else {
        $('#owner_changepassModal').find('.modal-body').prepend(renderSuccessAlert(val.success));
      }
    }

    return false;
  });
  
  socket.on('message', function(msg){
    // console.log("test");
    console.log(msg);
    renderMessage(msg, function(html){
      $('#msgs').append(html);
      $('#msgBox').scrollTop($('#msgBox').get(0).scrollHeight);
    })
    
  });

  socket.on('messageChanged', function(msg){
    console.log(msg);
    if ($('#'+msg.id).length > 0){
      // $('#'+msg.id).replaceWith(renderMessage(msg));
      renderMessage(msg, function(html){
        $('#'+msg.id).replaceWith(html);
      })
    }
  });

  // todo: put all client-side p2p transfer requests into another file
  socket.on('incomingFileRequest', function(msg, fn){
    console.log(msg);
    if (msg.recipientPeerID == peer.id){
      console.log('Sending to yourself!');
      $('#'+msg.msgID + " input[value='Cancel']").remove();
      $('#'+msg.msgID+' .glyphicon').addClass('not-active');
      $('#'+msg.msgID+' .media-body').append(renderErrorAlert('You are the sender of this file.'));
    }
    else {
      if (msg.msgID in uploads){
        fn({accepted: true});
        transferFile(msg.msgID, msg.recipientPeerID);
      }
      else {
        fn({accepted: false, msg: "Sender no longer has file"});
      }
    }
  })

  // disconnect the dataconnection which is not open yet
  socket.on('cancelFileTransfer', function(msg){
    uploads[msg.msgID].connections[msg.recipientPeerID].close();
    uploads[msg.msgID].connections[msg.recipientPeerID].on('open', function(){
      this.close();
    })
    console.log('canceled '+msg.msgID);
  })

  socket.on('fileRequestError', function(msg){
    console.log(msg);
    $('#'+msg.msgID + " input[value='Cancel']").remove();
    $('#'+msg.msgID+' .alert').remove();
    // $('#'+msg.msgID+' .glyphicon').addClass('not-active');
    $('#'+msg.msgID+' .media-body').append(renderErrorAlert(msg.errorMsg));
  })

  socket.on('disconnect', function(){
    console.log('lost connection to server');
    showNoticeModal('Lost connection to server', true);
  });

  socket.on('reconnecting', function(){
    $('.modal').modal('hide');
    showNoticeModal('Reconnecting to server...', false);
  });

  $('#upload').bind('change', function(){
    var file = this.files[0];
    socket.emit('fileTransfer', {name: this.value, size: file.size}, function(msgID){
      // console.log(msgID);
      uploads[msgID] = {file: file, connections: {} };
      // store it in the uploads{} in filehandler.js for future retrieval
      // connections is an object of peerids to connections in progress
    });
  });

});