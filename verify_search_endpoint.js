
import http from 'http';

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/youtube/search?q=hello',
    method: 'GET',
    headers: {
        'Content-Type': 'application/json',
        'x-youtube-api-key': 'INVALID_KEY_TEST'
    }
};

const req = http.request(options, (res) => {
    let data = '';

    console.log(`Status Code: ${res.statusCode}`);

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('Response Body:', JSON.stringify(json, null, 2));
        } catch (e) {
            console.log('Response Body (Raw):', data);
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.end();
