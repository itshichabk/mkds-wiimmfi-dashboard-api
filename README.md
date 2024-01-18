# API for the Mario Kart DS Wiimmfi Dashboard app

Web scraper powered by Express.js and Puppeteer, which launches a Chrome instance in which the Wiimmfi.de website can be accessed for extracting and sending the list of online Mario Kart DS players in JSON format.

The server can work locally with Node by running `node .` after installing the necessary packages using `npm install`. It will be accessible on `localhost:8080` by default. 

The API is currently hosted on GCP Cloud Run for use by the dashboard app : https://mkds-wiimmfi-dashboard-api-xmsmvtoega-nn.a.run.app

The dashboard app makes use of the API by automatically sending requests without requiring the user to constantly refresh the page like on the Wiimmfi website.

## JSON response object properties (Player)

- **fc** : Friend code of the player (xxxx-xxxx-xxxx)
- **status** : Current status of the player (number)
	- 0 : connecting
	- 1 : In lobby
	- 2 : Searching worldwide / regional / rivals
	- 3 : Playing worldwide / regional / rivals
	- 4 : Searching in friends
	- 5 : Playing in friends
- **name** : Nickname from the console's firmmware (string)

---

A headful instance + Xvfb had to be used instead of a headless one because the latter has issues with the Cloudflare protection, even using with the Stealth plugin.

The API had to be dockerized before being deployed on GCP as it required other system dependencies to allow a Chrome window to be launched in the virtual framebuffer provided by Xvfb.
