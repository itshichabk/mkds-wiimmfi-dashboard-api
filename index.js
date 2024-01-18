const app = require('express')();

const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const cors = require("cors");

class Player
{
    constructor(fc, status, name)
    {
        this.fc = fc;
        this.status = status;
        this.name = name;
    }
}

app.use(cors());
app.listen(8080, () => console.log("Server active on port 8080 : http://localhost:8080 (local)"));

console.log('Setting global variables...')

let initialized = false;
let page
let fetching = false;
let fetchedPlayers;

(async()=>{
    console.log('Attempting to launch browser...')

    const browser = await puppeteer.launch({
        headless: false,
        timeout: 0,
        args: ['--no-sandbox'],
        targetFilter: (target) => !!target.url()});
    console.log("Browser launched, initializing page");

    page = (await browser.pages())[0];

    console.log("Browser and page initialized");
    initialized = true;
})();

app.get('/', async (req, res) => 
{
    if(initialized && !fetching)
    {
        fetching = true;
        console.log("Fetching players from the Wiimmfi website...");

        try
        {
            await page.goto('https://wiimmfi.de/stats/game/mariokartds')
            await page.waitForNetworkIdle();

            const title = await page.title();
            if(title == "Just a moment...")
            {
                console.log("Skipping Cloudflare protection...")
                await page.waitForTimeout(3500);
            }
            else
            {
                console.log("Already logged in...")
            }
        
            const dom = new JSDOM(await page.content());
            const rows = dom.window.document.querySelectorAll("#online .tr0, #online .tr1");
        
            let players = [];
            for(let i = 0; i < rows.length; i++)
            {
                let column = rows[i].children;
                let fc = column[2].innerHTML;
                let status = "";
        
                switch(column[6].innerHTML)
                {
                    case 'o':       // In lobby or connecting
                        status = parseInt(column[7].innerHTML);
                        break;
                    case 'oGvS':    // Searching worldwide / regional / rivals
                        status = 2;
                        break;
                    case 'oGv':
                        status = 3; // Playing worldwide / regional / rivals
                        break;
                    case 'oPgC':    // Searching in friends
                        status = 4;
                        break;
                    case 'oPg':     // Playing in friends
                        status = 5;
                        break;
                }
        
                const name = column[10].innerHTML;
                // todo: codePointAt for special DS characters
        
                players.push(new Player(fc, status, name));
            }
        
            players = players.sort((a, b) => a.name.localeCompare(b.name));
            players = players.sort((a, b) => a.status - b.status);
        
            console.log("Players fetched!")
            players.forEach(p => console.log(p));
            
            fetchedPlayers = JSON.stringify(players);
        
            res.status(200).send(fetchedPlayers);    
        }
        catch(e)
        {
            res.status(500).send(e);
        }

        fetching = false;
    }
    else if(initialized)
    {
        console.log("Server currently fetching, sending latest fetched players.")
        res.status(200).send(fetchedPlayers);    
    }
    else
    {
        res.status(503).send("Server busy, please try again.");
    }
});