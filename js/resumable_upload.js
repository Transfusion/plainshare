var initResumableUpload = function(shareName, initCallback, successCallback, errorCallback, progressCallback, cancelCallback){
	var r = new Resumable({
		target:'/upload',
		// chunkSize: 1*1024*1024,
		chunkSize: 512*1024,
		simutaneousUploads: 1,
		testChunks: false,
		maxFileSize: 10*1024*1024,
		// only allow one user to upload one file at once for now - perhaps dedicated file uploading box in the future?
		throttleProgressCallbacks:1,
		maxFiles: 1,

		generateUniqueIdentifier: function(file){
      return Date.now() + '-'+ file.size;
    },

		query: {shareName: shareName}
	});

	r.on('fileAdded', function(file){
		console.log('fileAdded');
		initCallback({id: file.uniqueIdentifier, name: file.fileName, size: file.size});
		r.upload();
	});

	r.on('fileSuccess', function(file, message){
		successCallback(file.uniqueIdentifier);
	});

	r.on('fileError', function(file, message){
		errorCallback(file.uniqueIdentifier, message);
	});

	r.on('fileProgress', function(file){
		progressCallback(file.uniqueIdentifier, file.progress()*100);
	});

	r.on('cancel', function(){
		cancelCallback();
	});

	return r; 
	// r.on('')
	// r.assignBrowse($('#upload'));

}