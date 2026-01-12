
import http from 'http';

const postData = JSON.stringify({
    selectedSong: {
        videoId: 'fJ9rUzIMcZQ',
        title: 'Queen – Bohemian Rhapsody',
        source: 'youtube'
    },
    enginePreference: 'mock',
    options: { mediaType: 'audio' }
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/v1/audio/acquire',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = http.request(options, (res) => {
    let data = '';

    console.log(`Status Code: ${res.statusCode}`);

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Response Body:', data);
        try {
            const json = JSON.parse(data);
            console.log('Parsed JSON:', json);
        } catch (e) {
            console.log('Failed to parse JSON');
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.write(postData);
req.end();
