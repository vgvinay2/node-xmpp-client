var sys = require('sys'),
	xmpp = require('node-xmpp'),
	colors = require('colors'),
	events = require('events'),
	uuid = require('node-uuid');

function Pubsub(client, to) {
	this.client = client;
	if(to == null) {
		to = 'pubsub.' + this.client.jid.domain;
	}
	this.to = to;
	this._eventCallback = {};
	var pubsub = this;
	this.client.addListener('pubsub:event', function(from, node, event_, stanza) {
		if(from == pubsub.to) {
			sys.debug('a pubsub event'.yellow);
			var cb = pubsub._eventCallback[node];
			if(cb != null) {
				cb.call(pubsub, event_, stanza);
			}
		}
	});
};

sys.inherits(Pubsub, events.EventEmitter);

exports.Pubsub = Pubsub;

Pubsub.prototype.createTree = function() {
	sys.debug(new xmpp.Element('pubsub', {xmlns: 'http://jabber.org/protocol/pubsub'})
		.c('create', {node: '/home/' + this.client.jid.domain + '/user'}).up()
		.c('configure')
		.tree());
	this.client.iqSet(this.to, new xmpp.Element('pubsub', {xmlns: 'http://jabber.org/protocol/pubsub'})
		.c('create', {node: '/home/' + this.client.jid.domain + '/user'}).up()
		.c('configure')
		.tree(),
		function(stanza) {
			sys.debug(stanza.toString().yellow);
			sys.debug(stanza.getChild('pubsub', 'http://jabber.org/protocol/pubsub').toString.yellow);
		}
	);
};

Pubsub.prototype.disco = function(callback) {
	var jabber = this.client;
	this.client.iq(this.to,
		new xmpp.Element('query', {xmlns: 'http://jabber.org/protocol/disco#info'}),
		function(iq) {
			callback.call(jabber, iq.getChild('query', 'http://jabber.org/protocol/disco#info'));
		}
	);
};

Pubsub.prototype.discoNode = function(node, callback) {
	var jabber = this.client;
	this.client.iq(this.to,
		new xmpp.Element('query', {xmlns: 'http://jabber.org/protocol/disco#info', node: node}),
		function(iq) {
			callback.call(jabber, iq.getChild('query', 'http://jabber.org/protocol/disco#info'));
		}
	);
};

Pubsub.prototype.subscriptions = function(callback) {
	var jabber = this.client;
	this.client.iq(this.to,
		new xmpp.Element('pubsub', {xmlns: 'http://jabber.org/protocol/pubsub'}).c('subscriptions'),
		function(iq) {
			callback.call(jabber, iq
				.getChild('pubsub', 'http://jabber.org/protocol/pubsub')
				.getChild('subscriptions')
				.getChildren('subscription')
			);
		}
	);
};

Pubsub.prototype.nodeSubscriptions = function(node, callback) {
	var jabber = this.client;
	this.client.iq(this.to,
		new xmpp.Element('pubsub', {xmlns: 'http://jabber.org/protocol/pubsub'}).c('subscriptions', {node: node}),
		function(iq) {
			callback.call(jabber, iq
				.getChild('pubsub', 'http://jabber.org/protocol/pubsub')
				.getChild('subscriptions')
				.getChildren('subscription')
			);
		}
	);
};


Pubsub.prototype.discoNodeItems = function(node, callback) {
	var jabber = this.client;
	this.client.iq(this.to,
		new xmpp.Element('query', {xmlns: 'http://jabber.org/protocol/disco#items', node: node}),
		function(iq) {
			callback.call(jabber, iq.getChild('query', 'http://jabber.org/protocol/disco#items').getChildren('item'));
		}
	);
};


Pubsub.prototype.discoNodes = function(callback) {
	var jabber = this.client;
	this.client.iq(this.to,
		new xmpp.Element('query', {xmlns: 'http://jabber.org/protocol/disco#items'}),
		function(iq) {
			callback.call(jabber, iq.getChild('query', 'http://jabber.org/protocol/disco#items').getChildren('item'));
		}
	);
};

Pubsub.prototype.node = function(node, callback) {
	var exist = false;
	var pubsub = this;
	this.discoNodes(function(items) {
		items.forEach(function(item) {
			if(item.attrs.node == node) { exist = true; }
		});
		if(! exist) { pubsub.createNode(node, callback); }
		else { callback.call(pubsub.client); }
	});
};

Pubsub.prototype.createNodeWithName = function(node, callback, errorCallback) {
	var jabber = this.client;
	var xmppElement = new xmpp.Element('pubsub', {xmlns: 'http://jabber.org/protocol/pubsub'})
		.c('create', {node: node}).up()
		.tree();
	this.client.iqSet(this.to, xmppElement,
		function(stanza) {
			if(stanza.attrs.type === 'result') {
				callback.call(jabber);
			}
		},
		function(stanza) {
			if(stanza.attrs.type === "error") {
				errorCallback.call(jabber, stanza.children[1].children[0].name);
			}
		}
	);
};

Pubsub.prototype.deleteNodeWithName = function(node, callback, errorCallback) {
	var jabber = this.client;
	var xmppElement = new xmpp.Element('pubsub', {xmlns: 'http://jabber.org/protocol/pubsub#owner'})
		.c('delete', {node: node}).up()
		.tree();
	this.client.iqSet(this.to, xmppElement,
		function(stanza) {
			if(stanza.attrs.type === 'result') {
				callback.call(jabber);
			}
		},
		function(stanza) {
			if(stanza.attrs.type === "error") {
				errorCallback.call(jabber, stanza.children[1].children[0].name);
			}
		}
	);
};

// Pubsub.prototype.createNodeWithoutName = function(callback) {
// 	var jabber = this.client;
// 	var xmppElement = new xmpp.Element('pubsub', {xmlns: 'http://jabber.org/protocol/pubsub'})
// 		.c('create').up()
// 		.tree();
// 	this.client.iqSet(this.to, xmppElement,
// 		function(stanza) {
// 			var pubsub = stanza.getChild('pubsub', 'http://jabber.org/protocol/pubsub');
// 			if(pubsub != null) {
// 				sys.debug(pubsub.toString().yellow);
// 				callback.call(jabber);
// 			}
// 		}
// 	);
// };


Pubsub.prototype.publish = function(node, content, callback, errorCallback) {
	var jabber = this.client
	var attributes = {}
	attributes.node = node
	attributes.jid = jabber.xmpp.jid.user + '@' +jabber.xmpp.jid.domain

	this.client.publishIqSet(attributes, content, function(stanza) {
		sys.debug('PUBLISH : ' + stanza)
		sys.debug('just published'.yellow)
	}, function(stanza) {
		if(stanza.attrs.type === "error") {
				errorCallback.call(jabber, stanza.children[1].children[0].name);
			}
	})
}

Pubsub.prototype.subscribe = function(node, onMessage, onSuscribed) {
	var jabber = this.client;
	var pubsub = this;
	console.log(jabber.jid.user + '@' + jabber.jid.domain);
	jabber.iqSet(this.to, new xmpp.Element('pubsub', {xmlns: 'http://jabber.org/protocol/pubsub'})
		.c('subscribe', {
			node: node,
			jid: jabber.jid.user + '@' + jabber.jid.domain
		})
		.tree(),
		function(iq) {
			sys.debug(('Suscribe to ' + node).yellow);
			pubsub._eventCallback[node] = onMessage;
			var s = iq.getChild('pubsub', 'http://jabber.org/protocol/pubsub').getChild('subscription').attrs;
			onSuscribed.call(jabber, s.subscription, s.subid);
		}, function (iq) {
			console.log(iq.toString());
		});
};

Pubsub.prototype.affiliations = function(node, onMessage, errorCallback) {
	var jabber = this.client;
	var pubsub = this;
	jabber.affiliationsIqGet(node, onMessage, errorCallback);
}


Pubsub.prototype.defaultConfigurationForNode = function (successCallback, errorCallback) {
	this.client.defaultConfigurationIqGet(successCallback, errorCallback);
}