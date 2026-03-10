const https = require('https');
const fs = require('fs');
const path = require('path');

const downloadSound = (url, filename) => {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
                return;
            }
            const fileStream = fs.createWriteStream(path.join(__dirname, '..', 'public', filename));
            res.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`Successfully downloaded ${filename}`);
                resolve();
            });
        });

        req.on('error', (err) => {
            reject(err);
        });
    });
};

async function main() {
    try {
        // High-pitched chime for completely New Customers
        await downloadSound(
            'https://actions.google.com/sounds/v1/alarms/spaceship_alarm.ogg',
            'new_order.mp3'
        );

        // Subtle ding for existing customers updating cart
        await downloadSound(
            'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
            'running_order.mp3'
        );

        console.log("All audio files downloaded successfully!");
    } catch (err) {
        console.error("Error downloading sounds:", err);
    }
}

main();
