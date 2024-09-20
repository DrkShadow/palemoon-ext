function _sl(selector, container) {
	return (container || document).querySelector(selector);
}

function _id(id) {
	return document.getElementById(id);
}


{
let tries = 0;
const main_interval = setInterval(function() {
	var html = _sl('html');

	if (!html || /idc8_350/.test(html.className))
		return;

	tries++;
	if (tries > 30)
		return;	// give up.


	clearInterval(main_interval);

	html.className += ' idc8_350';

	let counter = 0;
	const host_parts = document.location.hostname.split('.');

	const interval = setInterval(function() {

		if (host_parts[0] == 'consent') {
			if (document.location.pathname == '/m') {
				let element;

				if (host_parts[1] == 'youtube')
					element = _sl('div + form[action*="//consent."][action$="/save"] button, .basebutton + form[action*="//consent."][action*="/save"] .button');
				else
					element = _sl('form[action*="//consent."][action$="/save"]:first-of-type:not(:only-of-type) button');

				if (element) {
					element.click();
					counter = 299;
				}
			}


			// Mobile only: 1. google.co.uk (or in FF Nightly, on google.com search results) 2. YT only, a copy or the desktop selector

			else if (document.location.pathname == '/ml') {
				const element = _sl('.saveButtonContainerNarrowScreen > form:last-child .button, .basebutton + form[action*="//consent."][action*="/save"] .button');

				if (element) {
					element.click();
					counter = 299;
				}
			}
		}


		// https://www.google.com/finance/

		else if (document.location.hostname == 'ogs.google.com' && document.location.pathname == '/widget/callout') {
			// Hoping -- trying -- innerHTML is static string, so fast? Try that before xpath..?
			if (document.innerHTML.indexOf('This site uses cookies') > 0 &&
					document.evaluate('//span[contains(text(), "This site uses cookies")]', document, null, XPathResult.ANY_TYPE, null).iterateNext()) {
				_sl('button').click();
				counter = 299;
			}
		}

		else {
			// The latest cookie popup, desktop and mobile

			const container = _sl('div[aria-modal="true"][style*="block"]');

			if (container && _sl('a[href*="policies.google.com/technologies/cookies"]', container)) {
				_sl('button + button', container).click();

				// Autofocus on the search field
				const e2 = _sl('form[role="search"][action="/search"]:not([id]) input[aria-autocomplete="both"]');
				if (e2) e2.focus();

				counter = 299;
			}

			// General privacy reminder
			const ereminder = _sl('form[action^="/signin/privacyreminder"] > div > span > div:not([role]) > div:not([tabindex]) span + div');
			if (ereminder) ereminder.click();

			// #cns=1
			if (document.location.hash == '#cns=1')
				document.location.hash = '#cns=0';
		}

		counter++;

		if (counter == 300)
			clearInterval(interval);

	}, 250 + counter*10);
}, 250);
}
