var socket;
var resumable;
var roomid;
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

  else if (msg.type == 'upload'){
    var text = $('<span/>').addClass('text-success').text("Uploading file");
    var fileicon = $('<span/>', {class: "glyphicon glyphicon-open-file", style:"font-size: 3em;"}).val(msg.id);
    var medialeft = $('<div/>').addClass("media-left").append(fileicon);
    var mediaheading = $('<h4/>').addClass('media-heading').text(msg.fileName).css('display', 'inline-block');

    var mediabody = $('<div/>').addClass("media-body").append(mediaheading, $('<p/>').text(msg.size+" bytes"));
    var bar = $('<div/>').addClass('progress').css({'width': '40%', 'display': 'block'});
    bar = bar.append( $('<div/>').addClass("progress-bar progress-bar-striped active").attr('role', 'progressbar').attr('aria-valuemax', "100").attr('aria-valuemin', '0').attr('aria-valuenow', "0").text('0%') );
    bar.hide();
    mediabody.append(bar);
    var message = $('<li id='+msg.id+'>').addClass('upload').append($('<strong/>').append(text), $('<div/>').addClass("media").append(medialeft, mediabody) );
    fn(message);
  }

  else if (msg.type == 'file'){
    var time = new Date(msg.ts);
    var text = $('<span/>').addClass('text-success').text(msg.sender + " offered a file");
    var msgTimestamp = '<span class="text-muted msgTimestamp">'+time.getFullYear().toString().slice(2,4)+'-'+(time.getMonth()+1)+'-'+time.getDate()+" "+pad(time.getHours())+':'+pad(time.getMinutes())+':'+pad(time.getSeconds())+'</span>';

    var fileicon = $('<a/>', {href: '/download?roomid='+roomid+'&file='+msg.fileID+'-'+msg.fileName, style: 'text-decoration: none; color: #000000;', download: msg.fileName}).append($('<span/>', {class: "glyphicon glyphicon-open-file dl-button", style:"font-size: 3em;"}).val(msg.id) );
    var medialeft = $('<div/>').addClass("media-left").append(fileicon);
    var mediaheading = $('<h4/>').addClass('media-heading').text(msg.fileName).css('display', 'inline-block');
    var mediabody = $('<div/>').addClass("media-body").append(mediaheading, $('<p/>').text(msg.size+" bytes"));

    var message = $('<li/>', {id: msg.id}).append(msgTimestamp).append($('<strong/>').append(text), $('<div/>').addClass("media").append(medialeft, mediabody) );

    // fileicon.append(  );
    fn(message);
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

function createUploadProgress(msg){
  console.log("CREATING UPLOAD PROGRESS");
  console.log(msg);
  renderMessage({type: 'upload', id: msg.id, fileName: msg.name, size: msg.size}, function(html){
    $('#msgs').append(html);
  });
  $('#upload').parent().hide();
  $('#cancelUpload').show();
  toggleProgress(msg.id);
}

function fileSuccess(msgID){
  $('#upload').parent().show();
  $('#cancelUpload').hide();
  $("#"+msgID+' .media-body .btn').remove();
  $('#'+msgID+' .media-body').append(renderSuccessAlert("Upload completed"));
  setTimeout(function(){
    $('#'+msgID).remove();
  }, 4000);
}

function fileError(msgID, errorMsg){
  $('#'+msgID+' .media-body').append(renderErrorAlert(errorMsg));
}

function cancelFile(msgID){
  $('#'+msgID+' .media-body').append(renderInfoAlert("Upload canceled"));
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
          // nickname = value.value;
          d.resolve();
        }
      })
      return d.promise();
    },

    success: function(response) {
      console.log('nick change success');
    }
  });

  socket = io();

  if (window.location.pathname.split('/').length > 2 && window.location.pathname.split('/')[2].length > 0){
    roomid = window.location.pathname.split('/')[2];

    socket.on('connect', function(){
      // hideNoticeModal();
      $('.modal').modal('hide');
      // resumable.upload();
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
    // apiKey = msg.apiKey;
    // initPeer();
    $('#joinModal').modal('hide');
    $('#nickname').editable('setValue', $('#join-nickname').val());
    // nickname = $('#join-nickname').val();
    if (msg.role == 'owner'){
      $('#owner_settings').show();
    }
    $('#logout').show();
  });

  socket.on('resumesuccess', function(msg){
    // hideNoticeModal();
    // apiKey = msg.apiKey;
    // initPeer();
    $('.modal').modal('hide');
    // $('#msgs').append('<li><span class="text-success">'+msg.msg+'</span></li>');
    $('#nickname').editable('setValue', msg.nickname);
    // nickname = $('#join-nickname').val();
    if (msg.role == 'owner'){
      $('#owner_settings').show();
    }
    $('#logout').show();
  });

  socket.on('createsuccess', function(msg) {
    // $('#createModal').modal('hide');
    // $('#nickname').editable('setValue', $('#create-nickname').val());
    console.log(msg);
    window.location.href = '/share/'+msg;
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
      });
    }
  });

  socket.on('disconnect', function(){
    console.log('lost connection to server');
    resumable.cancel();
    showNoticeModal('Lost connection to server', true);
  });

  socket.on('reconnecting', function(){
    $('.modal').modal('hide');
    showNoticeModal('Reconnecting to server...', false);
  });


  // var initResumableUpload = function(shareName, initCallback, successCallback, errorCallback, progressCallback, completeCallback){
  resumable = initResumableUpload(roomid, createUploadProgress, fileSuccess, fileError, updateProgress, cancelFile);
  resumable.assignBrowse($('#upload'));

  $('#cancelUpload').click(function(){
    resumable.cancel();
    $(this).hide();
    $('.upload').remove();
    $('#upload').parent().show();
  })
});