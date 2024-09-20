/* jshint globalstrict: true */
/* eslint-disable strict */
"use strict";

const Ci = Components.interfaces;

//Note: This uses stuff from the global window object, to whit:
//
//gContextMenu
//urlSecurityCheck
//openLinkIn
//
//Treat with care as neither appear to be documented

/* eslint-disable array-bracket-newline */
/* exported EXPORTED_SYMBOLS */
const EXPORTED_SYMBOLS = [
	'Open_Link_Overlay', /* exported Open_Link_Overlay */
];
/* eslint-enable array-bracket-newline */

const hide_entries = [
	'context-back',
	'context-bookmarkframe',
	'context-bookmarkpage',
	'context-bookmarklink',
	'context-copyemail',
	'context-copyimage-contents',
	'context-forward',
	'context-keywordfield',
	'context-openframe',
	'context-openlink',
	//'context-openlinkincurrent',	// nyaa.si -- load preview links with right-click "o"
	'context-openlinkprivate',
	'context-reload',
	'context-saveframe',
	'context-savepage',
	'context-searchselect',
	'context-selectall',
	'context-sendimage',
	'context-sendlink',
	'context-sendpage',
	'context-sep-stop',
	'context-stop',
	'zapanything-do-leave-selection',
	'spell-add-dictionaries',
	'noscript-context-menu',
	'refcontrol_sep',
	'refcontrol_options',
	'refcontrol_options_link',
	'SecretAgent_content_area_context_menu_forcerotation',
	'SecretAgent_content_area_context_menu_prefs',
];

//For some reason I don't understand, with env browser set, Cu.import is
//recognised as importing the symbol with the name of the module. But not if
//not in browser mode. However, that mode enables a lot of other things that
//shouldn't be enabled.

/* global PrivateBrowsingUtils */
Components.utils.import('resource://gre/modules/PrivateBrowsingUtils.jsm');

const { console } = Components.utils.import(
	'resource://gre/modules/Console.jsm',
	{}
);

const { setTimeout } = Components.utils.import(
	'resource://gre/modules/Timer.jsm',
	{}
);

const Window_Watcher = Components.classes[
	'@mozilla.org/embedcomp/window-watcher;1'].getService(
	Components.interfaces.nsIWindowWatcher);

const Prefs = Components.classes[
	'@mozilla.org/preferences-service;1'].getService(
	Components.interfaces.nsIPrefService).getBranch('openlink.');

const Prefs_Tabs = Components.classes[
	'@mozilla.org/preferences-service;1'].getService(
	Components.interfaces.nsIPrefService).getBranch('browser.tabs.');

//List of items I add to the popup menu
const open_link_menu_items = [
	'openlink-openlinkin-current-tab'
];

//List of other things in the context menu which might need to be hidden
const global_menu_items = [
	//'context-openlinkincurrent', //only available for plain text?
	'context-openlinkintab',
	//tm-linkWithHistory (duplicated tab)
	//tm-openAllLinks  (this tab)
	//tm-openinverselink (other [b/g vs f/g] tab)
	'context-openlink',
	//context-openlinkprivate <== we should implement this
];

/** A wrapper for event listeners that catches and logs the exception
 * Used mainly because the only information you get in the console is the
 * exception text which is next to useless.
 *
 * @param {Function} func - function to call
 * @param {Object} object - object to which to bind call
 * @param {Object} params - extra params to function call
 *
 * @returns {Function} something that can be called
 */
function event_binder(func, object, ...params) {
	if (func === undefined) {
		throw new Error('Attempting to bind undefined function');
	}
	return (...args) =>
	{
		try
		{
			func.bind(object, ...params)(...args);
		}
		catch (err) {
			console.log(err);
		}
	};
}

/** Add event listeners taking care of binding
 *
 * @param {Object} object - the class to which to bind all the listeners
 * @param {Document} document - the dom to which to listen
 * @param {Array} listeners - the listeners to add. This is an array of arrays,
 *                            element 0: The node id
 *                            element 1: The event to listen for
 *                            element 2: method to call. This will be bound to
 *                            the object
 *                            elements 3: extra parameters to pass to the method
 *
 * @returns {Array} A list of event handlers to pass to remove_event_listeners
 */
function add_event_listeners(object, document, ...listeners) {
	const to_remove = [];
	for (const listener of listeners) {
		const node = typeof listener[0] == 'string' ?
			document.getElementById(listener[0]) : listener[0];
		if (node == null) {
			console.log(listener);
		}
		const event = listener[1];
		/*jshint -W083*/
		const method = event_binder(listener[2], object, ...listener.slice(3));
		/*jshint -W083*/
		node.addEventListener(event, method);
		to_remove.push({ node, event, method });
	}
	return to_remove;
}

/** The counterpart to add_event_listeners, which can be called to deregister
 * all the registered event listeners
 *
 * @param {Array} listeners - result of calling add_event_listeners
 */
function remove_event_listeners(listeners) {
	for (const listener of listeners) {
		listener.node.removeEventListener(listener.event, listener.method);
	}
}

/** The main module for the extension
 *
 * @param {Object} document - main window document
 */
function Open_Link_Overlay(document) {
	this._document = document;
	this._window = document.defaultView;

	//console.log('Open Link started.');

	/* eslint-disable array-bracket-newline */
	this._event_listeners = add_event_listeners(
		this,
		null,
		[ this._window, 'load', this._window_loaded ]
	);
	/* eslint-enable array-bracket-newline */
	this.observe = event_binder(this._observe, this);
	this._on_window_load = event_binder(this.__on_window_load, this);

	//console.log('Open Link loaded.');
}

Object.assign(Open_Link_Overlay.prototype, {

	/** Called when window has finished loading. Add listeners
 	*
 	* @param {LoadEvent} _event - window load
	*/
	_window_loaded(_event) {
		remove_event_listeners(this._event_listeners);

		//At this point we could/should check if the current version is different to
		//the previous version and throw up a web page

		//Note: It is arguably bad practice decoding the node IDs to determine what
		//we are actually going to do, but it avoids massive amounts of repetetive
		//code

		console.log('Window loaded.');

		//FIXME This looks like something that could be automatically generated.
		this._event_listeners = add_event_listeners(
			this,
			this._document,
			[ this._window, 'unload', this._stop_extension ],
			[
				this._document.getElementById('contentAreaContextMenu'),
				'popupshowing',
				this._show_context_menu
			],
			////Normal context menu
			//[ "openlink-openlinkin-background-tab", "command", this._open_link_in ],
			//[ "openlink-openlinkin-foreground-tab", "command", this._open_link_in ],
			//[ "openlink-openlinkin-background-window", "command", this._open_link_in ],
			//[ "openlink-openlinkin-current-tab", "command", this._open_link_in ],
			////submenu entries
			//[ "openlink-open-link-in-new-tab", "command", this._open_link_in ],
			//[ "openlink-open-link-in-background-tab", "command", this._open_link_in ],
			//[ "openlink-open-link-in-foreground-tab", "command", this._open_link_in ],
			//[ "openlink-open-link-in-new-window", "command", this._open_link_in ],
			//[ "openlink-open-link-in-background-window", "command", this._open_link_in ],
			//[ "openlink-open-link-in-current-tab", "command", this._open_link_in ],

			// Images
			// Extra parameters occur after function..
			[ 'context-open-image-new-tab', 'command', this._open_image_in, 'image' ],
			//[ 'context-open-image-new-tab', 'command', this._open_image_in, 'backgroundimage' ],
		);

		//const context_menu = this._window.gContextMenu;
		//console.log('gContextMenu: ' + context_menu);
	},

	/** Called on shutdown
 	*
 	* @param {UnloadEvent} _event - window unload
 	*/
	_stop_extension(_event) {
		remove_event_listeners(this._event_listeners);
	},

	/** Context menu being displayed
 	*
 	* It decides which open link menu elements should be shown.
 	*
 	* @param {MouseEvent} event - popupshowing event
 	*/
	_show_context_menu(event) {
		//When submenus are accessed we can come back through here.
		if (event.target.id != 'contentAreaContextMenu') {
			return;
		}
		
		const context_menu = this._window.gContextMenu;

		const document = this._document;
		// Image items to show
		console.log(event.target.innerHTML);

		for (let id of hide_entries) {
			let elem = document.getElementById(id);
			if (!elem) {
				console.log('Unable to get element for hide_entries id: ' + id);
				continue;
			}
			document.getElementById(id).hidden = true;
		}

		// Hide the Open Image if no img url
		const mediaURL = context_menu.mediaURL;
		const bgImageURL = context_menu.bgImageURL;
		//console.log('bgImageURL: ' + context_menu.bgImageURL);
		//console.log('mediaURL: ' + context_menu.mediaURL);

		//// Check the target child(ren) for images
		//if (!mediaURL) {
		//	for (const chd of event.target.childNodes) {
		//		if (chd.childNodes) {
		//			for (const chd of chd.childNodes) {
		//				if (chd.tagName != 'IMG')
		//					continue;
		//				mediaURL = chd.src;
		//				break;
		//			}
		//		}
		//		if (mediaURL)
		//			break;

		//		if (chd.tagName != 'IMG')
		//			continue;

		//		mediaURL = chd.src;
		//		break;
		//	}
		//}

		// only show for bgImageUrl if there is no .textContent
		//console.log("Text content: " + context_menu.target.textContent);

		const context_target_text = context_menu.target.textContent;
		const hasText = !!(context_target_text && context_target_text.length > 0);
		//console.log("Item has text: " + (hasText ? "true" : "false") + '/' + hasText + "; bgImageUrl: " + context_menu.bgImageURL + "; mediaURL: " + mediaURL + "(" + !!mediaURL + "); hidden: " +!(!hasText && context_menu.bgImageURL || mediaURL) );
		document.getElementById('context-open-image-new-tab').hidden =
						!(!hasText && bgImageURL || mediaURL);

		//const open_in_bg = Prefs_Tabs.getBoolPref('loadInBackground', false);
		//const is_private = PrivateBrowsingUtils.isWindowPrivate(this._window);
		//console.log('Context open image in tab: ' + ctxOpenImageTab.hidden + ' - ' + view_bg_image.hidden);
		//ctxOpenImageTab.hidden = ctxOpenImageTab.hidden && view_bg_image.hidden;
	},

	/** Generic code for handling disabling inappropriate menu entries
 	*
 	* @param {MouseEvent} event - popup showing event
 	*/
	_set_popup_entries(event) {
		const id = event.target.parentNode.id + '-in-';

		//const open_in_bg = Prefs_Tabs.getBoolPref('loadInBackground', false);

		//this._document.getElementById(id + 'background-tab').hidden = open_in_bg;
		//this._document.getElementById(id + 'foreground-tab').hidden = ! open_in_bg;

		//const is_private = PrivateBrowsingUtils.isWindowPrivate(this._window);
		//this._document.getElementById(id + 'new-window').hidden = is_private;
		//this._document.getElementById(id + 'background-window').hidden = is_private;
	},

	/** General event handler for pretty much everything involving a link
 	*
 	* This more or less does the same as the default context menu items with a
 	* little tweaking for allowing background tabs and so on
 	*
 	* @param {XULCommandEvent} event - Command event
 	*/
	_open_link_in(event) {
		const id = event.target.id.split("-");
		const where = id[id.length - 2];
		const mode = id[id.length - 1];

		const context_menu = this._window.gContextMenu;

		//This check is probably extreme paranoia
		if (! context_menu ||
				! context_menu.linkURL ||
				! context_menu.target ||
				! context_menu.target.ownerDocument) {
			return;
		}

		const url = context_menu.linkURL;
		const document = context_menu.target.ownerDocument;

		this._window.urlSecurityCheck(url, document.nodePrincipal);

		this._open_link_open_in(url, where, mode, document);
	},

	/** General event handler for foreground/background images
 	*
 	* @param {XULCommandEvent} event - Command event
 	*/
	_open_image_in(event, type) {
		const target = event.target;
		console.trace();

		const context_menu = this._window.gContextMenu;
		if (! context_menu ||
				! (context_menu.mediaURL || context_menu.bgImageURL)) {
			return;
		}

		const document = context_menu.target.ownerDocument;
		//console.log('bgImageURL: ' + context_menu.bgImageURL);
		//console.log('mediaURL: ' + context_menu.mediaURL);

		const viewURL = context_menu.mediaURL || context_menu.bgImageURL;

		//For reasons that are unclear this check fails if you have a chrome:: url
		//moreover, if you disable the check (or use + ALLOW_CHROME) and launch in a
		//tab, the tab doesn't actually load the image
		this._window.urlSecurityCheck(
			viewURL,
			context_menu.browser.contentPrincipal,
			Components.interfaces.nsIScriptSecurityManager.DISALLOW_SCRIPT
		);

		this._open_link_open_in(viewURL, 'new', 'tab', document);
	},

	/** Wrapper round openUILinkIn
 	*
 	* BACKGROUND WINDOW HANDLING WORKS, BUT PROCEDURE ISN'T GREAT; INVOLVES
 	* REPEATEDLY FOCUSSING THE CURRENT WINDOW AFTER  THE NEW WINDOW HAS BEEN
 	* OPENED.
 	*
 	* @param {string} url - The URL to open (as a string).
 	* @param {string} where - Where to open the URL
 	*                         "new", "background", "foreground", "current"
 	* @param {string} mode - "tab", "window"
 	* @param {Object} document - document containing the link
 	*/
	_open_link_open_in(url, where, mode, document) {
		let target = where == 'current' ? 'current' : mode;
		if (target == 'tab' && where != 'new') {
			target = 'tabshifted';
		}

		this._window.openLinkIn(url,
								target,
								{
									charset: document.characterSet,
									referrerURI: document.documentURIObject,
									originPrincipal: document.nodePrincipal,
									triggeringPrincipal: document.nodePrincipal
								}
						);
	},

	/** Called from window watcher
 	*
 	* @param {Object} window - the window on which an event happened
 	* @param {string} topic - the vent that happened
 	* @param {string} _data - indeterminate data
 	*/
	_observe(window, topic, _data) {
		if (topic == 'domwindowopened') {
			Window_Watcher.unregisterNotification(this);
			//The "focus" event seems to be somewhat erratic. I've tried using it,
			//but even if I blur the window after it loads, it gets focus again
			//twice. After the 2nd focus, it no longer seems to get a focus event
			//So we end up with this contortion of focussing the current window
			//a bunch of times.
			window.addEventListener('load', this._on_window_load);
		}
	},

	/** Called when a (probably opened by me) window finishes loading so I can
 	*  start sending the original window back to the front.
 	*
 	* @param {Event} event - window load event
 	*/
	__on_window_load(event) {
		event.currentTarget.removeEventListener('load', this.__on_window_load);
		this._fg_attempts = 50;
		this._focus_window();
	},

	/** Sends the current window to the foreground.
 	*
 	* Repeatedly calls itself after a timeout
 	*/
	_focus_window() {
		this._window.focus();
		if (this._fg_attempts > 0) {
			this._fg_attempts -= 1;
			setTimeout(event_binder(this._focus_window, this), 20);
		}
	},
});
