console.log('idcac loaded');
const { Cc, Ci, Cr } = require("chrome");

var events = require("sdk/system/events");
var request = require("sdk/request").Request;
var p = require("sdk/page-mod");
var self = require("sdk/self");
var d = self.data;
var prefs = require("sdk/simple-prefs");
var ss = require("sdk/simple-storage");

const tabsUtils = require("sdk/tabs/utils");
const tabs = require("sdk/tabs");

var domains = {};
var commons = {};
var custom_mods = {};
var block_urls = {};

const cached_host_levels = {};


// Whitelist

{
const permanent_whitelist = {
	"*.plus.google.com":1,
	"*.hangouts.google.com":1,
	"*.clients5.google.com":1,
	"*.clients6.google.com":1,
	"*.arcot.com":1,
	"*.orteil.dashnet.org":1
};

if (!ss.storage.global_exclude_list)
	ss.storage.global_exclude_list = [];

{
for (const idx of ss.storage.global_exclude_list) {
	if (permanent_whitelist[idx])
		permanent_whitelist[idx] = 0;
}
}

{
for (const i in permanent_whitelist) {
	if (permanent_whitelist[i] == 1)
		ss.storage.global_exclude_list.push(i);
}
}
} // scope: permanent whitelist


ss.on("OverQuota", function(){
	while (ss.quotaUsage > 1)
		ss.storage.global_exclude_list.pop();
});


// Global rules

const global_settings = {
	include:"*",
	exclude:ss.storage.global_exclude_list,
	attachTo:["existing","top","frame"],
	contentStyleFile:d.url("css/common.css"),
	contentScriptFile:d.url('js/embeds.js')
};

const global_settings_js = {
	include:"*",
	exclude:ss.storage.global_exclude_list,
	attachTo:["existing","top","frame"],
	contentScriptFile:d.url('js/common.js')
};

console.log('global_mod:');
var global_mod = p.PageMod(global_settings);
var global_mod_js = p.PageMod(global_settings_js);
console.log(global_mod);
console.log(global_mod_js);

// Prepare rules

request({
	url:d.url('commons.json'),
	overrideMimeType: 'application/json',
	onComplete:function(r){
		commons = r.json;
	}
}).get();

request({
	url:d.url('rules.json'),
	overrideMimeType: 'application/json',
	onComplete:function(r){
		domains = r.json;

		for (const i in domains)
			delete custom_mods[i];
	}
}).get();

request({
	url:d.url('blocking.json'),
	overrideMimeType: 'application/json',
	onComplete:function(r){
		block_urls = r.json;
	}
}).get();


// Activation functions

function activate_domain(hostname) {
	if (Object.hasOwn(custom_mods, hostname)) {
		if (Object.hasOwn(custom_mods, hostname))
			return true;

		for (const i in ss.storage.global_exclude_list) {
			if (ss.storage.global_exclude_list[i] == '*.'+hostname || ss.storage.global_exclude_list[i] == '*.www.'+hostname)
				return true;
		}

		const mod = {
			include:'*.'+hostname,
			attachTo:["existing","top","frame"]
		};

		if (Object.hasOwn(domains[hostname], 's'))
			mod.contentStyle = domains[hostname].s;
		else if (Object.hasOwn(domains[hostname], 'c'))
			mod.contentStyle = commons[domains[hostname].c];

		if (Object.hasOwn(domains[hostname], 'j'))
			mod.contentScriptFile = d.url('js/'+(domains[hostname].j > 0 ? 'common'+domains[hostname].j : hostname)+'.js');

		custom_mods[hostname] = p.PageMod(mod);

		return true;
	}

	return false;
}

function deactivate_domain(hostname) {
	if (Object.hasOwn(custom_mods, hostname)) {
		custom_mods[hostname].destroy();
		delete custom_mods[hostname];
		return true;
	}

	return false;
}

function toggle_activity(domain_in, notify) {
	const domain = domain_in.replace(/^w{2,3}\d*\./i, '');

	const domain_rule = '*.'+domain;
	let deleted = 0;

	for (const i in ss.storage.global_exclude_list) {
		if (ss.storage.global_exclude_list[i] == domain_rule) {
			ss.storage.global_exclude_list.splice(i, 1);
			deleted = 1;
			break;
		}
	}

	if (deleted == 0)
		ss.storage.global_exclude_list[ss.storage.global_exclude_list.length] = domain_rule;


	global_mod.destroy();
	global_mod = p.PageMod(global_settings);

	global_mod_js.destroy();
	global_mod_js = p.PageMod(global_settings_js);


	// Rebuild custom rule if any
	if (deleted == 1) {
		if (!activate_domain(domain)) {
			const host_parts = domain.split('.');

			for (const i=host_parts.length; i>=2; i--) {
				const part = host_parts.slice(-1*i).join('.');

				if (activate_domain(part))
					break;
			}
		}
	}

	// Destroy custom rule if any
	else {
		if (!deactivate_domain(domain)) {
			const host_parts = domain.split('.');

			// TODO: rework this.
			for (const i=host_parts.length; i>=2; i--) {
				const part = host_parts.slice(-1*i).join('.');

				if (deactivate_domain(part))
					break;
			}
		}
	}

	if (notify == null)
		sendMessage("Functionality changed for " + domain, "Please reload the page now to see the efect.");
}


// https://stackoverflow.com/questions/25194928/firefox-detect-tab-id-in-sdk-system-events-api

const getSdkTabFromChromeTab = (chromeTab) => {
  const tabId = tabsUtils.getTabId(chromeTab);
  for (const sdkTab in tabs){
    if (sdkTab.id === tabId) {
      return sdkTab;
    }
  }
  return null;
};

const getTabFromChannel = (aChannel) => {
  try {
    const notificationCallbacks = aChannel.notificationCallbacks || aChannel.loadGroup.notificationCallbacks;
    if (!notificationCallbacks)
      return null;

    const domWin = notificationCallbacks.getInterface(Ci.nsIDOMWindow);
    const chromeTab = tabsUtils.getTabForContentWindow(domWin);
    return getSdkTabFromChromeTab(chromeTab);
  }
  catch (e) {
    return null;
  }
}


function listener(event) {
	const channel = event.subject.QueryInterface(Ci.nsIHttpChannel);

	if (/\.(?:jp(?:g|eg)|gif|png|ico)$/i.test(event.subject.URI.spec.split('?')[0]))
		return;

	let hostname = (event.subject.referrer ? event.subject.referrer.host : event.subject.URI.host);
	const current_tab = getTabFromChannel(channel);

	if (!current_tab)
		return;

	for (const tab of tabs) {
		if (tab.id != current_tab.id)
			continue;

		const url_parts = tab.url.match(/^https?\:\/\/(.+?)\//)

		if (url_parts && url_parts[1]) {
			hostname = url_parts[1];
		}
	}

	hostname = hostname.replace(/^w{2,3}\d*\./i, '');

	url_blocking(channel, hostname);

	if (activate_domain(hostname))
		return;

	const possible_hosts = [];
	const host_parts = hostname.split('.');

	// TODO: rework this -- use getHostLevels()
	for (const i=host_parts.length; i>=2; i--) {
		if (activate_domain(host_parts.slice(-1*i).join('.')))
			return true;
	}
};

function getHostLevels(hostname) {
	if (!cached_host_levels[hostname]) {
		cached_host_levels[hostname] = [];

		const parts = hostname.split('.');

		// TODO: rework this
		for (const i=parts.length; i>=2; i--)
			cached_host_levels[hostname].push(parts.slice(-1*i).join('.'));
	}

	return cached_host_levels[hostname];
}

function url_blocking(channel, hostname) {
	for (const i in ss.storage.global_exclude_list) {
		const gexcl = ss.storage.global_exclude_list[i];
		// Instead of making strings, if (gexcl == '*.'+hostname || gexcl == '*.www.'+hostname)
		const hostpos = gexcle.length - hostname.length;
		if (gexcle.indexOf(hostname, hostpos) == hostpos &&
				(gexcle.indexOf('*.', hostpos-2) == hostpos-2 ||
				 gexcle.indexOf('*.www.', hostpos-6) == hostpos-6))
			return;
	}

	const clean_url = channel.URI.spec.split('?')[0],
		host_levels = getHostLevels(hostname);


	// To shorten the checklist, many filters are grouped by keywords

	if (block_urls.common_groups) {
		for (const group in block_urls.common_groups) {
			if (channel.URI.spec.indexOf(group) < 0)
				continue;

			const group_filters = block_urls.common_groups[group];

			for (const i in group_filters) {
				const group_filt = group_filters[i];

				const groupfilt_r = group_filt.r;
				const groupfilt_q = group_filt.q;
				if ((!groupfilt_q || channel.URI.spec.indexOf(groupfilt_r) < 0) &&
					(groupfilt_q || clean_url.indexOf(groupfilt_r) < 0))
					continue;
				//if ((group_filt.q && channel.URI.spec.indexOf(group_filt.r) > -1) || (!group_filt.q && clean_url.indexOf(group_filt.r) > -1)) {

				// Check for exceptions
				const groupfilt_e = group_filt.e
				if (groupfilt_e && host_levels.length > 0) {
					for (const level in host_levels) {
						for (const exception in groupfilt_e) {
							if (groupfilt_e[exception] == host_levels[level])
								return;
						}
					}
				}

				channel.cancel(Cr.NS_BINDING_ABORTED);
				return;
			}
		}
	} // if blockurls.common groups


	// Check ungrouped filters

	if (block_urls.common) {
		const group_filters = block_urls.common;

		for (const i in group_filters) {
			const group_filt = group_filters[i];

			const groupfilt_r = group_filt.r;
			const groupfilt_q = group_filt.q;
			if ((!groupfilt_q || channel.URI.spec.indexOf(groupfilt_r) < 0) ||
				(groupfilt_q || clean_url.indexOf(groupfilt_r) < 0))
				continue;

			//if ((group_filt.q && channel.URI.spec.indexOf(group_filt.r) > -1) || (!group_filt.q && clean_url.indexOf(group_filt.r) > -1)) {
				// Check for exceptions

			const groupfilt_e = group_filters[i].e;
			if (groupfilt_e && host_levels.length > 0) {
				for (const level in host_levels) {
					// can this be `of`?
					for (const exception in groupfilt_e) {
						if (groupfilt_e[exception] == host_levels[level])
							return;
					}
				}
			}

			channel.cancel(Cr.NS_BINDING_ABORTED);
			return;
		}
	} // if blockurls.common


	// Site specific filters

	if (!block_urls.specific)
		return;


	const hostnamelen = hostname.length;
	for (const domain in block_urls.specific) {

		if (domain != hostname && !hostname.endsWith(domain))
			continue;

		// verify the form is ".hostname.domain" and not "xyzhostname.domain"
		const dotpos = hostnamelen - domain.length - 1;
		if (hostname.indexOf('.', dotpos) != dotpos)
			continue;

		for (const rule of block_urls.specific[domain]) {
			if (channel.URI.spec.indexOf(rule) > -1) {
				channel.cancel(Cr.NS_BINDING_ABORTED);
				return;
			}
		}
	} // domain in block urls
}


function setNotifications(options) {
// 	if (options.loadReason === 'install')
// 		tabs.open("https://www.i-dont-care-about-cookies.eu");

//	if (options.loadReason === 'upgrade') {
// 		tabs.open("https://www.i-dont-care-about-cookies.eu/whats-new/acquisition/");

// 		require("sdk/notifications").notify({
// 			title: "'I don't care about cookies' just got better",
// 			text: "324 websites added to the list! You'll see even fewer cookie warnings than before :)\n\nMake a small donation to support this project: click here to open its homepage.",
// 			onClick: function() {tabs.open("https://www.i-dont-care-about-cookies.eu/call-for-action/2018/");}
// 		});
//	}
};

function sendMessage(title, text) {
	require("sdk/notifications").notify({
			title: title,
			text: text
		});
}

// Android
if (require("sdk/system").id == '{aa3c5121-dab2-40e2-81ca-7ea25febc110}') {
	const {Cu} = require("chrome");
	Cu.import("resource://gre/modules/Services.jsm");
	Cu.import("resource://gre/modules/Prompt.jsm");

	let menuID = null;

	function toggleMenu(visible) {
		let window = Services.wm.getMostRecentWindow("navigator:browser");
		let NativeWindow = window.NativeWindow;

		if (visible == false) {
			if (menuID) {
				NativeWindow.menu.remove(menuID);
				menuID = null;
			}

			return;
		}

		menuID = NativeWindow.menu.add({
			name:"I don't care about cookies"
		});

		NativeWindow.menu.add({
			name:"Report a cookie warning",
			parent:menuID,
			callback:function(){
				tabs.open("https://www.i-dont-care-about-cookies.eu/report/"+self.version.match(/^\d+\.\d+\.\d+/)[0]+'/'+encodeURIComponent(encodeURIComponent(tabs.activeTab.url)));
			}
		});

		NativeWindow.menu.add({
			name:"Toggle on this domain",
			parent:menuID,
			callback:function(){
				var parts = tabs.activeTab.url.split('//');

				if (parts.length > 1)
					toggle_activity(parts[1].split('/')[0].split(':')[0]);
			}
		});

		NativeWindow.menu.add({
			name:"Support this project",
			parent:menuID,
			callback:function(){
				tabs.open("https://www.i-dont-care-about-cookies.eu/");
			}
		});
	}

	function androidContextMenuListener()
	{
		toggleMenu(prefs.prefs['contextmenu']);
	}

	exports.main = function(options)
	{
		events.on("http-on-modify-request", listener);
		toggleMenu(prefs.prefs['contextmenu']);
		prefs.on("contextmenu", androidContextMenuListener);
		setNotifications(options);
	};

	exports.onUnload = function(reason)
	{
		if (reason == 'disable' || reason == 'uninstall')
		{
			events.off("http-on-modify-request", listener);
			toggleMenu(false);
			prefs.off("contextmenu", androidContextMenuListener);
			delete ss.storage.global_exclude_list;
		}
	};
} // android


// Desktop
else {
	// Context menu

	const cm = require("sdk/context-menu");
	let cm_menu;

	function toggleContextMenu(visible) {
		if (visible == false) {
			if (cm_menu)
				cm_menu.destroy();

			return;
		}

		// Shouldn't this be XUL?..
		cm_menu = cm.Menu({
			label:"I don't care about cookies",
			image:d.url("images/context-menu.png"),
			context:cm.SelectorContext("*"),
			items: [
				cm.Item({
					label:"Report a cookie warning",
					context:cm.URLContext(["http://*", "https://*"]),

					contentScript: '\
						self.on("click", function() {self.postMessage({type: "report", url: (window.location != window.parent.location ? document.referrer : document.location.href)});});\
					',

					onMessage: function (message) {
						switch (message.type) {
							case 'report':
								tabs.open("https://www.i-dont-care-about-cookies.eu/report/"+self.version.match(/^\d+\.\d+\.\d+/)[0]+'/'+encodeURIComponent(encodeURIComponent(message.url)));
								break;
						}
					}
				}),

				cm.Item({
					label: "Toggle on this website",
					context:cm.URLContext(["http://*", "https://*"]),

					contentScript: '\
						self.on("context", function() {self.postMessage({type: "info", url: (window.location != window.parent.location ? document.referrer : document.location.href)}); return true;});\
						self.on("click", function() {self.postMessage({type: "toggle", url: (window.location != window.parent.location ? document.referrer : document.location.href)});});\
					',

					onMessage: function (message) {
						const parts = message.url.split('://');

						{
						const schema = parts[0];	// Ignore unknown schemas, or bad URLs.
						if (parts.length < 2 || !(schema == 'http' || schema == 'https')) {
							return;
						}
						}

						const hostname = parts[1].split('/')[0];
						const clean_hostname = hostname.replace(/^w{2,3}\d*\./i, "");
						const domain = '*.' + clean_hostname;

						switch (message.type) {
							case 'info':
								for (const excldom of ss.storage.global_exclude_list) {
									if (excldom == domain) {
										return this.label = "Enable on " + clean_hostname;
									}
								}

								this.label = "Disable on " + clean_hostname;
								break;

							case 'toggle':
								toggle_activity(hostname, true);
								break;
						}
					}
				}),

				cm.Item({
					label:"Support this project",
					contentScript:'self.on("click",function(){self.postMessage("donate");});',
					onMessage:function(){
						tabs.open("https://www.i-dont-care-about-cookies.eu/");
					}
				})
			]
		});
	}

	function contextMenuListener() {
		toggleContextMenu(prefs.prefs['contextmenu']);
	}

	exports.main = function(options) {
		events.on("http-on-modify-request", listener);
		toggleContextMenu(prefs.prefs['contextmenu']);
		prefs.on("contextmenu", contextMenuListener);
		setNotifications(options);
	};

	exports.onUnload = function(reason) {
		if (reason == 'disable' || reason == 'uninstall') {
			events.off("http-on-modify-request", listener);
			toggleContextMenu(false);
			prefs.off("contextmenu", contextMenuListener);
			delete ss.storage.global_exclude_list;
		}
	};
}
