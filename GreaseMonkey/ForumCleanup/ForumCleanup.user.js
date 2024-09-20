// ==UserScript==
// @name           ForumCleanup
// @grant			none
// @namespace      http://drkshadow.com
// @description    View only images on various image hosting websites
// @grant			none
// @include */forumdisplay.php?*
// @include */showthread.php?*
// ==/UserScript==
//
// jshint esversion: 6
// jshint forin: false
// jshint maxerr: 999
// jshint undef: true
// jshint lastsemic: true
// jshint scripturl: true
// jshint browser: true
// jshint devel: true
// jshint nonstandard: true


if (String.prototype.reverse === undefined)
	String.prototype.reverse=function(){return this.split("").reverse().join("");};

function stripFrames(again) {
	let iframes = document.getElementsByTagName('iframe');

	// I don't know why, I can only remove one at a time.
	while (iframes.length) {
		for (const frm of iframes) {
			frm.parentNode.removeChild(frm);
		}

		iframes = document.getElementsByTagName('iframe');
	}

	if (!again) {
		setTimeout(function() { stripFrames(true); }, 1000);
	}
}
stripFrames();

