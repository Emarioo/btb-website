// logger.js
// Universal logging system with console and file output, configurable log levels, and structured logging.

const fs = require('fs');
const path = require('path');

class Logger {
    constructor(options = {}) {
        // const
        this.levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
        this.colors = [
            '\x1b[34m', // Blue
            '',
            '\x1b[33m',  // Yellow
            '\x1b[31m'  // Red
        ];
        // options
        this.log_dir = 'logs';
        this.level = 'INFO';
        this.enable_color = true;
        this.enable_file = true;
        this.update_options(options)

        this.file_path = path.join(this.log_dir, this.getFileTimestamp() + ".log")
    }

    update_options(options) {
        let keys = Object.keys(options)
        for(let i=0;i<keys.length;i++) {
            let key = keys[i]
            if (this[key] === undefined) {
                console.log("\x1b[0;31mERROR\x1b[0m: '"+level+"' is not a logger option (all provided options: "+JSON.stringify(options)+")")
            } else {
                this[key] = options[key]
            }
        }
        this.level = this.level.toUpperCase()

        // internal variables
        this.level_index = this.levels.indexOf(this.level);
        this.checked_dir_existance = false
    }

    getTimestamp() {
        let d = new Date()
        return d.getUTCFullYear() + "-" + (""+(d.getUTCMonth()+1)).padStart(2,'0') + "-" + (""+d.getUTCDate()).padStart(2,'0') + " " + (""+d.getUTCHours()).padStart(2,'0') + ":" + (""+d.getUTCMinutes()).padStart(2,'0') + ":" + (""+d.getUTCSeconds()).padStart(2,'0') + "." + (""+d.getUTCMilliseconds()).padStart(3, '0')
    }

    getFileTimestamp() {
        let d = new Date()
        return d.getUTCFullYear() + "-" + (""+(d.getUTCMonth()+1)).padStart(2,'0') + "-" + (""+d.getUTCDate()).padStart(2,'0') + "_" + (""+d.getUTCHours()).padStart(2,'0') + "-" + (""+d.getUTCMinutes()).padStart(2,'0') + "-" + (""+d.getUTCSeconds()).padStart(2,'0')
    }

    log(level, ...strings) {
        let level_index = this.levels.indexOf(level.toUpperCase())
        if (level_index < this.level_index && level_index != -1) {
            return
        }

        let out = null;
        let color = ""
        let color_def = ""
        if(this.enable_color) {
            if(level_index == -1) {
                color = "\x1b[0;31m"
            } else {
                color = this.colors[level_index]
            }
            if (color != "")
                color_def = "\x1b[0m"
        }
        out = `${this.getTimestamp()} ${color}[${level.toUpperCase()}]:${color_def}`
        if(level_index == -1) {
            out += " ('"+level+"' is not a known level)"
        }
        console.log(out, ...strings); // passing strings directly because NodeJS adds syntax highlighting
        for (let i=0;i<strings.length;i++) {
            out += " "
            if (typeof(strings[i]) == 'object') {
                out += JSON.stringify(strings[i], null, 2)
            } else {
                out += strings[i]
            }
        }
        
        if (this.enable_file) {
            try {
                if (!this.checked_dir_existance && !fs.existsSync(this.log_dir)) {
                    this.checked_dir_existance = true
                    fs.mkdirSync(this.log_dir, {recursive: true});
                }
                fs.appendFileSync(this.file_path, out + "\n");
            } catch (error) {
                console.error(`Failed to write to log file ${this.file_path}:`, error);
            }
        }
    }

    debug(...message) { this.log('debug', ...message); }
    info(...message) { this.log('info', ...message); }
    warn(...message) { this.log('warn', ...message); }
    error(...message) { this.log('error', ...message); }
}

module.exports = Logger;
