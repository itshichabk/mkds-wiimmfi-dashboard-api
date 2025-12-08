const app = require('express')();
const fs = require('node:fs');

const moment = require('moment-timezone');

const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const cors = require("cors");

const logFile = "log.txt";
const logMaxLines = 1000;

class Player
{
    constructor(fc, status, name)
    {
        this.fc = fc;
        this.status = status;
        this.name = name;
    }
}

function log(message)
{
    console.log(message);

    let logMessage = moment().tz("America/Toronto").format('YYYY-MM-DD HH:mm:ss') + " : " + message + "\n";
    countLines();

    fs.appendFile(logFile, logMessage, { flag: 'a+' }, err =>
    {
        if (err)
        {
            console.error(err);
        }
    })
}

function checkLogFileLines(count)
{
    if (count >= logMaxLines)
    {
        deleteLogFile();
    }
}

function deleteLogFile()
{
    if (fs.existsSync(logFile))
    {
        fs.unlink(logFile, err => console.log(err) );
    }
}

function countLines()
{
    // function (mostly) copied from https://gist.github.com/eqperes/342d532d6946f4239b0c09e398505b5a
    let i;
    let count = 0;

    fs.createReadStream(logFile)
        .on('error', e => log(e))
        .on('data', chunk => {
            for (i=0; i < chunk.length; ++i) if (chunk[i] == 10) count++;
        })
        .on('end', () => checkLogFileLines(count));
};

deleteLogFile();

app.use(cors());
app.listen(8080, () => log("Server active on port 8080 : http://localhost:8080 (local)"));

log('Setting global variables...')

let initialized = false;
let page
let fetching = false;
let fetchedPlayers;

(async()=>{
    log('Attempting to launch browser...')

    const browser = await puppeteer.launch({
        headless: false,
        timeout: 0,
        args: ['--no-sandbox'],
        targetFilter: (target) => !!target.url()});
    log("Browser launched, initializing page");

    page = (await browser.pages())[0];

    log("Browser and page initialized");
    initialized = true;
})();

app.get('/', async (req, res) => 
{
    if(initialized && !fetching)
    {
        let cloudflarePresent = false;
        fetching = true;
        log("Fetching players from the Wiimmfi website...");

        try
        {
            log("go to wiimmfi.de")
            await page.goto('https://wiimmfi.de/stats/game/mariokartds')

            const title = await page.title();
            if(title == "Just a moment...")
            {
                cloudflarePresent = true;
                log("Skipping Cloudflare protection...")
                await page.waitForNavigation();
            }
            else
            {
                log("Already logged in...")
            }
        
            if (cloudflarePresent)
            {
                await page.waitForNavigation
                ({
                    waitUntil: 'networkidle0',
                });
            }

            log("awaiting page content");
            const dom = new JSDOM(await page.content());

            log("extracting data");
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
        
                players.push(new Player(fc, status, name));
            }
        
            players = players.sort((a, b) => a.name.localeCompare(b.name));
            players = players.sort((a, b) => a.status - b.status);
        
            log("Players fetched!")
            players.forEach(p => log("{ fc: '" + p.fc + "', status: " + p.status + ", name: '" + p.name + "' }"));
            
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
        log("Server currently fetching, sending latest fetched players.")
        res.status(200).send(fetchedPlayers);    
    }
    else
    {
        res.status(503).send("Server busy, please try again.");
    }
});