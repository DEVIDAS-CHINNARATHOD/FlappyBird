// source.js
// -----------------------------------------------------------------
// These are relative paths.
// This file assumes you have a folder named "imgs" and "sounds"
// in the same directory as your index.html file.
// -----------------------------------------------------------------

const gameAssets = {
    // Image paths (no starting '/')
    birdImage: 'imgs/bird.jpeg',
    // Note: filenames must match files in the imgs/ folder
    pipeImage: 'imgs/pips.png', // corrected filename (was 'pipes.png')
    gameOverImage: 'imgs/bird.jpeg', // use existing bird.jpeg

    // Sound paths (no starting '/')
    musicSound: 'sounds/bg-music.mp3',
    crashSound: 'sounds/out.mp3'
};