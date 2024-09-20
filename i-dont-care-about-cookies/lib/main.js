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

var permanent_whitelist = {
	"*.plus.google.com":1,
	"*.hangouts.google.com":1,
	"*.clients5.google.com":1,
	"*.clients6.google.com":1,
	"*.arcot.com":1,
	"*.orteil.dashnet.org":1
};

if (!ss.storage.global_exclude_list)
	ss.storage.global_exclude_list = [];

for (var i in ss.storage.global_exclude_list)
	if (permanent_whitelist[ss.storage.global_exclude_list[i]])
		permanent_whitelist[ss.storage.global_exclude_list[i]] = 0;

for (var i in permanent_whitelist)
	if (permanent_whitelist[i] == 1)
		ss.storage.global_exclude_list.push(i);

delete permanent_whitelist;

ss.on("OverQuota", function(){
	while (ss.quotaUsage > 1)
		ss.storage.global_exclude_list.pop();
});


// Global rules

var global_settings = {
	include:"*",
	exclude:ss.storage.global_exclude_list,
	attachTo:["existing","top","frame"],
	contentStyleFile:d.url("css/common.css"),
	contentScriptFile:d.url('js/embeds.js')
};

var global_settings_js = {
	include:"*",
	exclude:ss.storage.global_exclude_list,
	attachTo:["existing","top","frame"],
	contentScriptFile:d.url('js/common.js')
};

var global_mod = p.PageMod(global_settings);
var global_mod_js = p.PageMod(global_settings_js);


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
		
		for (var i in domains)
			custom_mods[i] = false;
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

function activate_domain(hostname)
{
	if (typeof custom_mods[hostname] != 'undefined')
	{
		if (custom_mods[hostname] != false)
			return true;
		
		for (var i in ss.storage.global_exclude_list)
			if (ss.storage.global_exclude_list[i] == '*.'+hostname || ss.storage.global_exclude_list[i] == '*.www.'+hostname)
				return true;
		
		var mod = {
			include:'*.'+hostname,
			attachTo:["existing","top","frame"]
		};
		
		if (typeof domains[hostname].s != 'undefined')
			mod.contentStyle = domains[hostname].s;
		else if (typeof domains[hostname].c != 'undefined')
			mod.contentStyle = commons[domains[hostname].c];
		
		if (typeof domains[hostname].j != 'undefined')
			mod.contentScriptFile = d.url('js/'+(domains[hostname].j > 0 ? 'common'+domains[hostname].j : hostname)+'.js');
		
		custom_mods[hostname] = p.PageMod(mod);
		
		return true;
	}
	
	return false;
}

function deactivate_domain(hostname)
{
	if (typeof custom_mods[hostname] != 'undefined')
	{
		if (custom_mods[hostname] == false)
			return true;
		
		custom_mods[hostname].destroy();
		custom_mods[hostname] = false;
		return true;
	}

	return false;
}

function toggle_activity(domain, notify)
{
	domain = domain.replace(/^w{2,3}\d*\./i, '');
	
	var domain_rule = '*.'+domain;
	var deleted = 0;
	
	for (var i in ss.storage.global_exclude_list)
	{
		if (ss.storage.global_exclude_list[i] == domain_rule)
		{
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
	if (deleted == 1)
	{
		if (!activate_domain(domain))
		{
			var possible_hosts = [];
			var host_parts = domain.split('.');
			
			for (var i=host_parts.length; i>=2; i--)
			{
				var part = host_parts.slice(-1*i).join('.');
				
				if (activate_domain(part))
					break;
			}
		}
	}
	
	// Destroy custom rule if any
	else
	{
		if (!deactivate_domain(domain))
		{
			var possible_hosts = [];
			var host_parts = domain.split('.');
			
			for (var i=host_parts.length; i>=2; i--)
			{
				var part = host_parts.slice(-1*i).join('.');
				
				if (deactivate_domain(part))
					break;
			}
		}
	}
	
	
	if (typeof notify != 'undefined')
		sendMessage("Functionality changed for " + domain, "Please reload the page now to see the efect.");
}


// https://stackoverflow.com/questions/25194928/firefox-detect-tab-id-in-sdk-system-events-api

const getSdkTabFromChromeTab = (chromeTab) => {
  const tabId = tabsUtils.getTabId(chromeTab);
  for each (let sdkTab in tabs){
    if (sdkTab.id === tabId) {
      return sdkTab;
    }
  }
  return null;
};

const getTabFromChannel = (aChannel) => {
  try {
    let notificationCallbacks = aChannel.notificationCallbacks || aChannel.loadGroup.notificationCallbacks;
    if (!notificationCallbacks)
      return null;

    let domWin = notificationCallbacks.getInterface(Ci.nsIDOMWindow);
    let chromeTab = tabsUtils.getTabForContentWindow(domWin);
    return getSdkTabFromChromeTab(chromeTab);
  }
  catch (e) {
    return null;
  }
} 


function listener(event)
{
	var channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
	
	if (/\.(jpg|jpeg|gif|png|ico)$/i.test(event.subject.URI.spec.split('?')[0]))
		return;
	
	var hostname = (event.subject.referrer ? event.subject.referrer.host : event.subject.URI.host);
	var current_tab = getTabFromChannel(channel);
	
	if (current_tab) {
		for (let tab of tabs) {
			if (tab.id == current_tab.id) {
				var url_parts = tab.url.match(/^https?\:\/\/(.+?)\//)
				
				if (url_parts && url_parts[1]) {
					hostname = url_parts[1];
				}
			}
		}
	}
	else
		return;
	
	hostname = hostname.replace(/^w{2,3}\d*\./i, '');
	
	url_blocking(channel, hostname);
	
	if (activate_domain(hostname))
		return;
	
	var possible_hosts = [];
	var host_parts = hostname.split('.');
	
	for (var i=host_parts.length; i>=2; i--)
		if (activate_domain(host_parts.slice(-1*i).join('.')))
			return true;
};

function getHostLevels(hostname)
{
	if (!cached_host_levels[hostname])
	{
		cached_host_levels[hostname] = [];
		
		var parts = hostname.split('.');
		
		for (var i=parts.length; i>=2; i--)
			cached_host_levels[hostname].push(parts.slice(-1*i).join('.'));
	}
	
	return cached_host_levels[hostname];
}

function url_blocking(channel, hostname)
{
	for (var i in ss.storage.global_exclude_list)
		if (ss.storage.global_exclude_list[i] == '*.'+hostname || ss.storage.global_exclude_list[i] == '*.www.'+hostname)
			return;
	
	var clean_url = channel.URI.spec.split('?')[0],
		host_levels = getHostLevels(hostname);
	
	
	// To shorten the checklist, many filters are grouped by keywords
	
	if (block_urls.common_groups)
	{
		for (var group in block_urls.common_groups)
		{
			if (channel.URI.spec.indexOf(group) > -1)
			{
				var group_filters = block_urls.common_groups[group];
				
				for (var i in group_filters)
				{
					if ((group_filters[i].q && channel.URI.spec.indexOf(group_filters[i].r) > -1) || (!group_filters[i].q && clean_url.indexOf(group_filters[i].r) > -1))
					{
						// Check for exceptions
						
						if (group_filters[i].e && host_levels.length > 0)
							for (var level in host_levels)
								for (var exception in group_filters[i].e)
									if (group_filters[i].e[exception] == host_levels[level])
										return;
						
						channel.cancel(Cr.NS_BINDING_ABORTED);
						return;
					}
				}
			}
		}
	}
	
	
	// Check ungrouped filters
	
	if (block_urls.common)
	{
		var group_filters = block_urls.common;
		
		for (var i in group_filters)
		{
			if ((group_filters[i].q && channel.URI.spec.indexOf(group_filters[i].r) > -1) || (!group_filters[i].q && clean_url.indexOf(group_filters[i].r) > -1))
			{
				// Check for exceptions
				
				if (group_filters[i].e && host_levels.length > 0)
					for (var level in host_levels)
						for (var exception in group_filters[i].e)
							if (group_filters[i].e[exception] == host_levels[level])
								return;
				
				channel.cancel(Cr.NS_BINDING_ABORTED);
				return;
			}
		}
	}
	
	
	// Site specific filters
	
	if (block_urls.specific)
	{
		for (var domain in block_urls.specific)
		{
			if (domain == hostname || hostname.endsWith('.'+domain))
			{
				for (var i in block_urls.specific[domain])
				{
					var rule = block_urls.specific[domain][i];
					
					if (channel.URI.spec.indexOf(rule) > -1)
					{
						channel.cancel(Cr.NS_BINDING_ABORTED);
						return;
					}
				}
			}
		}
	}
}


function setNotifications(options)
{
// 	if (options.loadReason === 'install')
// 		tabs.open("https://www.i-dont-care-about-cookies.eu");

	if (options.loadReason === 'upgrade')
	{
// 		tabs.open("https://www.i-dont-care-about-cookies.eu/whats-new/acquisition/");
		
// 		require("sdk/notifications").notify({
// 			title: "'I don't care about cookies' just got better",
// 			text: "324 websites added to the list! You'll see even fewer cookie warnings than before :)\n\nMake a small donation to support this project: click here to open its homepage.",
// 			onClick: function() {tabs.open("https://www.i-dont-care-about-cookies.eu/call-for-action/2018/");}
// 		});
	}
};

function sendMessage(title, text)
{
	require("sdk/notifications").notify({
			title: title,
			text: text
		});
}

// Android

if (require("sdk/system").id == '{aa3c5121-dab2-40e2-81ca-7ea25febc110}')
{
	var {Cu} = require("chrome");
	Cu.import("resource://gre/modules/Services.jsm");
	Cu.import("resource://gre/modules/Prompt.jsm");

	var menuID = null;
	
	function toggleMenu(visible)
	{
		let window = Services.wm.getMostRecentWindow("navigator:browser");
		let NativeWindow = window.NativeWindow;
		
		if (visible == false)
		{
			if (menuID)
			{
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
}


// Desktop

else
{
	// Context menu
	
	var cm = require("sdk/context-menu");
	var cm_menu = false;
	
	function toggleContextMenu(visible)
	{
		if (visible == false)
		{
			if (cm_menu)
				cm_menu.destroy();
			
			return;
		}
		
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
						var parts = message.url.split('://');
						
						if (parts.length > 1 && (parts[0] == 'http' || parts[0] == 'https')) {
							var hostname = parts[1].split('/')[0],
								clean_hostname = hostname.replace(/^w{2,3}\d*\./i, ""),
								domain = '*.' + clean_hostname;
						} else {
							return;
						}
						
						switch (message.type) {
							
							case 'info':
								for (var i in ss.storage.global_exclude_list) {
									if (ss.storage.global_exclude_list[i] == domain) {
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
	
	function contextMenuListener()
	{
		toggleContextMenu(prefs.prefs['contextmenu']);
	}
	
	exports.main = function(options)
	{
		events.on("http-on-modify-request", listener);
		toggleContextMenu(prefs.prefs['contextmenu']);
		prefs.on("contextmenu", contextMenuListener);
		setNotifications(options);
	};
	
	exports.onUnload = function(reason)
	{
		if (reason == 'disable' || reason == 'uninstall')
		{
			events.off("http-on-modify-request", listener);
			toggleContextMenu(false);
			prefs.off("contextmenu", contextMenuListener);
			delete ss.storage.global_exclude_list;
		}
	};
}