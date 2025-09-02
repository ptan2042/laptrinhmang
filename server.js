const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server);

let waitingSocket = null;
const rooms = {};

function decideWinner(aMove, bMove, aId, bId) {
    if (aMove === bMove) return null;
    const wins = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
    if (wins[aMove] === bMove) return aId;
    return bId;
}

io.on('connection', socket => {
    console.log('Client connected:', socket.id);

    // client yêu cầu join queue (auto match)
    socket.on('joinQueue', () => {
        if (waitingSocket && waitingSocket.id !== socket.id) {
            const roomId = `room-${waitingSocket.id}-${socket.id}`;
            socket.join(roomId);
            waitingSocket.join(roomId);

            rooms[roomId] = { players: [waitingSocket.id, socket.id], moves: {} };

            io.to(roomId).emit('matched', { roomId, players: rooms[roomId].players });
            console.log(`Paired ${waitingSocket.id} <-> ${socket.id} in ${roomId}`);

            waitingSocket = null;

        } else {
            waitingSocket = socket;
            socket.emit('waiting');
            console.log('Waiting for opponent:', socket.id);
        }
    });

    // Chat message handler
    socket.on('chatMessage', ({ roomId, message }) => {
        if (!rooms[roomId]) {
            console.log('Room not found for chat:', roomId);
            return;
        }

        if (!rooms[roomId].players.includes(socket.id)) {
            console.log('Socket not in room:', socket.id, roomId);
            return;
        }

        console.log('Chat message:', { roomId, sender: socket.id, message });
        io.to(roomId).emit('chatMessage', { sender: socket.id, message });
    });

    // client gửi move
    socket.on('playerMove', ({ roomId, move }) => {
        const room = rooms[roomId];
        if (!room) return;
        room.moves[socket.id] = move;

        const [pA, pB] = room.players;

        // Thông báo cho đối thủ biết là đã có người chọn
        const opponentId = room.players.find(id => id !== socket.id);
        if (opponentId && !room.moves[opponentId]) {
            io.to(opponentId).emit('opponentMadeMove', {
                message: 'Đối thủ đã chọn! Hãy ra kéo búa bao!'
            });
        }

        // Kiểm tra xem cả hai đã chọn chưa
        if (room.moves[pA] && room.moves[pB]) {
            const aMove = room.moves[pA];
            const bMove = room.moves[pB];
            const winnerId = decideWinner(aMove, bMove, pA, pB);

            io.to(roomId).emit('roundResult', {
                moves: { [pA]: aMove, [pB]: bMove },
                winner: winnerId
            });

            room.moves = {};
        }
    });

    // rematch (player bấm play again)
    socket.on('playAgain', ({ roomId }) => {
        if (!rooms[roomId]) return;
        rooms[roomId].moves = {};
        io.to(roomId).emit('newRound');
    });

    // xử lý disconnect
    socket.on('disconnect', () => {
        console.log('Disconnected:', socket.id);
        if (waitingSocket && waitingSocket.id === socket.id) waitingSocket = null;

        // tìm phòng chứa socket này và notify đối thủ
        for (const roomId of Object.keys(rooms)) {
            const r = rooms[roomId];
            if (r.players.includes(socket.id)) {
                io.to(roomId).emit('opponentLeft');
                delete rooms[roomId];
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));