var peer; 
var apiKey = 'ncqqatxvvz589f6r';
// your own peer object
// var peerconnections = {};
var peerIDs = {};
// peerIDs is an updated mapping of names to actual peerIDs; easier to handle the other peer reconnecting to the peerserver
// peerconnections is a mapping of peerids to dataconnection objects - leave this alone for now
var chunkSize = 25000;
// transfer files in chunks of 25 KB (implement blocks later?)

var initPeer = function(){
	if (peer){
		peer.destroy();
	}
	peer = new Peer({key: apiKey});
	// all the peer's events are in peerevents.js
	bindPeerEvents(peer);
}