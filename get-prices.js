const url = process.argv[2],
    outputFile = process.argv[3],
    errorsToFile = true,

    pricesUrl = url + 'load-prices/',
    outputColumns = ['firm_title', 'price_uah', 'guarantee_format', 'stock_type'],

    http = require('http'),
    _url = require('url'),
    fs = require('fs');

if ( !url ) {
    log('1001: No url parameter');
    process.exit(1);
}

if ( outputFile ) {
    fs.writeFileSync(outputFile, '');
}

request(url, processHtml);


function processHtml(data) {
    let r = /<meta name="csrf-token" content="(.*)" \/>/.exec(data),
        token = r ? r[1] : false;

    if ( !token ) {
        log('1002: Can\'t find token');
        process.exit(1);
    }

    request(pricesUrl, processPrices, {
        json: true,
        headers: {
            'X-CSRF-Token': token,
            'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
        }
    });
}

function processPrices(data) {
    let result, output;

    if ( !data && !data.prices ) {
        process.exit(1);
    }

    result = data.prices.map(item => {
        return outputColumns.map(value => item[value]).join(';');
    });

    output = result.join('\r\n');

    if ( outputFile ) {
        fs.writeFile(outputFile, output);
    } else {
        log(output);
    }
}

function request(url, callback, params = {}) {
    let parsedUrl = _url.parse(url),
        options = {
            hostname : parsedUrl.hostname,
            port: parsedUrl.port || 80,
            path:  parsedUrl.path,
            headers: params.headers || {}
        };

    http.get(options, (res) => {
        const { statusCode } = res;
        const contentType = res.headers['content-type'];
        let rawData = '';
        let error;
  
        if ( statusCode !== 200 ) {
            error = new Error(`status code: ${statusCode}`);
        } else if ( params.json && !/^application\/json/.test(contentType)) {
            error = new Error(`Expected application/json but received ${contentType}`);
        }

        if ( error ) {
            log('1003: Error downloading url ' + url + ' (' + error.message + ')');
            callback(false);

            res.resume();
            return;
        }

        res.setEncoding('utf8');

        res.on('data', chunk => { rawData += chunk; });

        res.on('end', () => {
            try {
                callback(params.json ? JSON.parse(rawData) : rawData);
            } catch (e) {
                log('1004: Error processing response ' + url);
                log(e);
                callback(false);
            }
        });
    }).on('error', (e) => {
        log('1005: Error downloading url ' + url);
        log(e);
        callback(false);
    });
}

function log(text) {
    if ( outputFile && errorsToFile ) {
        fs.appendFileSync(outputFile, text);
    } else {
        console.log(text);
    }
}