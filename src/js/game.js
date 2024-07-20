window.onload = function() {
    const gameContainer = document.getElementById('gameContainer');
    const player = document.getElementById('player');
    const scoreDisplay = document.getElementById('score');
    const playerWidth = player.offsetWidth;
    const playerHeight = player.offsetHeight;
    let playerX = gameContainer.clientWidth / 2 - playerWidth / 2;
    let playerY = gameContainer.clientHeight - playerHeight - 20;
    let poops = [];
    let score = 0;

    player.style.left = `${playerX}px`;
    player.style.top = `${playerY}px`;

    function createPoop() {
        const poop = document.createElement('div');
        poop.classList.add('poop');
        poop.style.left = `${Math.random() * (gameContainer.clientWidth - 30)}px`;
        poop.style.top = `0px`;
        gameContainer.appendChild(poop);
        poops.push(poop);
    }

    function movePoops() {
        poops.forEach((poop, index) => {
            let poopY = parseInt(poop.style.top);
            poopY += 5;
            poop.style.top = `${poopY}px`;

            if (poopY > gameContainer.clientHeight) {
                gameContainer.removeChild(poop);
                poops.splice(index, 1);
                score += 1;
                scoreDisplay.textContent = 'Score: ' + score;
                console.log('Score:', score);
            }

            if (detectCollision(player, poop)) {
                alert('Game Over!');
                resetGame();
            }
        });
    }

    function detectCollision(player, poop) {
        const playerRect = player.getBoundingClientRect();
        const poopRect = poop.getBoundingClientRect();

        return !(
            playerRect.top > poopRect.bottom ||
            playerRect.bottom < poopRect.top ||
            playerRect.left > poopRect.right ||
            playerRect.right < poopRect.left
        );
    }

    function resetGame() {
        poops.forEach(poop => {
            gameContainer.removeChild(poop);
        });
        poops = [];
        score = 0;
        scoreDisplay.textContent = 'Score: ' + score;
        playerX = gameContainer.clientWidth / 2 - playerWidth / 2;
        player.style.left = `${playerX}px`;
    }

    document.addEventListener('keydown', (event) => {
        const key = event.key;

        if (key === 'ArrowLeft' && playerX > 0) {
            playerX -= 20;
        } else if (key === 'ArrowRight' && playerX < gameContainer.clientWidth - playerWidth) {
            playerX += 20;
        }

        player.style.left = `${playerX}px`;
    });

    function gameLoop() {
        movePoops();
        requestAnimationFrame(gameLoop);
    }

    setInterval(createPoop, 1000);
    gameLoop();
}