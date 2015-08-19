// Code adapted from the resumable.js node.js sample code
var fs = require('fs');
var path = require('path');

// var Stream = require('stream').Stream;
var config = require('../config.js');

module.exports = resumable = function(){
	var $ = this;
	$.fileParameterName = 'file';
	$.temporaryFolder = config.app.storageDir+'/uploads/';

	try {
    fs.mkdirSync($.temporaryFolder);
  }
  catch(e){
  	console.log(e);
  }

	var cleanIdentifier = function(identifier){
    return identifier.replace(/^0-9A-Za-z_-/img, '');
  }

  var getChunkFilename = function(chunkNumber, shareName, identifier){
    // Clean up the identifier
    identifier = cleanIdentifier(identifier);
    // What would the file name be?
    return path.join($.temporaryFolder, shareName, './resumable-'+identifier+'.'+chunkNumber);
  }

	var validateRequest = function(chunkNumber, chunkSize, totalSize, identifier, filename, fileSize){
    // Clean up the identifier
    identifier = cleanIdentifier(identifier);

    // Check if the request is sane
    if (chunkNumber==0 || chunkSize==0 || totalSize==0 || identifier.length==0 || filename.length==0) {
      return 'non_resumable_request';
    }
    var numberOfChunks = Math.max(Math.floor(totalSize/(chunkSize*1.0)), 1);
    if (chunkNumber>numberOfChunks) {
      return 'invalid_resumable_request1';
    }

    // Is the file too big?
    if($.maxFileSize && totalSize>$.maxFileSize) {
      return 'invalid_resumable_request2';
    }

    if(typeof(fileSize)!='undefined') {
      if(chunkNumber<numberOfChunks && fileSize!=chunkSize) {
        // The chunk in the POST request isn't the correct size
        return 'invalid_resumable_request3';
      }
      if(numberOfChunks>1 && chunkNumber==numberOfChunks && fileSize!=((totalSize%chunkSize)+chunkSize)) {
        // The chunks in the POST is the last one, and the fil is not the correct size
        return 'invalid_resumable_request4';
      }
      if(numberOfChunks==1 && fileSize!=totalSize) {
        // The file is only a single chunk, and the data size does not fit
        return 'invalid_resumable_request5';
      }
    }

    return 'valid';
  }

  var removeFileChunks = function(shareName, identifier, chunkSize, totalSize){
  	var numberOfChunks = Math.max(Math.floor(totalSize/(chunkSize*1.0)), 1);
  	var chunkNumber = 1;
  	var main = function(){
  		currentfile = getChunkFilename(chunkNumber, shareName, identifier);
  		fs.unlink(currentfile, function(){
  			chunkNumber++;
  			if (chunkNumber <= numberOfChunks){
  				main();
  			}
  			else {
  				return;
  			}
  		});
  	}
  	main();
  }

  var concatFile = function(shareName, senderName, identifier, filename, chunkSize, totalSize, callback){
    var numberOfChunks = Math.max(Math.floor(totalSize/(chunkSize*1.0)), 1);
    // var now = new Date();
    var w = fs.createWriteStream(path.join($.temporaryFolder, shareName, identifier+'-'+filename));
    var chunkNumber = 1;

    w.on('error', function(error){
      console.log(error);
    });

    var main = function() {
      // console.log(identifier);
      if (chunkNumber > numberOfChunks){
        w.end();
        // var removeFileChunks = function(shareName, senderName, identifier, chunkSize, totalSize){
        removeFileChunks(shareName, identifier, chunkSize, totalSize );
        callback();
        return;
      }

      currentfile = getChunkFilename(chunkNumber, shareName, identifier);
      stream = fs.createReadStream(currentfile);
      stream.pipe(w, {end: false});
      stream.on("end", function() {
        // console.log(currentfile + ' appended');
        // fs.unlink(currentfile, function(){
        chunkNumber++;
        main();
        // });
      });
    }
    main();
  }

	$.post = function(req, callback){
    if (!req.session.uploads){
      req.session.uploads = {};
      req.session.save();
    }

		var sess = req.session;
		var fields = req.body;
		var file = req.file;

    var chunkNumber = fields['resumableChunkNumber'];
    var chunkSize = fields['resumableChunkSize'];
    var totalSize = fields['resumableTotalSize'];
    var fileName = fields['resumableFilename'];
    var shareName = fields['shareName'];
    var senderName = req.session.shares[shareName].nick;
    var identifier = cleanIdentifier(fields['resumableIdentifier']+'-'+senderName);

    if (req.session.uploads[shareName] === undefined){
      // console.log("applied");
      req.session.uploads[shareName] = {};
      req.session.save();
    }

    try {
	    fs.mkdirSync($.temporaryFolder+'/'+shareName);
	  } catch(e){
	  	// console.log(e);
	  }
  

		var origName = fields['resumableIdentifier'];

		// TODO: validate the user's session - sharename combination.
		if(!file || !file.size) {
      // callback('invalid_resumable_request', null, null, null);
      callback({status: 'invalid_resumable_request'});
      return;
    }

    var validation = validateRequest(chunkNumber, chunkSize, totalSize, identifier, file.size);
    if (validation == 'valid'){
    	// console.log('VALID!');
    	// console.log(fields);
    	var chunkFileName = getChunkFilename(chunkNumber, shareName, identifier);
    	// console.log(chunkFileName);

    	fs.rename(file.path, chunkFileName, function(){

    		var currentTestChunk = 1;
    		var numberOfChunks = Math.max(Math.floor(totalSize/(chunkSize*1.0)), 1);
    		var testChunkExists = function(){
    			fs.exists(getChunkFilename(currentTestChunk, shareName, identifier), function(exists){
    				if(exists){
    					currentTestChunk++;
    					if (currentTestChunk > numberOfChunks){
                req.session.reload(function(err){
                  if(err){
                    console.log(err);
                  }
                  // console.log(req.session);
                  if (req.session.uploads[shareName][identifier]){
                    /*console.log("DUPPPED!");
                    console.log(identifier);*/
                    callback({status: 'duplicate', shareName: shareName, fileName: fileName, origName: origName, identifier: identifier, size: totalSize});
                  }
                  else {
                    req.session.uploads[shareName][identifier] = true;
                    req.session.save(function(err){

                    });
                    concatFile(shareName, senderName, identifier, fileName, chunkSize, totalSize, function(){
                      callback({status: 'done', shareName: shareName, fileName: fileName, origName: origName, identifier: identifier, size: totalSize});
                    });
                  }

                });

    					}
    					else {
    						testChunkExists();
    					}
    				}
    				else {
    					callback({status: 'partly_done', shareName: shareName, fileName: fileName, origName: origName, identifier: identifier, size: totalSize});
    				}
    			});
    		}
    		testChunkExists();
    	});
    }
    else {
    	callback({status: validation, fileName: fileName, origName: origName, identifier: identifier});
    }

	}

	$.get = function(req, callback){
		var chunkNumber = req.query.resumableChunkNumber || 0;
    var chunkSize = req.query.resumableChunkSize || 0;
    var totalSize = req.query.resumableTotalSize || 0;
    var identifier = req.query.resumableIdentifier || "";
    var filename = req.query.resumableFilename || "";
    var shareName = req.query.shareName;

    if(validateRequest(chunkNumber, chunkSize, totalSize, identifier, filename) == 'valid') {
      var chunkFilename = getChunkFilename(chunkNumber, shareName, identifier);
      fs.exists(chunkFilename, function(exists){
	      if(exists){
	      	callback({status: 'found', chunkFileName: chunkFilename, filename: filename, identifier: identifier});
	        // callback('found', chunkFilename, filename, identifier);
	      } 
	      else {
	      	callback({status: 'not_found'});
	        // callback('not_found', null, null, null);
	      }
	    });
    } 
    else {
    	callback({status: 'not_found'});
      // callback('not_found', null, null, null);
		}
	}
	return this;
}