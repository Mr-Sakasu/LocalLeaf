const assert = require('node:assert/strict');
const http = require('node:http');
const {BaseAPI} = require('../out/api/base.js');

// Exercise node-fetch's real header and body timeouts against a local server.
// No Overleaf credentials or external network connection are needed.
const server = http.createServer((request, response) => {
    if (request.url.includes('/body/')) {
        response.writeHead(200, {'Content-Type': 'text/html'});
        response.write('<html>');
    }
    // Deliberately leave the headers or body incomplete.
});

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const clients = ['headers', 'body'].map(mode =>
        new BaseAPI(`http://127.0.0.1:${server.address().port}/${mode}/`)
            .setIdentity({cookies: 'test', csrfToken: 'test'})
    );
    let watchdog;
    try {
        await Promise.race([
            Promise.all(clients.map(client =>
                assert.rejects(client.getProjectDetails('test'), /timeout/i)
            )),
            new Promise((_, reject) => {
                watchdog = setTimeout(() => reject(new Error('Stalled HTTP request exceeded 45 seconds')), 45000);
            }),
        ]);
        console.log('PASS: stalled HTTP headers and response bodies both time out');
    } finally {
        clearTimeout(watchdog);
        clients.forEach(client => client.agent.destroy());
        server.closeAllConnections();
        server.close();
    }
})().catch(error => {console.error(error); process.exitCode = 1;});
