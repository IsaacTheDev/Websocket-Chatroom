// Require all the modules
const WebSocket = require('ws');
const axios = require('axios');
const fs = require('fs');
const wss = new WebSocket.Server({
    noServer: true
});
const path = require('path')
var UsernameGenerator = require('username-generator');
const fastify = require('fastify')({
    logger: false
});
fastify.register(require('fastify-websocket'), {
    ws: wss
});

// Set variables
const clients = [];
const auth_url = "yoururlhere";

console.log("Starting server...");

fastify.get('/', function (request, reply) {
    const bufferIndexHtml = fs.readFileSync('index.html')
    reply.type('text/html').send(bufferIndexHtml)
});

fastify.get('/client.js', function (request, reply) {
    const bufferIndexHtml = fs.readFileSync('client.js')
    reply.type('text/javascript').send(bufferIndexHtml)
});

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

function broadcast(data) {
    clients.forEach(function each(client) {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(data);
        }
    });
};

function broadcastInactiveClient() {
    clients.forEach(function each(client, index) {
        if (client.ws.readyState === WebSocket.CLOSED) {
            if (index == -1) return broadcast(JSON.stringify({
                type: 'leave_forced'
            }));
            let user = clients[index];
            broadcast(JSON.stringify({
                type: 'leave',
                name: user.data.name
            }));
            console.log(`(${user.id}) ${user.data.name} left`);
            clients.splice(index, 1);
        }
    });
};

fastify.get('/websocket', { websocket: true }, (connection, req) => {
    const clientId = uuidv4();
    connection.socket.on('message', function incoming(message) {
        const data = JSON.parse(message);
        if (data.type === 'init') {
            if (!data.license) {
                connection.socket.close(1000, "1");
                return;
            }
            // Uncomment for auth checking
            // axios.post(auth_url, {
            //     license: data.license
            // }).then(function (response) {
            //     if (response.data.status === 1) {
            if (data.name == "Anonymous") {
                data.name = UsernameGenerator.generateUsername("-");
            } else {
                data.name = data.name.replace(/[^a-zA-Z0-9]/g, '');
            };

            console.log(`(${clientId}) ${data.name} joined`);

            clients.push({
                ws: connection.socket,
                id: clientId,
                uid: data.uid,
                data: {
                    license: data.license,
                    name: data.name
                }
            });
            broadcast(JSON.stringify({
                type: 'join',
                uid: data.uid,
                name: data.name
            }));
            // Uncomment for Auth Checking
            // } else {
            //     connection.socket.close(1000, "1");
            //     return;
            // };
            // }).catch(function (error) {
            //     connection.socket.close(1000, "2");
            //     return;
            // });
        } else if (data.type === 'message') {
            let user = clients.find(function (client) {
                return client.id == clientId;
            });
            console.log(`(${clientId}) ${user.data.name} : ${data.message}`);
            if (data.message == "clients") {
                connection.socket.send(JSON.stringify({
                    type: 'clients',
                    clients: clients.map(function (client) {
                        return client.data.name;
                    })
                }));
            } else {
                broadcast(JSON.stringify({
                    type: 'message',
                    name: user.data.name,
                    message: data.message.trim()
                }));
            };
        } else if (data.type === 'leave') {
            broadcastInactiveClient();
        };
    });
    connection.socket.on("close", () => {
        broadcastInactiveClient();
    });
});

fastify.listen(process.env.PORT || 3000, function (err) {
    if (err) throw err
    console.log(`server listening on ${fastify.server.address().port}`)
  });