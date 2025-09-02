// public/client.js
const socket = io();

const statusEl = document.getElementById('status');
const btnRock = document.getElementById('btn-rock');
const btnPaper = document.getElementById('btn-paper');
const btnScissors = document.getElementById('btn-scissors');
const movesEl = document.getElementById('moves');
const resultEl = document.getElementById('result');
const scoreEl = document.getElementById('score');
const rematchBtn = document.getElementById('rematch');

let currentRoom = null;
let myId = null;
let opponentId = null;
let score = { me: 0, opp: 0 };
const historyEl = document.getElementById('history');
let roundNumber = 0;

// Thêm element để hiển thị thông báo
const notificationEl = document.createElement('div');
notificationEl.id = 'notification';
notificationEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 15px 20px;
    border-radius: 5px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    display: none;
    z-index: 1000;
    animation: slideIn 0.3s ease;
`;
document.body.appendChild(notificationEl);

// CSS animation cho notification
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    .notification-out {
        animation: slideOut 0.3s ease forwards;
    }
`;
document.head.appendChild(style);

function showNotification(message, type = 'info', duration = 3000) {
    notificationEl.textContent = message;

    // Màu sắc theo type
    const colors = {
        'info': '#2196F3',
        'success': '#4CAF50',
        'warning': '#FF9800',
        'alert': '#f44336'
    };
    notificationEl.style.background = colors[type] || colors['info'];
    notificationEl.style.display = 'block';
    notificationEl.classList.remove('notification-out');

    // Tự động ẩn sau duration
    if (duration > 0) {
        setTimeout(() => {
            notificationEl.classList.add('notification-out');
            setTimeout(() => {
                notificationEl.style.display = 'none';
            }, 300);
        }, duration);
    }
}

function enableButtons(enable) {
    btnRock.disabled = !enable;
    btnPaper.disabled = !enable;
    btnScissors.disabled = !enable;
}

function updateScore() {
    scoreEl.textContent = `${score.me} - ${score.opp}`;
}

socket.on('connect', () => {
    myId = socket.id;
    console.log('Connected with ID:', myId);
    statusEl.textContent = 'Kết nối máy chủ — tìm đối thủ...';
    socket.emit('joinQueue'); // auto-match when connected
});

socket.on('waiting', () => {
    statusEl.textContent = 'Đang chờ đối thủ...';
    enableButtons(false);
});

socket.on('matched', ({ roomId, players }) => {
    currentRoom = roomId;
    opponentId = players.find(id => id !== myId);
    console.log('Matched! Room:', currentRoom, 'Players:', players);
    statusEl.textContent = 'Đã ghép đôi — chọn tay của bạn!';
    enableButtons(true);
    rematchBtn.style.display = 'none';
    movesEl.textContent = '';
    resultEl.textContent = '';

    // Thông báo đã ghép đôi
    showNotification('Đã tìm thấy đối thủ! Bắt đầu trò chơi!', 'success');
});

// Xử lý thông báo khi đối thủ đã chọn
socket.on('opponentMadeMove', ({ message }) => {
    showNotification(message, 'warning', 5000);
    statusEl.textContent = message;
});

socket.on('roundResult', ({ moves, winner }) => {
    const myMove = moves[myId];
    const oppMove = moves[opponentId];
    movesEl.textContent = `Bạn: ${myMove} — Đối thủ: ${oppMove}`;
    roundNumber++;

    let resultText = '';
    if (!winner) {
        resultEl.textContent = 'Hòa!';
        resultText = 'Hòa!';
        showNotification('Kết quả: Hòa!', 'info');
    } else if (winner === myId) {
        resultEl.textContent = 'Bạn thắng!';
        resultText = 'Bạn thắng!';
        score.me++;
        showNotification('Bạn thắng round này! 🎉', 'success');
    } else {
        resultEl.textContent = 'Bạn thua!';
        resultText = 'Bạn thua!';
        score.opp++;
        showNotification('Bạn thua round này! 😢', 'alert');
    }

    updateScore();
    enableButtons(false);
    rematchBtn.style.display = 'inline-block';
    statusEl.textContent = 'Round kết thúc - Bấm Rematch để chơi tiếp!';

    const li = document.createElement('li');
    let text = `Round ${roundNumber}: Bạn ${myMove} - Đối thủ ${oppMove} → `;
    if (!winner) text += 'Hòa';
    else if (winner === myId) text += 'Thắng';
    else text += 'Thua';
    li.textContent = text;
    historyEl.appendChild(li);
});

socket.on('newRound', () => {
    resultEl.textContent = '';
    movesEl.textContent = '';
    rematchBtn.style.display = 'none';
    enableButtons(true);
    statusEl.textContent = 'Round mới — chọn tay của bạn!';
    showNotification('Round mới bắt đầu!', 'info');
});

socket.on('opponentLeft', () => {
    statusEl.textContent = 'Đối thủ đã rời. Tự động tìm đối thủ mới...';
    opponentId = null;
    currentRoom = null;
    enableButtons(false);
    showNotification('Đối thủ đã rời khỏi trò chơi', 'warning');
    socket.emit('joinQueue');
});

socket.on('chatMessage', ({ sender, message }) => {
    console.log('Received chat message:', { sender, message });
    const who = sender === myId ? 'Bạn' : 'Đối thủ';
    addChat(`${who}: ${message}`);

    // Thông báo có tin nhắn mới từ đối thủ
    if (sender !== myId) {
        showNotification(`Tin nhắn mới: ${message}`, 'info', 2000);
    }
});

btnRock.onclick = () => sendMove('rock');
btnPaper.onclick = () => sendMove('paper');
btnScissors.onclick = () => sendMove('scissors');
rematchBtn.onclick = () => {
    if (currentRoom) socket.emit('playAgain', { roomId: currentRoom });
    rematchBtn.style.display = 'none';
    resultEl.textContent = 'Đang chờ đối thủ đồng ý rematch...';
    statusEl.textContent = 'Đang chờ đối thủ đồng ý rematch...';
    enableButtons(false);
    showNotification('Đã gửi yêu cầu rematch...', 'info');
};

function sendMove(move) {
    if (!currentRoom) return;
    enableButtons(false);

    const moveNames = {
        'rock': 'Búa',
        'paper': 'Bao',
        'scissors': 'Kéo'
    };

    resultEl.textContent = `Bạn đã chọn ${moveNames[move]}. Chờ đối thủ...`;
    statusEl.textContent = `Bạn đã chọn ${moveNames[move]}. Chờ đối thủ...`;
    socket.emit('playerMove', { roomId: currentRoom, move });

    showNotification(`Bạn đã chọn ${moveNames[move]}! Chờ đối thủ...`, 'info');
}

function addChat(text) {
    console.log('Adding chat message:', text);
    const msgDiv = document.createElement('div');
    msgDiv.textContent = text;
    document.getElementById('chat-messages').appendChild(msgDiv);
    // Auto scroll to bottom
    document.getElementById('chat-messages').scrollTop = document.getElementById('chat-messages').scrollHeight;
}

document.getElementById('chat-form').onsubmit = (e) => {
    e.preventDefault();
    console.log('Chat form submitted');
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    console.log('Current room:', currentRoom);
    console.log('Message:', message);

    if (message && currentRoom) {
        console.log('Sending chat message:', { roomId: currentRoom, message });
        socket.emit('chatMessage', { roomId: currentRoom, message });
        input.value = '';
    } else {
        console.log('Cannot send message - missing room or empty message');
    }
};

// init
enableButtons(false);
updateScore();

// Debug current state
setInterval(() => {
    console.log('Debug - Current room:', currentRoom, 'My ID:', myId);
}, 10000); // Log every 10 seconds