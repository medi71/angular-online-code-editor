const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;
const path = require('path');
const redis = require('then-redis');

// express app config
app.use('/', express.static(path.resolve(__dirname, './dist')));
app.get('*', (req, res) =>
  res.sendFile(path.resolve(__dirname, './dist/index.html'))
);

// app constants and helpers
const ACTION_TYPING_INDICATOR = 'typing_indicator';
const ACTION_ONLINE_USERS = 'online_users';
const ACTION_GET_ONLINE_USERS = 'get_online_users';
const ACTION_SAVE_CONTENT = 'save_content';
const ACTION_GET_CONTENT = 'get_content';
const ACTION_JOIN_ROOM = 'join_room';
const ACTION_LEAVE_ROOM = 'leave_room';
const ACTION_CREATE_ROOM = 'create_room';
const ACTION_GET_ROOM_LIST = 'get_room_list';

// @TODO: move redis config to a separated configuration file
const redisConfig = {
  host: 'redis-12592.c11.us-east-1-2.ec2.cloud.redislabs.com',
  port: 12592,
  password: 'onlineeditorpass'
};
const redisClient = redis.createClient(redisConfig);

const generateRandomString = (length = 10) => {
  const possibleCharacters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let output = '';
  for (let i = 0; i < length; i++) {
    output += possibleCharacters.charAt(
      Math.floor(Math.random() * possibleCharacters.length)
    );
  }
  return output;
};

const onlineUsers = roomId =>
  io.sockets.adapter.rooms[roomId] && io.sockets.adapter.rooms[roomId].length
    ? io.sockets.adapter.rooms[roomId].length
    : 0;

// database (cache) manipulations
const createOrUpdateRoom = room =>
  redisClient.hset('rooms', room.id, JSON.stringify(room));

const getRooms = () => redisClient.hgetall('rooms');

// socket connection config
io.on('connection', socket => {
  socket.on(ACTION_GET_ONLINE_USERS, (roomId, ackFn) =>
    ackFn(onlineUsers(roomId))
  );

  socket.on(ACTION_JOIN_ROOM, (roomId, ackFn) => {
    socket.join(roomId);
    socket.broadcast.to(roomId).emit(ACTION_ONLINE_USERS, onlineUsers(roomId));
  });

  socket.on(ACTION_LEAVE_ROOM, (roomId, ackFn) => {
    socket.leave(roomId);
    ackFn();
  });

  socket.on(ACTION_CREATE_ROOM, async (roomName, ackFn) => {
    const room = {
      id: generateRandomString(),
      name: roomName,
      content: '/* your js code goes here */'
    };

    await createOrUpdateRoom(room);
    ackFn(room);
  });

  socket.on(ACTION_GET_ROOM_LIST, async (payload, ackFn) => {
    const rooms = await getRooms();
    ackFn(rooms);
  });

  socket.on(ACTION_SAVE_CONTENT, async (payload, ackFn) => {
    const room = await redisClient.get(payload.roomId);

    if (room) {
      redisClient
        .set(payload.roomId, { ...room, ...{ content: payload.content } })
        .then(ackFn)
        .catch(ackFn);
    }
  });

  socket.on(ACTION_GET_CONTENT, (roomId, ackFn) =>
    redisClient
      .get(roomId)
      .then(ackFn)
      .catch(() => ackFn(''))
  );

  socket.on(ACTION_TYPING_INDICATOR, payload =>
    socket.broadcast
      .to(payload.roomId)
      .emit(ACTION_TYPING_INDICATOR, payload.message)
  );

  socket.on('disconnect', () => {
    Object.keys(io.sockets.adapter.rooms).forEach(roomId =>
      socket.broadcast
        .to(roomId)
        .emit(ACTION_ONLINE_USERS, io.sockets.adapter.rooms[roomId].length)
    );
  });
});

http.listen(port, () => console.log('server listening on *:' + port));
