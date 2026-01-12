
import http from 'http';

function request(path) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:3001${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, data: data });
            });
        }).on('error', reject);
    });
}

async function test() {
    console.log("Testing Search Endpoint...");
    try {
        const searchRes = await request('/api/youtube/search?q=wild+horses');
        console.log("Search Status:", searchRes.status);
        console.log("Search Body Preview:", searchRes.data.substring(0, 200));

        // Check for error in JSON
        try {
            const json = JSON.parse(searchRes.data);
            if (json.error) console.error("Search API Error:", json.error);
        } catch (e) { }

    } catch (e) {
        console.error("Search Request Failed:", e);
    }
}

test();
