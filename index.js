const WebSocket = require('ws');
const axios = require('axios');
const wss = new WebSocket.Server({
    port: 7071
});
var UsernameGenerator = require('username-generator');
const clients = [];
const auth_url = "yoururlhere";

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
}

wss.on('connection', function connection(ws) {
    const clientId = uuidv4();
    ws.on('message', function incoming(message) {
        const data = JSON.parse(message);
        if (data.type === 'init') {
            if (!data.license) {
                ws.close(1000, "1");
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
                ws: ws,
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
            //     ws.close(1000, "1");
            //     return;
            // };
            // }).catch(function (error) {
            //     ws.close(1000, "2");
            //     return;
            // });
        } else if (data.type === 'message') {
            let user = clients.find(function (client) {
                return client.id == clientId;
            });
            console.log(`(${clientId}) ${user.data.name} : ${data.message}`);
            broadcast(JSON.stringify({
                type: 'message',
                name: user.data.name,
                message: data.message.trim()
            }));
        } else if (data.type === 'leave') {
            broadcastInactiveClient();
        };
    });
    ws.on("close", () => {
        broadcastInactiveClient();
    });
});