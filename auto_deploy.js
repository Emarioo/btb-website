/*
    endpoint/server that restarts web server and git pulls new stuff.
*/

const LISTENER_CONFIG_PATH = "listener_config.json"

let CONFIG = {
    // mandatory
    secret_token: null, // same one as when Github wehook was created (no default here)

    // default options
    port: 10000,
    path_to_keys: "/home/"+(process.env.USER || 'no_one')+"/secure",


    devmode: false,
}

// #################
//    Here we go
// #################

const net = require("net");
const http = require("http");
const https = require("https");
const fs = require("fs");
const path_module = require('path');
const Logger = require("./logger.js");
const { spawn, exec } = require("child_process");

var logger = new Logger({ log_dir: "logs/auto_deploy" })
var website_process = null;

try {
    if (fs.existsSync(LISTENER_CONFIG_PATH)) {
        let config_file = fs.readFileSync(LISTENER_CONFIG_PATH, {encoding: 'utf8'})
        let obj = JSON.parse(config_file)
        let keys = Object.keys(obj)
        for (let i=0;i<keys.length;i++) {
            CONFIG[keys[i]] = obj[keys[i]]
        }
    }
} catch(err) {
    console.error(err)
    return
}

let keys = Object.keys(CONFIG)
let bad = false
for (let i=0;i<keys.length;i++) {
    if(CONFIG[keys[i]] === null) {
        console.log("\x1b[0;31mERROR:\x1b[0m config."+keys[i]+" was null but is mandatory in config file")
        bad = true
    }
}
if(bad)
    return

// logger.info("Using this config: ", JSON.stringify(CONFIG))
let secret = CONFIG["secret_token"]
CONFIG["secret_token"] = "************"
logger.info("Using this config: ", CONFIG)
CONFIG["secret_token"] = secret

process.on('SIGINT', OnTerminate)
process.on('SIGHUP', OnTerminate)
process.on('SIGTERM', OnTerminate)
process.on('SIGBREAK', OnTerminate)

// returns false on failure
function is_path_sanitized(filename) {
    // https://stackoverflow.com/questions/38517506/nodejs-safest-path-and-file-handling

    // 2) Whitelisting
    let dot_count = 0;
    for(let i=0;i<filename.length;i++) {
        let chr = filename[i]
        let code = chr.charCodeAt(0)
        if (code >= "A".charCodeAt(0) && code <= "Z".charCodeAt(0))
            continue
        if (code >= "a".charCodeAt(0) && code <= "z".charCodeAt(0))
            continue
        if (code >= "0".charCodeAt(0) && code <= "9".charCodeAt(0))
            continue
        if(chr == '-' || chr == '_' || chr == '/')
            continue

        if(chr == '.') {
            dot_count++;
            if(dot_count < 2)
                continue;
        }
        // bad character
        // console.log("bad char",filename, i, chr)
        return false
    }
    return true;
}
async function requestListener(req, res) {
    // TODO: Rate limit
    var root = "public/";
    let url_split = req.url.split("?")
    let base_part = url_split[0];
    var path = path_module.join("public/", base_part).replace("\\","/");
    
    // console.log(req.url)
    
    if(path.indexOf(root) != 0) {
        // someone is being sneaky
        // console.log("sneaky!", root, path)
        res.end()
        return;
    }

    let options = {};
    if(url_split.length>1){
        // TODO: Error handling
        let option_list = url_split[1].split("&") // can & be escaped in options?
        for(let i=0;i<option_list.length;i++) {
            let split = option_list[i].split("=")
            if(split.length == 2) {
                options[split[0]] = split[1];
            } else {
                // console.log("bad option format")
            }
        }
        // console.log("opts:",options)
    }

    if(base_part == "/webhook-event" && req.method == 'POST') {
        // console.log("API CALL")
        let remote_address = req.connection.remoteAddress || req.connection.socket.remoteAddress || req.socket.remoteAddress
        logger.info("Processing '"+req.url+"' from "+ remote_address)

        
        let body = '';
        req.on("data", chunk => {
            body += chunk.toString()
        })
        req.on('end', ()=>{
            res.writeHead(200) // we might as well respond 200 immediatly
            res.end()
            
            // JSON data to gather
            // https://docs.github.com/en/webhooks/webhook-events-and-payloads#push
            let data = null
            try {
                data = JSON.parse(body)
            } catch (error) {
                logger.error(error)
                res.writeHead(500)
                res.end()
                return
            }
            // logger.info("headers:\n", req.headers)
            // logger.info("body:\n", body)

            let yes = verifySignature(CONFIG["secret_token"], req.headers["x-hub-signature-256"], body)
            if(!yes) {
                logger.warn("Invalid signature in webhook request. Not from Github? (ip: ", remote_address, ")")
            } else {
                // logger.info("Signature is valid")
            }
            handle_webhook(data)
        })
        return
    }
    logger.info("Ignoring request '"+req.url+"' from "+ req.socket.localAddress)
    res.writeHead(404)
    res.end()
    return
};
let encoder = new TextEncoder();
async function verifySignature(secret, signature_header_field, payload) {
    let parts = signature_header_field.split("="); // x-hub-signature-256: sha256=ad9a98da888a6d8ba8
    let sigHex = parts[1];

    let algorithm = { name: "HMAC", hash: { name: 'SHA-256' } };

    let keyBytes = encoder.encode(secret);
    let extractable = false;
    let key = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        algorithm,
        extractable,
        [ "sign", "verify" ],
    );

    function hexToBytes(hex) {
        let len = hex.length / 2;
        let bytes = new Uint8Array(len);
    
        let index = 0;
        for (let i = 0; i < hex.length; i += 2) {
            let c = hex.slice(i, i + 2);
            let b = parseInt(c, 16);
            bytes[index] = b;
            index += 1;
        }
    
        return bytes;
    }
    let sigBytes = hexToBytes(sigHex);
    let dataBytes = encoder.encode(payload);
    let equal = await crypto.subtle.verify(
        algorithm.name,
        key,
        sigBytes,
        dataBytes,
    );

    return equal;
}

async function has_local_changes(repo) {
    let wrkdir = "."
    if (repo == "BetterThanBatch") {
        wrkdir = "../BetterThanBatch"
    }
    return await new Promise((resolve, reject) => {
        exec("git diff --quiet", {
            cwd: wrkdir,
        }, (error, stdout, stderr) => {
            let text = stdout
            if (stderr.length > 0) {
                text += stderr
            }
            if (error) {
                resolve(true)
            } else {
                resolve(false)
            }
        })
    })
}

async function get_current_ref(repo) {
    let wrkdir = "."
    if (repo == "BetterThanBatch") {
        wrkdir = "../BetterThanBatch"
    }
    let res = await new Promise((resolve, reject) => {
        exec("git rev-parse --abbrev-ref HEAD", {
            cwd: wrkdir,
        }, (error, stdout, stderr) => {
            let text = stdout
            if (stderr.length > 0) {
                text += stderr
            }
            if (error) {
                logger.error("btb, git rev-parse --abbrev-ref HEAD:\n", text)
                resolve(null)
            } else {
                // logger.debug("btb, git rev-parse --abbrev-ref HEAD:\n", text)
                resolve(stdout)
            }
        })
    })
    if (typeof(res) == "string")
        return res.trim()
    return res
}

var handling_webhook = false
async function handle_webhook(data) {
    let commit = data.after
    let repo = data.repository.name
    let ref = data.ref // may be branch or tag (note that base_ref may be null so we use ref from webhook data)
    let forced = data.forced // TODO: If forced then we may need to reset repo and then git pull

    let current_ref = await get_current_ref(repo)

    if(repo != "BetterThanBatch" && repo != "btb-website") {
        logger.debug("Detected push on" + repo,"but ignoring it)")
        return
    }

    if (ref != "refs/heads/"+current_ref) {
        logger.info("Detected push on", ref,"but ignoring since the current branch is",current_ref, "(for repo ",repo,")")
        return
    }

    if(forced) {
        let yes = await has_local_changes(repo)
        if (yes) {
            logger.warn("Force push request detected. Cannot git reset because of local changes. Fix manually! (webhook data:", commit, repo, ref,")")
            return
        }
    }

    if (handling_webhook) {
        logger.info("Skipping webhook event, already one in progress. (webhook data: ", commit, repo, ref,")")
        return
    }
    handling_webhook = true // lock
    
    logger.info("New commit "+commit+" on "+ref+" in "+repo+"")
    if (repo == "BetterThanBatch" && !CONFIG.devmode) {
        if(forced) {
            let success = await new Promise((resolve, reject) => {
                let cmd = "git reset --hard origin/"+current_ref
                exec(cmd, {
                    cwd: "../BetterThanBatch",
                }, (error, stdout, stderr) => {
                    let text = stdout
                    if (stderr.length > 0) {
                        text += stderr
                    }
                    if (error) {
                        logger.error("btb, "+cmd+":\n", text)
                        resolve(false)
                    } else {
                        logger.info("btb, "+cmd+":\n", text)
                        resolve(true)
                    }
                })
            })
        } else {
            let success = await new Promise((resolve, reject) => {
                exec("git pull", {
                    cwd: "../BetterThanBatch",
                }, (error, stdout, stderr) => {
                    let text = stdout
                    if (stderr.length > 0) {
                        text += stderr
                    }
                    if (error) {
                        logger.error("btb, git pull:\n", text)
                        resolve(false)
                    } else {
                        logger.info("btb, git pull:\n", text)
                        resolve(true)
                    }
                })
            })
        }
        // TODO: What do we do if git pull failed? Nothing i guess?
    } else if(repo == "btb-website") {
        if (website_process.killed) {
            logger.warn("Website process has been killed at some point. We will not perform git pull or start server.")
            return
        } 
        website_process.kill()
        logger.info("Killed website process.")
        let success = false
        if(forced) {
            success = await new Promise((resolve, reject) => {
                let cmd = "git reset --hard origin/"+current_ref
                exec(cmd, {}, (error, stdout, stderr) => {
                    let text = stdout
                    if (stderr.length > 0) {
                        text += stderr
                    }
                    if (error) {
                        logger.error("btb, "+cmd+":\n", text)
                        resolve(false)
                    } else {
                        logger.info("btb, "+cmd+":\n", text)
                        resolve(true)
                    }
                })
            })
        } else {
            success = await new Promise((resolve, reject) => {
                exec("git pull", {}, (error, stdout, stderr) => {
                    let text = stdout
                    if (stderr.length > 0) {
                        text += stderr
                    }
                    if (error) {
                        logger.error("btb-website, git pull:\n", text)
                        resolve(false)
                    } else {
                        logger.info("btb-website, git pull:\n", text)
                        resolve(true)
                    }
                })
            })
        }
        if (success) {
            start_website()
            // start_website already says that it is restarting
            // logger.info("Restarted website process")
        }
    }
    handling_webhook = false
}

function checkPort(port) {
    return new Promise((resolve, reject) => {
        const server = net.createServer()
        server.once("error", (err) => {
            if (err.code == "EADDRINUSE") {
                resolve(true)
            } else {
                resolve(false)
            }
        })
        server.once("listening", () => {
            server.close()
            resolve(false)
        })
        server.listen(port)
    })
}

function start_website() {
    website_process = spawn("node", ["server.js"], {stdio: "inherit"})
}

main()
async function main() {
    let website_port = 8081 // TODO: website always runs on https, unless devmode?
    let website_is_active = await checkPort(website_port)

    if(!website_is_active) {
        // logger.info("Starting web server at ", website_port)
        // website prints that it is starting, no need to do that here too
        start_website()
    } else {
        logger.error("Website is already running at " + website_port +". Shut if off before starting auto_updater.")
        return
    }

    if (CONFIG.devmode) {
        const server = http.createServer(requestListener);
        server.listen(CONFIG.port, () => {
            logger.info("Auto-deploy endpoint is running on", CONFIG.port);
        });
    } else {
        try {
            const options = {
                key:  fs.readFileSync(CONFIG.path_to_keys + '/privkey.pem'),
                cert: fs.readFileSync(CONFIG.path_to_keys + '/fullchain.pem'),
            };
            const https_server = https.createServer(options, requestListener);

            https_server.listen(CONFIG.port, () => {
                logger.info("Auto-deploy endpoint is running on", CONFIG.port);
            });
        } catch(ex) {
            console.log(ex)
        }
    }
}
function OnTerminate() {
    logger.info("Terminating server (maybe because of Ctrl+C)")
    process.exit()
}