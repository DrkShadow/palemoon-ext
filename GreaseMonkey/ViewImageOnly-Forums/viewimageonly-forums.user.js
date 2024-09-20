// ==UserScript==
// @name           ViewImageOnly-Forums
// @namespace      http://drkshadow.com
// @description    Certain forums do their forwards craptactularly. Deal with that here.
// @include        htt*://forum.*/topic*
// @include        htt*://forum.*/redirect-*
// @include			*/redirect.php?url=*
// @include			http://*/viewtopic.php*
// @include http://.*-t*.html
// @grant			none
// ==/UserScript==


if (String.prototype.reverse === undefined)
	String.prototype.reverse=function(){return this.split("").reverse().join("");}

goURL(getImg(location.href));


function goURL(url) {
	var i;
	if (url && !(String(window.location.href).toLowerCase() == url)) {
		while (url.indexOf('%')!=-1) {
			url=unescape(url);
		}
		i=url.search(/\/[^\/]+\.(com|net)/);
		if (i > 0) 
			url='http://'+url.substr(i+1);
		top.location.href=url;
	}
}



function getImg(url) {
	var urlLow = url.toLowerCase();
	var img;

	var fulldomain = document.domain.toLowerCase();
	var revdomain = fulldomain.reverse();

	var tld = revdomain.substr(0,revdomain.indexOf('.')).reverse();
	if (tld.length < 3 && revdomain.indexOf('.', tld.length+1) != -1) {
		var innerdom = revdomain.substr(tld.length+1,revdomain.indexOf('.',tld.length+1) - tld.length-1).reverse();

		// These are the only ones accepted as part of the TLD below the country code.
		if (innerdom == 'ne' || innerdom == 'co' || innerdom == 'net' || innerdom == 'com')
			tld += '.' + innerdom;
	}

	// Get the portion of the domain after the tld (gets whatever is before the
	// next dot, if any dot)
	var domain = revdomain.substr(tld.length + 1);
	if (domain.indexOf('.') != -1)
		domain = domain.substr(0,domain.indexOf('.'));
	domain = domain.reverse();

	// Stripp shit off links
	{
		var links = document.getElementsByTagName('a');
		for (var linki in links) {
			var link = links[linki];
			var idx;

			if (link.href && (idx = link.href.indexOf('/?http')) > 0) {
				var matchstr = link.href.substr(idx + 2, 7);
				if (matchstr != "http://" && matchstr != "https:/")
					continue

				link.href = link.href.substr(idx + 2);
			}
			
		}
	}

	if (urlLow.indexOf('redirect.php?url=') > 0) {
		return url.substr(urlLow.indexOf('redirect.php?url=') + 17);
	}

	switch (tld) {

	case 'com':

		switch (domain) {
		case 'badongo':
			return null;
		}
		break;	// com

	case 'net':
			if (urlLow.indexOf('/topic') > 0) {
				// Get rid of _all_ amy.gs forwards.
				var a = document.getElementsByTagName('a');
				for (var i in a) {
					var ln = a[i];
					if (!ln.getAttribute)
						continue;
					
					var href = ln.getAttribute('href');
					if (!href)
						continue;
					var hrefi = href.indexOf('://', 8);
					if (hrefi == -1)
						continue;

					// Got here? Then we have a forward.
					ln.setAttribute('href', href.substr(href.indexOf('://', 8) - 4));
				}
			}
			if (urlLow.indexOf('/redirec') > 0) {
				document.forms[1].submit();
				return null;
			}

	} // switch TLD.
}

function linkBucks(url, urlLow) {
	// if there is a /url, get the url after that.
	var idx;

	//unsafewindow.on
	window.onbeforeunload = null;

	if ((idx = urlLow.indexOf('/url/')) > 0) {
		return url.substr(idx+5);
	}

	// If it has frames, go to the 2nd frame
	if (window.frames.length == 2)
		return window.frames[1].src;

	var lbl = document.getElementById('lb_wrap');
	if (lbl)
		return lbl.childNodes[3].href;

	idx = document.getElementById('frame2');
	if (idx)
		return idx.src;

	// Get the script blocks to find TargetUrl
	var scripts = document.getElementsByTagName('script');
	for (idx = 0; idx < scripts.length; idx++) {
		var script = scripts[idx];
		if (script.innerHTML.length < 20)
			continue;
		var i = script.innerHTML.indexOf('TargetUrl');
		if (i == -1)
			continue;

		script = script.innerHTML;
		i = script.indexOf("'", i) + 1;
		return script.substr(i, script.indexOf("'", i) - i);
	}

	return null;
}

// Replace the entire page with the image url.
function replacePage(url) {
	document.body.innerHTML = ''; //'<img src="' + obj.src + '" id="the_image1">';
	removeSiblings(document.body);

	var elem = document.createElement('img');
	elem.src = url;
	elem.id = 'img';
	document.body.appendChild(elem);

	// remove stylesheets
	var styles = document.styleSheets;
	for (var i = styles.length - 1; i >= 0; i--) {
		styles.deleteRule(i);
	}

	setScaler(elem);
}

function removeSiblings(element) {
	if (element.parentNode == null)
		return;

	var par = element.parentNode;
	var el;
	while ((el = element.nextSibling) != null) {
		par.removeChild(element.nextSibling);
	}
	while ((el = element.previousSibling) != null) {
		par.removeChild(el);
	}
}

// Sets up scaling, initial cursors, sizes, etc.
function setScaler(element) {
	element.addEventListener('click', function(e) {
			doScale(e, element);
		}, true);
	element.style.cursor = "-moz-zoom-out";
}

// Perform scaling on the given element. Assumed the page contents will be removed and no styles will apply.
// To call this function from an onClick, use a wrapper.
function doScale(e, img) {

	var docheight = window.innerHeight - 2 * img.offsetTop;//document.documentElement.clientWidth - 2 * img.offsetLeft;
	var docwidth = window.innerWidth - 2 * img.offsetLeft;//document.documentElement.clientHeight - 2 * img.offsetTop;

	var width = img.naturalWidth;
	var height = img.naturalHeight;
	//alert('docwidth, docheight: ' + docwidth + ', ' + docheight + "\nwidth, height: " + width + ', ' + height);

	// Do nothing if it's not out of bounds.		
	if (width <= docwidth && height <= docheight)
		return;

	var scaleWidth, scaleHeight;
	//
	// Find out which is bigger-er
//alert(height + '/' + docheight + '==' + (height / docheight) + ' -- ' + width + '/' + docwidth + '==' + (width / docwidth));
	if (height / docheight > width / docwidth) {
//alert('if');
		var ratio = height / width;
		// Then the height should be the scaling factor
		scaleHeight = docheight;
		scaleWidth = docheight / ratio;
	}
	else {
//alert('else');
		// the width should be the scaling factor.
		var ratio = height / width;
		scaleWidth = docwidth;
		scaleHeight = docwidth * ratio;
	}
//alert('width,height: ' + scaleWidth + ',' + scaleHeight);

	// If one of them is equal, consider it scaled. If it's not, it'll just do... nothing.
	if (width != img.width || height != img.height){
		// Enlarge the image
		//alert('Enlarging...');
		img.removeAttribute('width');
		img.removeAttribute('height');
		img.style.cursor = "-moz-zoom-out";


		// Center the display on the clicked area
		var mousex, mousey;
		mousex = e.clientX;
		mousey = e.clientY;

		//alert('Click: ' + mousex + ',' + mousey);

		// Find the scroll X/Y based on click position.
		// Get the % up/down of the click and convert to enlarged pixel center
		mousex = mousex / scaleWidth * width;
		mousey = mousey / scaleHeight * height;

		//alert('scaled coords: ' + mousex + ',' + mousey);

		// get the center scroll coordinates
		mousex -= docwidth / 2;
		mousey -= docheight / 2;

		// do the scroll
		//alert('window: ' + mousex + ',' + mousey);
		window.scroll(mousex, mousey);
		document.body.scrollLeft = mousex;
		document.body.scrollTop = mousey;
	}
	else {
		//alert('Shrinking...' + scaleWidth);

		img.style.cursor = "-moz-zoom-in";
		img.width = scaleWidth;
		img.height = scaleHeight;
	}
}
