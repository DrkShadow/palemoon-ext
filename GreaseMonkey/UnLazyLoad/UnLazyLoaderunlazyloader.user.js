// ==UserScript==
// @name           UnLazyLoad
// @grant			none
// @namespace      http://drkshadow.com
// @description    Replace lazy-load images with the actual images.
// @grant			none
// @run-at			document-start, document-end
// @include        *
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

// The run-at is what does the magic: if it's not document-start, then images don't reload with the correct image.
// document-start sets the URL before page-load, so it never loads the wrong ones.


if (String.prototype.reverse === undefined)
	String.prototype.reverse=function(){return this.split("").reverse().join("");};

{ // global context

function singlesize(urls) {
	const spcidx = urls.indexOf(' ');
	//console.log("singlesize: " + spcid);
	if (!(spcidx > 1))
		return urls;

	return urls.substr(0, spcidx);
}

function srcattr(elem, attr) {
	const datsrc = elem.getAttribute(attr);
	//console.log("datsrc: " + datsrc);
	if (datsrc == null || datsrc.length < 3)
		return null;

	let replwidth = null;
	if (elem.hasOwnProperty('data-widths')) {
		// This is an array: ="[1,2,3,..]"

		const widths = JSON.parse(elem.getAttribute('data-widths'));
		replwidth = widths[widths.length - 1];
	}

	//elem.setAttribute('src', singlesize(datsrc));
	let src = singlesize(datsrc);
	//console.log('src: ' + src);
	if (src.length < 5)
		return false;

	if (replwidth != null) {
		let idx;
		while ((idx = src.indexOf('{width}')) > 0) {
			src = src.substr(0, idx) + replwidth + src.substr(idx + 7);
		}
	}
	elem.setAttribute('src', src);
	//console.log("Setting src: " + src);

	const newimg = elem.ownerDocument.createElement('img');
	for (const key of elem.getAttributeNames()) {
		//console.log("Checking key: " + key);
		if (!elem.hasOwnProperty(key) || key == "src" || key == "data-src")
			continue;
	
		//console.log("Replacing key: " + key);

		newimg.setAttribute(key, elem.getAttribute(key));
	}
	newimg.setAttribute('src', src);
	//console.log("Replacing element.");
	elem.replaceWith(newimg);
	//console.log('Set src: ' + newimg.getAttribute('src'));
	
	return true;
}

function unlazy(cls, repeat) {
	//console.log('unlaze: ' + cls + ' -- ' + doclazyloaded.length);
	for (const elem of document.getElementsByClassName(cls)) {
		if (elem.tagName != 'IMG')
			continue;

		const hasdataimg = elem.hasAttribute('data-img');
		const hasdatasrc = elem.hasAttribute('data-src');
		const hassrcset = elem.hasAttribute('data-srcset');
		const haslazysrcset = elem.hasAttribute('data-lazy-srcset');
		//console.log('unlaze got img: ' + hasdataimg + ', ' + hasdatasrc + ', ' + hassrcset);
		//const hassrcset = elem.hasAttribute('srcset');	// this one isn't real
		if (!(hasdataimg || hasdatasrc || hassrcset || haslazysrcset))
			continue;

		//const srcsrc = elem.src;
		//console.log(elem.classList);

		let srcupdated = false;
		if (hasdataimg) {
			srcupdated = srcattr(elem, 'data-img');
		}
		else if (hasdatasrc) {
			srcupdated = srcattr(elem, 'data-src');
		}
		else if (hassrcset) {
			srcupdated = srcattr(elem, 'data-srcset');
		}
		else { // if (hassrcset) {
			srcupdated = srcattr(elem, 'data-lazy-srcset');
		}

		if (srcupdated)
			elem.classList.remove(cls);
	}

	//if (doclazyloaded.length > 0 && !repeat) {
	//	// For some reason it just gets every-other image. Doing it twice fixes things.
	//	unlazy(cls, true);
	//}
}

//console.log(Object.keys(document));
//console.log(document);
//console.log(document.parentNode);
//console.log(document.ownerDocument);
//console.log(document.parentElement);
//console.log(document.rootElement);
//console.log(document.childNodes);
//console.log(document.childNodes[0]);
//console.log(document.childNodes[0].ownerDocument);
//console.log(document.childNodes[0].ownerDocument.body);
//console.log(document.childNodes[0].ownerDocument.innerHTML);
unlazy('lazyLoadV2');
unlazy('lazyload');
unlazy('lazyload');
unlazy('lazy-load');
unlazy('lazyloaded');
unlazy('lazy');


for (const img of document.getElementsByTagName('img')) {
	if (img.hasAttribute('data-lazyloadsrc'))
		img.setAttribute('src', img.getAttribute('data-lazyloadsrc'));
}

} // global context

