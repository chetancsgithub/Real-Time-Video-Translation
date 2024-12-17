'use strict';

const os = require('os');
const nodeStatic = require('node-static');
const http = require('http');
const socketIO = require('socket.io');
const Translate = require('@google-cloud/translate'); // Ensure you use the correct version of the client library

// Set the path to the Google Cloud credentials
process.env.GOOGLE_APPLICATION_CREDENTIALS = "C://Users//sabhi//Downloads//fluted.json"; // or use forward slashes


// Instantiates a client
const translate = new Translate();

// Server setup
const fileServer = new nodeStatic.Server();
const app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(9090, () => {
  console.log('Server listening on port 9090');
});

const io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {
  
  function log() {
    const array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(message) {
    log('Client said: ', message);
    socket.broadcast.emit('message', message);
  });

  socket.on('send_to_server_raw', function(message) {
    console.log("Server received raw message", message);
    socket.broadcast.emit('to_client_raw', message);
  });

  socket.on('test', async function(message) {
    const obj = JSON.parse(message);
    console.log("Server received translation request", obj.lang, obj.text);

    const text = obj.text;
    const target = obj.lang;

    try {
      const [translation] = await translate.translate(text, target);
      console.log(`Text: ${text}`);
      console.log(`Translation: ${translation}`);
      socket.emit('translated', translation);
    } catch (err) {
      console.error('Translation error:', err.message);
      socket.emit('translation_error', 'Translation failed. Please try again later.');
    }
  });

  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);

    const clientsInRoom = io.sockets.adapter.rooms[room];
    const numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      socket.join(room);
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);
    } else if (numClients === 1) {
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } else { // max two clients
      socket.emit('full', room);
    }
  });

  socket.on('ipaddr', function() {
    const ifaces = os.networkInterfaces();
    for (const dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('bye', function() {
    console.log('Received bye');
  });
});

console.log('Server setup complete');
