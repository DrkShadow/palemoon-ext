(function() {
	const classname = Math.random().toString(36).replace(/[^a-z]+/g, '');

	const l = document.location;
	let is_audioboom = false;
	let is_dailymotion = false;
	let is_dailybuzz = false;
	let is_playerclipslaliga = false;

	switch (l.hostname) {

		case 'embeds.audioboom.com':
			is_audioboom = true;
			break;

		case 'dailymotion.com':
		case 'www.dailymotion.com':
			is_dailymotion = l.pathname.indexOf('/embed') === 0;
			break;

		case 'geo.dailymotion.com':
			is_dailymotion = l.pathname.indexOf('/player') === 0;
			break;

		case 'dailybuzz.nl':
			is_dailybuzz = l.pathname.indexOf('/buzz/embed') === 0;
			break;

		case 'playerclipslaliga.tv':
			is_playerclipslaliga = true;
			break;
	}


	function searchEmbeds() {
		setTimeout(function() {

			// audioboom.com iframe embeds
			if (is_audioboom) {
				for (const button of document.querySelectorAll('div[id^="cookie-modal"] .modal[style*="block"] .btn.mrs:not(.' + classname + ')')) {
					button.className += ' ' + classname;
					button.click();
				});
			}

			// dailymotion.com iframe embeds
			else if (is_dailymotion) {
				for (const button of document.querySelectorAll('.np_DialogConsent-accept:not(.' + classname + '), .consent_screen-accept:not(.' + classname + ')')) {
					button.className += ' ' + classname;
					button.click();
				});
			}

			// dailybuzz.nl iframe embeds
			else if (is_dailybuzz) {
				for (const button of document.querySelectorAll('#ask-consent #accept:not(.' + classname + ')')) {
					button.className += ' ' + classname;
					button.click();
				});
			}

			// playerclipslaliga.tv iframe embeds
			else if (is_playerclipslaliga) {
				for (const button of document.querySelectorAll('#cookies button[onclick*="saveCookiesSelection"]:not(.' + classname + ')')) {
					button.className += ' ' + classname;
					button.click();
				});
			}

			// Give up
			else {
				return;
			}

			searchEmbeds();
		}, 1000);
	}

	let htmltries = 0;
	const start = setInterval(function() {
		var html = document.querySelector('html');

		htmltries++;
		if (htmltries > 30) {
			clearInterval(start);
			return;
		}

		if (!html || (new RegExp(classname)).test(html.className))
			return;

		html.className += ' ' + classname;
		searchEmbeds();
		clearInterval(start);
	}, 500);
})();
