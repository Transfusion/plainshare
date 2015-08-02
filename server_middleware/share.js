var hashid = require("hashids");
var hash = new hashid((Math.random() + 1).toString(36).substring(7));
// used to generate share urls/names

// clients in a share is simply a map of socketid to name and role
// function client(name, socketid, role) {
function client(name, role){
	this.name = name;
	// this.socketid = socketid;
	this.role = role;
	// role is supposed to be owner, viewer, etc, represent the level of control someone has over a share
};

function share(ownerpass, viewpass, persistent) {  
	this.clients = {};
  this.ownerpass = ownerpass;
  this.viewpass = viewpass;
  this.persistent = persistent;
  // this.filestorage
  // this.status = "available";
};

share.prototype.addClient = function(socketid, client) {  
	// this.clients.push(client);
	this.clients[socketid] = client;
};

share.prototype.getClientByName = function(clientname) {
	for (var i in this.clients) {
			// console.log(this.clients[i].name);
		if (this.clients[i].name.toLowerCase() === clientname.toLowerCase()) {
			console.log('match!!');
			return this.clients[i];
		}
	}
	return null;
}

share.prototype.getClientById = function(clientId) {
	if ( Object.keys(this.clients).indexOf(clientId) == -1){
		return null;
	}
	return this.clients[clientId];
}

share.prototype.delClient = function(clientId) {
	delete this.clients[clientId];
  // TODO: if client is the only client remaining then close the room as well (or handle persistence in a different way)
};

function shareContainer(){
	var sharecounter = 0;
	var shares = {};
	// Test line to add a share
	shares['main'] = new share("1234", "2345", true);
	// a mapping of share ids to shares

	// returns the id of the share
	this.addshare = function(share) {
		var genid = hash.encode(sharecounter);
		shares[genid] = share;
		sharecounter++;
		return genid;
	}

	this.delshare = function(share) {
		delete shares[share];
	}

	this.getShareIds = function() {
		return Object.keys(shares);
	}

	this.getshare = function(shareid) {
		return shares[shareid];
	}
}


exports.shareContainer = shareContainer;
exports.share = share;
exports.client = client;