{

function idcac_clickEmbeds(classname, selector, trynum) {

	if (trynum == null)
		trynum = 1;
	else if (trynum > 20)
		return;

	for (const button of document.querySelectorAll(selector)) {
		button.classList.add(classname);
		button.click();
	}

	setTimeout(function() {idcac_clickEmbeds(classname, selector); }, 1000);
}
function idcac_embed() {
	const l = document.location;
	const classname = 'idcac_rnd_' + Math.random().toString(6).substring(2);
	let is_audioboom = false;
	let is_dailymotion = false;
	let is_dailybuzz = false;
	let is_playerclipslaliga = false;
	let selector = null;

	switch (l.hostname) {

		case 'embeds.audioboom.com':
			selector = 'div[id^="cookie-modal"] .modal[style*="block"] .btn.mrs:not(.' + classname + ')';
			break;

		case 'dailymotion.com':
		case 'www.dailymotion.com':
			if (l.pathname.indexOf('/embed') === 0)
				selector = '.np_DialogConsent-accept:not(.' + classname + '), .consent_screen-accept:not(.' + classname + ')';
			break;

		case 'geo.dailymotion.com':
			if (l.pathname.indexOf('/player') === 0)
				selector = '.np_DialogConsent-accept:not(.' + classname + '), .consent_screen-accept:not(.' + classname + ')';
			break;

		case 'dailybuzz.nl':
			selector = '#ask-consent #accept:not(.' + classname + ')';
			break;

		case 'playerclipslaliga.tv':
			selector = '#cookies button[onclick*="saveCookiesSelection"]:not(.' + classname + ')';
			break;
	}

	if (selector != null)
		idcac_clickEmbeds(classname, selector);
}

if (document.readyState == 'complete') {
	idcac_embed();
}
else {
	document.onload = idcac_embed;
}
}
