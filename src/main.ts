#!/usr/bin/env node

import * as fs from 'fs';
import * as httpProxy from 'http-proxy';
import { blue, bold, gray, green, red } from 'ansi-colors';
import { isProxy, parse } from './lib';

const parsed = parse();

const config = isProxy(parsed) ? {proxy: parsed} : parsed;

for (const name of Object.keys(config)) {
    const {hostname, target, key, cert, source} = config[name]!;

    const loopingListener = (e: any, req, res) => {
        if (e.code === 'ECONNREFUSED') {
            console.error(gray(`${new Date().toISOString()} - Proxy ${bold(name)}: Connection to target at http://${hostname}:${target} refused. Ensure the target server is running and accepting connections. Trying again in 1 second...`));
            setTimeout(() => {
                proxy.web(req, res, {}, loopingListener);
            }, 1000);
        } else {
            console.error(red('Request failed to ' + name + ': ' + bold(e.code)));
        }
    };

    const proxy = httpProxy
        .createServer({
            xfwd: true,
            ws: true,
            target: {
                host: hostname,
                port: target
            },
            ssl: {
                key: fs.readFileSync(key, 'utf8'),
                cert: fs.readFileSync(cert, 'utf8')
            }
        })
        .on('error', loopingListener)
        .listen(source);

    console.log(
        green(
            `Started ${isProxy(parsed) ? 'proxy' : bold(name)}: https://${hostname}:${source} → http://${hostname}:${target}`
        )
    );
    process.on('exit', (code) => {
        proxy.close();
        console.log(`Closed proxy ${bold(name)}`);
    });
}

process.on('SIGINT', () => {
    console.log('Received SIGINT');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('Received SIGTERM');
    process.exit(0);
});
process.on('exit', (code) => {
    const color = code === 0 ? blue : red;
    console.log(color(`Exiting with code: ${code}`));
});
