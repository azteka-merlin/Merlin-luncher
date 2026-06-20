const dns = require('node:dns');
const https = require('node:https');

function createApiAgent() {
    const resolver = new dns.Resolver();
    resolver.setServers(['1.1.1.1', '1.0.0.1']);

    return new https.Agent({
        lookup(hostname, options, callback) {
            resolver.resolve4(hostname, (error, addresses) => {
                if (error || addresses.length === 0) {
                    dns.lookup(hostname, options, callback);
                    return;
                }

                if (typeof options === 'object' && options.all) {
                    callback(null, addresses.map(address => ({ address, family: 4 })));
                    return;
                }

                callback(null, addresses[0], 4);
            });
        }
    });
}

module.exports = { createApiAgent };
